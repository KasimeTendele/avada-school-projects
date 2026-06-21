// Envoi d'emails via SMTP depuis les Edge Functions Deno.
// Utilise denomailer (https://deno.land/x/denomailer) qui supporte
// SMTP/SMTPS/STARTTLS et l'authentification LOGIN/PLAIN.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

function readSmtpConfig() {
  const host = Deno.env.get("SMTP_HOST");
  const portStr = Deno.env.get("SMTP_PORT");
  const user = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASSWORD");
  const from = Deno.env.get("SMTP_FROM");
  if (!host || !portStr || !user || !password || !from) {
    throw new Error(
      "Missing SMTP configuration (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM)",
    );
  }
  const port = Number(portStr);
  // 465 = SMTPS (TLS implicite), 587/25 = STARTTLS
  const implicitTls = port === 465;
  return { host, port, user, password, from, implicitTls };
}

export async function sendMail(input: MailInput): Promise<void> {
  const cfg = readSmtpConfig();
  const client = new SMTPClient({
    connection: {
      hostname: cfg.host,
      port: cfg.port,
      tls: cfg.implicitTls,
      auth: { username: cfg.user, password: cfg.password },
    },
  });
  try {
    await client.send({
      from: cfg.from,
      to: input.to,
      subject: input.subject,
      content: input.text ?? "Veuillez consulter cet email au format HTML.",
      html: input.html,
    });
  } finally {
    await client.close().catch(() => undefined);
  }
}