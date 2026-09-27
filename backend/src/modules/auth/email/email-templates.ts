import type { EmailMessage } from './email-provider.js';

// Plain, table-free HTML that renders acceptably in every mail client, plus a text version.

function layout(heading: string, intro: string, code: string, footer: string) {
  return `<!doctype html>
<html><body style="margin:0;background:#F5F7FB;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F172A">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px">
    <div style="font-size:22px;font-weight:800;color:#1D6AE5;margin-bottom:24px">Tripivo</div>
    <div style="background:#FFFFFF;border:1px solid #E3E8F0;border-radius:16px;padding:28px 24px">
      <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
      <p style="font-size:15px;line-height:22px;color:#64748B;margin:0 0 20px">${intro}</p>
      <div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;background:#E6EFFD;color:#1D6AE5;border-radius:12px;padding:16px 0">${code}</div>
      <p style="font-size:13px;line-height:20px;color:#94A3B8;margin:20px 0 0">${footer}</p>
    </div>
  </div>
</body></html>`;
}

export function verificationEmail(to: string, name: string | null, code: string, minutes: number): EmailMessage {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  return {
    to,
    subject: `${code} is your Tripivo verification code`,
    text: `${greeting}\n\nYour Tripivo verification code is ${code}. It expires in ${minutes} minutes.\n\nIf you didn't create a Tripivo account, you can ignore this email.`,
    html: layout(
      'Confirm your email',
      `${greeting} enter this code in the Tripivo app to finish creating your account.`,
      code,
      `The code expires in ${minutes} minutes. If you didn’t create a Tripivo account, you can ignore this email.`,
    ),
  };
}

export function passwordResetEmail(to: string, name: string | null, code: string, minutes: number): EmailMessage {
  const greeting = name ? `Hi ${name.split(' ')[0]},` : 'Hi,';
  return {
    to,
    subject: `${code} is your Tripivo password reset code`,
    text: `${greeting}\n\nUse ${code} to reset your Tripivo password. It expires in ${minutes} minutes.\n\nIf you didn't ask to reset your password, you can ignore this email; your password won't change.`,
    html: layout(
      'Reset your password',
      `${greeting} enter this code in the Tripivo app to choose a new password.`,
      code,
      `The code expires in ${minutes} minutes. If you didn’t ask to reset your password, you can ignore this email; your password won’t change.`,
    ),
  };
}
