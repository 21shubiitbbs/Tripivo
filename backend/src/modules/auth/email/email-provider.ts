import nodemailer from 'nodemailer';
import { env } from '../../../config/env.js';

export type EmailMessage = { to: string; subject: string; text: string; html: string };

/** Delivers transactional email (verification and password reset codes). */
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

/** Development provider: prints the email to the API log. env.ts refuses it in production. */
class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage) {
    console.log(`[email:console] To: ${message.to}\nSubject: ${message.subject}\n${message.text}\n`);
  }
}

/** Sends through Resend's REST API (https://resend.com/docs/api-reference/emails/send-email). */
class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
    });
    if (!response.ok) {
      // Logged for operators; callers turn this into a generic error for the client.
      throw new Error(`Resend rejected the email (${response.status}): ${await response.text()}`);
    }
  }
}

/** Sends through any SMTP server, e.g. Gmail with an app password (smtp.gmail.com:587). */
class SmtpEmailProvider implements EmailProvider {
  private readonly transport;

  constructor(
    config: { host: string; port: number; user: string; pass: string },
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      // 465 is TLS from the start; 587 and 25 upgrade with STARTTLS.
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 10_000,
    });
  }

  async send(message: EmailMessage) {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (!provider) {
    const { email } = env;
    provider =
      email.provider === 'resend' && email.resendApiKey
        ? new ResendEmailProvider(email.resendApiKey, email.from)
        : email.provider === 'smtp' && email.smtp
          ? new SmtpEmailProvider(email.smtp, email.from)
          : new ConsoleEmailProvider();
  }
  return provider;
}
