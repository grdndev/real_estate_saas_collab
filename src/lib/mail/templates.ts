import { env } from "@/lib/env";
import type { MailMessage } from "@/lib/mail";

const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

const wrapHtml = (title: string, body: string) => `
<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: Inter, system-ui, sans-serif; background:#F8F9FA; padding:24px;">
  <div style="max-width:560px; margin:0 auto; background:#fff; border-radius:12px; padding:32px; border:1px solid #e2e6eb;">
    <p style="color:#0FB8A9; font-size:12px; letter-spacing:2px; text-transform:uppercase; margin:0;">Équatis</p>
    <h1 style="color:#1B2A4A; font-size:20px; margin:8px 0 16px;">${title}</h1>
    ${body}
    <hr style="border:none; border-top:1px solid #e2e6eb; margin:24px 0;">
    <p style="color:#64748b; font-size:12px; margin:0;">
      Cet email a été envoyé automatiquement par la plateforme Équatis.<br>
      Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.
    </p>
  </div>
</body></html>`;

export function emailVerificationMail(
  to: string,
  firstName: string,
  token: string,
): MailMessage {
  const link = `${baseUrl}/verifier-email?token=${encodeURIComponent(token)}`;
  const text =
    `Bonjour ${firstName},\n\n` +
    `Bienvenue sur Équatis. Pour activer votre compte, ouvrez le lien suivant (valable 24h) :\n\n` +
    `${link}\n\n` +
    `Si vous n'êtes pas à l'origine de cette inscription, ignorez ce message.`;
  const html = wrapHtml(
    "Confirmez votre adresse email",
    `<p style="color:#1B2A4A; font-size:14px;">Bonjour ${firstName},</p>
     <p style="color:#475569; font-size:14px;">Pour activer votre compte Équatis, cliquez sur le bouton ci-dessous (lien valable 24h) :</p>
     <p style="text-align:center; margin:24px 0;"><a href="${link}" style="background:#1B2A4A; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-size:14px; font-weight:500;">Activer mon compte</a></p>
     <p style="color:#94a3b8; font-size:12px;">Ou copiez ce lien dans votre navigateur :<br>${link}</p>`,
  );
  return {
    to,
    subject: "Activez votre compte Équatis",
    html,
    text,
  };
}

export function passwordResetMail(
  to: string,
  firstName: string,
  token: string,
): MailMessage {
  const link = `${baseUrl}/reinitialisation?token=${encodeURIComponent(token)}`;
  const text =
    `Bonjour ${firstName},\n\n` +
    `Une réinitialisation de mot de passe a été demandée pour votre compte Équatis. ` +
    `Le lien suivant est valable 2 heures :\n\n${link}\n\n` +
    `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`;
  const html = wrapHtml(
    "Réinitialisation de votre mot de passe",
    `<p style="color:#1B2A4A; font-size:14px;">Bonjour ${firstName},</p>
     <p style="color:#475569; font-size:14px;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous (lien valable 2h) :</p>
     <p style="text-align:center; margin:24px 0;"><a href="${link}" style="background:#1B2A4A; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-size:14px; font-weight:500;">Choisir un nouveau mot de passe</a></p>
     <p style="color:#94a3b8; font-size:12px;">Ou copiez ce lien dans votre navigateur :<br>${link}</p>`,
  );
  return {
    to,
    subject: "Réinitialisation de votre mot de passe",
    html,
    text,
  };
}

export function welcomeMail(to: string, firstName: string): MailMessage {
  const link = `${baseUrl}/connexion`;
  const text =
    `Bonjour ${firstName},\n\n` +
    `Votre adresse email est confirmée. Votre compte Équatis est en attente d'association à un dossier ` +
    `par votre collaborateur référent. Vous serez notifié(e) dès qu'il sera prêt.\n\n` +
    `Connexion : ${link}`;
  const html = wrapHtml(
    "Bienvenue sur Équatis",
    `<p style="color:#1B2A4A; font-size:14px;">Bonjour ${firstName},</p>
     <p style="color:#475569; font-size:14px;">Votre adresse email est confirmée. Votre compte est en attente d'association à un dossier par votre collaborateur référent. Vous serez notifié(e) dès qu'il sera prêt.</p>
     <p style="text-align:center; margin:24px 0;"><a href="${link}" style="background:#1B2A4A; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-size:14px; font-weight:500;">Accéder à mon compte</a></p>`,
  );
  return {
    to,
    subject: "Bienvenue sur Équatis",
    html,
    text,
  };
}
