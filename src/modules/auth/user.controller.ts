import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SESSION_COOKIE_NAME } from '../../middleware/helpers/session.constants';

@ApiTags('Auth')
@Controller('user')
export class UserController {
  constructor(private readonly authService: AuthService) {}

  @Get('session')
  @ApiOperation({ summary: 'Read the current session, if any' })
  async session(@Req() req: Request) {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    return this.authService.getSessionUser(sessionId);
  }
}
