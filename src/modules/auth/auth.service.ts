import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'crypto';
import { User } from '../../lib/database/entities/user.entity';
import { Organization } from '../../lib/database/entities/organization.entity';
import { RedisService } from '../../lib/redis/redis.service';
import { EmailService } from '../../lib/email/email.service';
import { SESSION_TTL_SECONDS } from '../../middleware/helpers/session.constants';
import { SignupDto } from './dto/signup.dto';
import { VerifyDto } from './dto/verify.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { SigninDto } from './dto/signin.dto';
import { ForgotDto } from './dto/forgot.dto';
import { ResetDto } from './dto/reset.dto';

const OTP_TTL_SECONDS = 10 * 60;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const RESET_CODE_TTL_SECONDS = 30 * 60;
const PASSWORD_SALT_ROUNDS = 10;

export interface SessionResult {
  sessionId: string;
  maxAgeSeconds: number;
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: string;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  async signup(dto: SignupDto): Promise<{ email: string }> {
    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const orgSlugBase = slugify(dto.name) || 'org';
    const organization = await this.orgRepo.save(
      this.orgRepo.create({
        name: `${dto.name}'s Organization`,
        slug: `${orgSlugBase}-${randomUUID().slice(0, 8)}`,
      }),
    );

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const user = await this.userRepo.save(
      this.userRepo.create({
        organizationId: organization.id,
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: 'owner',
        emailVerifiedAt: null,
      }),
    );

    await this.issueOtp(user);
    return { email: user.email };
  }

  async verify(dto: VerifyDto): Promise<SessionResult> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new BadRequestException('Invalid code');
    }

    if (!user.emailVerifiedAt) {
      const storedCode = await this.redisService.get(`otp:${user.id}`);
      if (!storedCode || storedCode !== dto.code) {
        throw new BadRequestException('Invalid or expired code');
      }
      await this.redisService.delete(`otp:${user.id}`);
      user.emailVerifiedAt = new Date();
      await this.userRepo.save(user);
    }

    return this.createSession(user);
  }

  async resendOtp(dto: ResendOtpDto): Promise<{ email: string }> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      throw new BadRequestException('Invalid request');
    }
    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email already verified');
    }

    const cooldownKey = `otp-cooldown:${user.id}`;
    const onCooldown = await this.redisService.get(cooldownKey);
    if (onCooldown) {
      throw new HttpException(
        'Please wait before requesting another code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.issueOtp(user);
    return { email: user.email };
  }

  async signin(dto: SigninDto): Promise<SessionResult> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Please verify your email first');
    }

    return this.createSession(user);
  }

  async forgot(dto: ForgotDto): Promise<{ email: string }> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    // Don't reveal whether the account exists — same response either way.
    if (user) {
      const code = generateOtp();
      await this.redisService.set(
        `reset:${user.id}`,
        code,
        RESET_CODE_TTL_SECONDS,
      );
      await this.emailService.sendPasswordReset(user.email, code);
    }
    return { email: dto.email };
  }

  async reset(dto: ResetDto): Promise<SessionResult> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new BadRequestException('Invalid or expired code');
    }

    const storedCode = await this.redisService.get(`reset:${user.id}`);
    if (!storedCode || storedCode !== dto.code) {
      throw new BadRequestException('Invalid or expired code');
    }
    await this.redisService.delete(`reset:${user.id}`);

    user.passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    await this.userRepo.save(user);

    return this.createSession(user);
  }

  async logout(sessionId: string): Promise<void> {
    await this.redisService.delete(`session:${sessionId}`);
  }

  async getSessionUser(sessionId: string | undefined): Promise<{
    user: PublicUser | null;
  }> {
    if (!sessionId) return { user: null };

    const session = await this.redisService.get(`session:${sessionId}`);
    if (!session) return { user: null };

    const user = await this.userRepo.findOne({
      where: { id: session.userId },
    });
    if (!user) return { user: null };

    return { user: toPublicUser(user) };
  }

  private async issueOtp(user: User): Promise<void> {
    const code = generateOtp();
    await this.redisService.set(`otp:${user.id}`, code, OTP_TTL_SECONDS);
    await this.redisService.set(
      `otp-cooldown:${user.id}`,
      '1',
      OTP_RESEND_COOLDOWN_SECONDS,
    );
    await this.emailService.sendOtp(user.email, code);
  }

  private async createSession(user: User): Promise<SessionResult> {
    const sessionId = randomUUID();
    await this.redisService.set(
      `session:${sessionId}`,
      { userId: user.id },
      SESSION_TTL_SECONDS,
    );
    return {
      sessionId,
      maxAgeSeconds: SESSION_TTL_SECONDS,
      user: toPublicUser(user),
    };
  }
}
