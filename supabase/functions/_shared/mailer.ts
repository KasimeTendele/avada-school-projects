// Envoi d'emails via SMTP depuis les Edge Functions Deno.
// Utilise nodemailer (via npm:) qui gère correctement EHLO/STARTTLS/AUTH
// pour la plupart des serveurs SMTP, contrairement à denomailer qui
// échoue avec "invalid cmd" sur certains serveurs.
import nodemailer from "npm:nodemailer@6.9.14";

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
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.implicitTls, // true pour 465, false pour 587/25 (STARTTLS auto)
    auth: { user: cfg.user, pass: cfg.password },
  });
  try {
    await transporter.sendMail({
      from: cfg.from,
      to: input.to,
      subject: input.subject,
      text: input.text ?? "Veuillez consulter cet email au format HTML.",
      html: input.html,
    });
  } finally {
    transporter.close();
  }
}