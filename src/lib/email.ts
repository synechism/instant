import { ServerClient } from "postmark";

const token = process.env.POSTMARK_SERVER_TOKEN;
const from = process.env.EMAIL_FROM;

// Lazily create the client so the app still boots without Postmark configured.
const client = token ? new ServerClient(token) : null;

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

// Low-level send. Falls back to logging when Postmark isn't configured, so
// local development works without a server token.
async function send({ to, subject, html, text }: SendArgs) {
  if (!client || !from) {
    console.log(
      `\n[email:dev] (Postmark not configured) would send to ${to}\n[email:dev] subject: ${subject}\n[email:dev] ${text}\n`,
    );
    return;
  }
  await client.sendEmail({
    From: from,
    To: to,
    Subject: subject,
    HtmlBody: html,
    TextBody: text,
    MessageStream: "outbound",
  });
}

export async function sendOrganizationInvitation(args: {
  email: string;
  invitedByUsername?: string | null;
  invitedByEmail: string;
  teamName: string;
  inviteLink: string;
}) {
  const { email, invitedByUsername, invitedByEmail, teamName, inviteLink } =
    args;
  const inviter = invitedByUsername
    ? `${invitedByUsername} (${invitedByEmail})`
    : invitedByEmail;

  const subject = `You've been invited to join ${teamName}`;
  const text = `${inviter} invited you to join ${teamName}.\n\nAccept the invitation: ${inviteLink}\n\nIf you weren't expecting this, you can ignore this email.`;
  const html = `
    <div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; max-width: 440px; margin: 0 auto; color: #374151;">
      <h2 style="font-weight: 600; color: #6b7280;">You've been invited</h2>
      <p><strong>${inviter}</strong> invited you to join <strong>${teamName}</strong>.</p>
      <p style="margin: 24px 0;">
        <a href="${inviteLink}"
           style="display: inline-block; padding: 10px 16px; border: 1px solid #d1d5db; text-decoration: none; color: #111827;">
          Accept invitation
        </a>
      </p>
      <p style="font-size: 12px; color: #9ca3af;">
        Or paste this link into your browser:<br />
        <a href="${inviteLink}" style="color: #6b7280;">${inviteLink}</a>
      </p>
      <p style="font-size: 12px; color: #9ca3af;">
        If you weren't expecting this, you can ignore this email.
      </p>
    </div>
  `;

  await send({ to: email, subject, html, text });
}
