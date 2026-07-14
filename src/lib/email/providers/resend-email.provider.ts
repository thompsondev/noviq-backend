import { Resend } from 'resend';
import { EmailProvider, SendEmailInput } from './email-provider.interface';

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send({ to, subject, text }: SendEmailInput): Promise<void> {
    const result = await this.client.emails.send({
      from: this.from,
      to,
      subject,
      text,
    });
    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }
  }
}
