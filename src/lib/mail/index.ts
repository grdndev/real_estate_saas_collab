import { env } from "@/lib/env";

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.info(
      [
        "",
        "📧 [DEV MAIL — non envoyé en production]",
        `   To:      ${message.to}`,
        `   Subject: ${message.subject}`,
        "   ---",
        message.text,
        "",
      ].join("\n"),
    );
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
          email: env.EMAIL_FROM ?? "no-reply@equatis.fr",
          name: env.EMAIL_FROM_NAME ?? "Équatis",
        },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
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
