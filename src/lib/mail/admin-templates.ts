import { env } from "@/lib/env";
import type { MailMessage } from "@/lib/mail";

const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Administrateur",
  COLLABORATOR: "Collaborateur",
  PROMOTER: "Promoteur",
  NOTARY: "Notaire",
};

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
      Cet email a été envoyé automatiquement par la plateforme Équatis.
    </p>
  </div>
</body></html>`;

export function invitationMail(
  to: string,
  firstName: string,
  role: string,
  token: string,
): MailMessage {
  const link = `${baseUrl}/reinitialisation?token=${encodeURIComponent(token)}&from=invitation`;
  const roleLabel = ROLE_LABEL[role] ?? role;
  const text =
    `Bonjour ${firstName},\n\n` +
    `Vous avez été invité(e) sur la plateforme Équatis avec le rôle « ${roleLabel} ». ` +
    `Définissez votre mot de passe en suivant ce lien (valable 7 jours) :\n\n${link}\n\n` +
    `Une fois le mot de passe défini, vous pourrez vous connecter à votre espace.`;
  const html = wrapHtml(
    "Vous êtes invité(e) sur Équatis",
    `<p style="color:#1B2A4A; font-size:14px;">Bonjour ${firstName},</p>
     <p style="color:#475569; font-size:14px;">Un administrateur Équatis vous a créé un compte avec le rôle <strong>${roleLabel}</strong>.</p>
     <p style="color:#475569; font-size:14px;">Pour activer votre compte, cliquez sur le bouton ci-dessous (lien valable 7 jours) :</p>
     <p style="text-align:center; margin:24px 0;"><a href="${link}" style="background:#1B2A4A; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-size:14px; font-weight:500;">Définir mon mot de passe</a></p>
     <p style="color:#94a3b8; font-size:12px;">Ou copiez ce lien dans votre navigateur :<br>${link}</p>`,
  );
  return {
    to,
    subject: "Invitation à la plateforme Équatis",
    html,
    text,
  };
}
