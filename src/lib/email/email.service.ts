import { Injectable } from '@nestjs/common';

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

/**
 * No real provider (Resend/SendGrid/SES) is configured yet. In that case this
 * logs the email instead of sending it, so auth flows are testable end to end
 * before a provider is chosen — see docs/02-system-architecture.md. Swap the
 * `send` implementation for a real provider call once one is picked; every
 * caller in this codebase goes through this one method.
 */
@Injectable()
export class EmailService {
  private readonly providerConfigured = false;

  async send({ to, subject, text }: SendEmailInput): Promise<void> {
    if (!this.providerConfigured) {
      console.log(
        `[email:dev] to=${to} subject="${subject}"\n${text}\n` +
          '(no email provider configured — see EmailService)',
      );
      return;
    }
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
