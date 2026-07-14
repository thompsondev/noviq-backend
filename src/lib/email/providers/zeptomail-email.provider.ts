import axios, { isAxiosError } from 'axios';
import { EmailProvider, SendEmailInput } from './email-provider.interface';

/**
 * ZeptoMail (Zoho) send-mail REST API — no official Node SDK used here
 * (dependency footprint), just a plain POST via axios, which is already a
 * project dependency. See https://www.zoho.com/zeptomail/help/api/email-sending.html
 */
export class ZeptoMailEmailProvider implements EmailProvider {
  constructor(
    /** The full Authorization header value ZeptoMail gives you, e.g. "Zoho-enczapikey wSs..." */
    private readonly authHeader: string,
    private readonly from: string,
    private readonly fromName: string | undefined,
    private readonly apiUrl: string,
  ) {}

  async send({ to, subject, text }: SendEmailInput): Promise<void> {
    try {
      await axios.post(
        this.apiUrl,
        {
          from: { address: this.from, name: this.fromName },
          to: [{ email_address: { address: to } }],
          subject,
          textbody: text,
        },
        {
          headers: {
            Authorization: this.authHeader,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (err) {
      if (isAxiosError(err)) {
        const message =
          err.response?.data?.message ||
          err.response?.data?.error?.message ||
          err.message;
        throw new Error(`ZeptoMail error: ${message}`);
      }
      throw err;
    }
  }
}
