import { env } from "@/lib/env";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ name: string; content: string }>;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    const lines = [
      "",
      "📧 [DEV MAIL — non envoyé en production]",
      `   To:      ${message.to}`,
      `   Subject: ${message.subject}`,
      "   ---",
      message.text,
    ];
    if (message.attachments?.length) {
      lines.push(
        `   Pièces jointes: ${message.attachments.map((a) => a.name).join(", ")}`,
      );
    }
    lines.push("");
    console.info(lines.join("\n"));
  }
}

class BrevoMailer implements Mailer {
  constructor(private readonly apiKey: string) {}

  async send(message: MailMessage): Promise<void> {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": this.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: env.EMAIL_FROM ?? "no-reply@equatisimmobilier.fr",
          name: env.EMAIL_FROM_NAME ?? "Équatis",
        },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
        ...(message.attachments?.length
          ? {
              attachment: message.attachments.map((a) => ({
                content: a.content,
                name: a.name,
              })),
            }
          : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Échec envoi Brevo (${response.status}) : ${body.slice(0, 200)}`,
      );
    }
  }
}

export function getMailer(): Mailer {
  if (env.BREVO_API_KEY) {
    return new BrevoMailer(env.BREVO_API_KEY);
  }
  return new ConsoleMailer();
}
