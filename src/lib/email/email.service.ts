import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailProvider,
  SendEmailInput,
} from './providers/email-provider.interface';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { ZeptoMailEmailProvider } from './providers/zeptomail-email.provider';

const DEFAULT_ZEPTOMAIL_API_URL = 'https://api.zeptomail.com/v1.1/email';

/**
 * Switch providers with one env var (`EMAIL_PROVIDER=resend|zeptomail`) — no
 * code change needed. Every caller in this codebase goes through `send()`,
 * so adding a third provider only means adding one more branch here. Leave
 * `EMAIL_PROVIDER` unset to fall back to logging emails to the console
 * (useful for local dev without real credentials) — see docs/02-system-architecture.md.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: EmailProvider | null;

  constructor(private readonly configService: ConfigService) {
    this.provider = this.buildProvider();
    this.logger.log(
      this.provider
        ? `Email provider: ${this.configService.get<string>('EMAIL_PROVIDER')}`
        : 'Email provider: none (logging to console)',
    );
  }

  private buildProvider(): EmailProvider | null {
    const providerName = this.configService
      .get<string>('EMAIL_PROVIDER')
      ?.trim()
      .toLowerCase();
    const from = this.configService.get<string>('EMAIL_FROM');
    const fromName = this.configService.get<string>('EMAIL_FROM_NAME');

    if (!providerName) return null;

    if (!from) {
      this.logger.warn(
        `EMAIL_PROVIDER=${providerName} is set but EMAIL_FROM is missing — falling back to console logging`,
      );
      return null;
    }

    if (providerName === 'resend') {
      const apiKey = this.configService.get<string>('RESEND_API_KEY');
      if (!apiKey) {
        this.logger.warn('EMAIL_PROVIDER=resend but RESEND_API_KEY is missing');
        return null;
      }
      return new ResendEmailProvider(
        apiKey,
        fromName ? `${fromName} <${from}>` : from,
      );
    }

    if (providerName === 'zeptomail') {
      const authHeader = this.configService.get<string>('ZEPTOMAIL_API_TOKEN');
      if (!authHeader) {
        this.logger.warn(
          'EMAIL_PROVIDER=zeptomail but ZEPTOMAIL_API_TOKEN is missing',
        );
        return null;
      }
      const apiUrl =
        this.configService.get<string>('ZEPTOMAIL_API_URL') ||
        DEFAULT_ZEPTOMAIL_API_URL;
      return new ZeptoMailEmailProvider(authHeader, from, fromName, apiUrl);
    }

    this.logger.warn(`Unknown EMAIL_PROVIDER "${providerName}" — ignoring`);
    return null;
  }

  async send({ to, subject, text }: SendEmailInput): Promise<void> {
    if (!this.provider) {
      console.log(
        `[email:dev] to=${to} subject="${subject}"\n${text}\n` +
          '(no email provider configured — see EmailService)',
      );
      return;
    }
    await this.provider.send({ to, subject, text });
  }

  async sendOtp(to: string, code: string): Promise<void> {
    await this.send({
      to,
      subject: 'Your Noviq verification code',
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
    });
  }

  async sendPasswordReset(to: string, resetToken: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your Noviq password',
      text: `Your password reset code is ${resetToken}. It expires in 30 minutes. If you didn't request this, you can ignore this email.`,
    });
  }
}
