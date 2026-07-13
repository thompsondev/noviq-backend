import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { RedisService } from '../../lib/redis/redis.service';
import { User, UserRole } from '../../lib/database/entities/user.entity';
import { SESSION_COOKIE_NAME } from '../helpers/session.constants';

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

/**
 * Every tenant-scoped route should sit behind this guard: it resolves the
 * session cookie to a user and attaches `organizationId`, which is the
 * enforcement point for multi-tenancy (see docs/02-system-architecture.md).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = request.cookies?.[SESSION_COOKIE_NAME] as
      | string
      | undefined;

    if (!sessionId) {
      throw new UnauthorizedException('Not authenticated');
    }

    const session = await this.redisService.get(`session:${sessionId}`);
    if (!session) {
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.userRepo.findOne({
      where: { id: session.userId },
    });
    if (!user) {
      throw new UnauthorizedException('Session expired');
    }

    request.user = {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    return true;
  }
}
