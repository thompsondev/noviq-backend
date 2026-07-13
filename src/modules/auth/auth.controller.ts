import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { VerifyDto } from './dto/verify.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { SigninDto } from './dto/signin.dto';
import { ForgotDto } from './dto/forgot.dto';
import { ResetDto } from './dto/reset.dto';
import { SESSION_COOKIE_NAME } from '../../middleware/helpers/session.constants';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setSessionCookie(
    res: Response,
    sessionId: string,
    maxAgeSeconds: number,
  ) {
    res.cookie(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: maxAgeSeconds * 1000,
      path: '/',
    });
  }

  @Post('signup')
  @ApiOperation({ summary: 'Create a user + organization, sends an OTP' })
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify signup OTP and start a session' })
  async verify(
    @Body() dto: VerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sessionId, maxAgeSeconds, user } =
      await this.authService.verify(dto);
    this.setSessionCookie(res, sessionId, maxAgeSeconds);
    return { user };
  }

  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend the signup OTP (60s cooldown)' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('signin')
  @ApiOperation({ summary: 'Sign in with email + password' })
  async signin(
    @Body() dto: SigninDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sessionId, maxAgeSeconds, user } =
      await this.authService.signin(dto);
    this.setSessionCookie(res, sessionId, maxAgeSeconds);
    return { user };
  }

  @Post('forgot')
  @ApiOperation({ summary: 'Trigger a password reset code by email' })
  async forgot(@Body() dto: ForgotDto) {
    return this.authService.forgot(dto);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset password with the emailed code' })
  async reset(
    @Body() dto: ResetDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { sessionId, maxAgeSeconds, user } =
      await this.authService.reset(dto);
    this.setSessionCookie(res, sessionId, maxAgeSeconds);
    return { user };
  }

  @Post('logout')
  @ApiOperation({ summary: 'End the current session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (sessionId) {
      await this.authService.logout(sessionId);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { success: true };
  }
}
