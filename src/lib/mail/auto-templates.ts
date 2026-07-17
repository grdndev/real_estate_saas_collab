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
      Cet email a été envoyé automatiquement par la plateforme Équatis.
    </p>
  </div>
</body></html>`;

function button(label: string, href: string): string {
  return `<p style="text-align:center; margin:24px 0;"><a href="${href}" style="background:#1B2A4A; color:#fff; padding:12px 24px; text-decoration:none; border-radius:6px; font-size:14px; font-weight:500;">${label}</a></p>`;
}

// CDC §8.5 — Association au dossier
export function dossierAssociatedMail(
  to: string,
  firstName: string,
  reference: string,
): MailMessage {
  const link = `${baseUrl}/client`;
  return {
    to,
    subject: "Votre dossier Équatis est prêt",
    text: `Bonjour ${firstName},\n\nVotre dossier ${reference} a été créé. Vous pouvez consulter son avancement sur votre espace : ${link}`,
    html: wrapHtml(
      "Votre dossier est prêt",
      `<p style="color:#1B2A4A;">Bonjour ${firstName},</p>
       <p style="color:#475569; font-size:14px;">Votre dossier <strong>${reference}</strong> a été créé. Vous pouvez consulter son avancement sur votre espace personnel.</p>
       ${button("Accéder à mon dossier", link)}`,
    ),
  };
}

// CDC §8.5 — Nouveau document disponible (collaborateur → client)
export function newDocumentMail(
  to: string,
  firstName: string,
  fileName: string,
): MailMessage {
  const link = `${baseUrl}/client/documents`;
  return {
    to,
    subject: "Un document a été partagé avec vous",
    text: `Bonjour ${firstName},\n\nVotre collaborateur Équatis vous a partagé : ${fileName}\nLien : ${link}`,
    html: wrapHtml(
      "Nouveau document disponible",
      `<p style="color:#1B2A4A;">Bonjour ${firstName},</p>
       <p style="color:#475569; font-size:14px;">Votre collaborateur Équatis vous a transmis un nouveau document : <strong>${fileName}</strong>.</p>
       ${button("Voir mes documents", link)}`,
    ),
  };
}

// CDC §8.5 — Pièce déposée par le client (notification collaborateur)
export function pieceDepositedMail(
  to: string,
  firstName: string,
  reference: string,
  fileName: string,
): MailMessage {
  const link = `${baseUrl}/collaborateur/dossiers`;
  return {
    to,
    subject: `[${reference}] Une pièce a été déposée`,
    text: `Bonjour ${firstName},\n\nLe client a déposé "${fileName}" sur le dossier ${reference}.\nLien : ${link}`,
    html: wrapHtml(
      "Pièce déposée par le client",
      `<p style="color:#1B2A4A;">Bonjour ${firstName},</p>
       <p style="color:#475569; font-size:14px;">Le client a déposé <strong>${fileName}</strong> sur le dossier <strong>${reference}</strong>.</p>
       ${button("Ouvrir le dossier", link)}`,
    ),
  };
}

// CDC §8.5 — Relance dossier (cron auto)
export function dossierRelaunchMail(
  to: string,
  firstName: string,
  reference: string,
  daysSinceLastActivity: number,
): MailMessage {
  const link = `${baseUrl}/collaborateur/dossiers`;
  return {
    to,
    subject: `[Relance] Le dossier ${reference} est inactif depuis ${daysSinceLastActivity} jours`,
    text: `Bonjour ${firstName},\n\nLe dossier ${reference} n'a pas eu d'activité depuis ${daysSinceLastActivity} jours. Pensez à relancer le client si nécessaire.\nLien : ${link}`,
    html: wrapHtml(
      "Dossier inactif",
      `<p style="color:#1B2A4A;">Bonjour ${firstName},</p>
       <p style="color:#475569; font-size:14px;">Le dossier <strong>${reference}</strong> n'a pas eu d'activité depuis <strong>${daysSinceLastActivity} jours</strong>. Pensez à relancer le client si nécessaire.</p>
       ${button("Voir mes dossiers", link)}`,
    ),
  };
}

// Relance manuelle d'un notaire par un collaborateur
export function notaryRelaunchMail(
  to: string,
  firstName: string,
  reference: string,
  programmeName: string,
  daysSinceTransmission: number,
  comment?: string,
): MailMessage {
  const link = `${baseUrl}/notaire`;
  const sinceLabel =
    daysSinceTransmission <= 1
      ? "moins de 24h"
      : `${daysSinceTransmission} jours`;
  const text =
    `Bonjour Maître ${firstName},\n\n` +
    `Le collaborateur Équatis vous relance concernant le dossier ${reference} ` +
    `(programme ${programmeName}), transmis depuis ${sinceLabel}.\n\n` +
    (comment ? `Message du collaborateur :\n${comment}\n\n` : "") +
    `Merci de traiter ce dossier dès que possible.\n\nLien direct : ${link}`;
  const html = wrapHtml(
    `Relance — dossier ${reference}`,
    `<p style="color:#1B2A4A;">Bonjour Maître ${firstName},</p>
     <p style="color:#475569; font-size:14px;">Le collaborateur Équatis vous relance concernant le dossier <strong>${reference}</strong> (programme ${programmeName}), transmis depuis <strong>${sinceLabel}</strong>.</p>
     ${
       comment
         ? `<div style="margin:16px 0; padding:12px 16px; background:#f8fafc; border-left:3px solid #0FB8A9; border-radius:4px;">
              <p style="color:#1B2A4A; font-size:13px; margin:0 0 4px;"><strong>Message du collaborateur :</strong></p>
              <p style="color:#475569; font-size:14px; margin:0; white-space:pre-line;">${comment.replace(/</g, "&lt;")}</p>
            </div>`
         : ""
     }
     <p style="color:#475569; font-size:14px;">Merci de traiter ce dossier dès que possible.</p>
     ${button("Ouvrir le dossier", link)}`,
  );
  return {
    to,
    subject: `[Relance Équatis] Dossier ${reference} en attente`,
    html,
    text,
  };
}

// CDC §8.5 — Transmission notaire (récap)
export function transmittedToNotaryMail(
  to: string,
  firstName: string,
  reference: string,
  programmeName: string,
  attachmentCount = 0,
): MailMessage {
  const link = `${baseUrl}/notaire`;
  const attachmentNote =
    attachmentCount > 0
      ? `\nVous trouverez ${attachmentCount} document(s) en pièce(s) jointe(s) de cet email.`
      : "";
  const attachmentHtml =
    attachmentCount > 0
      ? `<p style="color:#475569; font-size:14px;">Vous trouverez <strong>${attachmentCount} document(s)</strong> en pièce(s) jointe(s) de cet email.</p>`
      : "";
  return {
    to,
    subject: `[Équatis] Nouveau dossier transmis : ${reference}`,
    text: `Bonjour ${firstName},\n\nLe dossier ${reference} (${programmeName}) vous a été transmis pour traitement.${attachmentNote}\nLien : ${link}`,
    html: wrapHtml(
      "Nouveau dossier transmis",
      `<p style="color:#1B2A4A;">Bonjour ${firstName},</p>
       <p style="color:#475569; font-size:14px;">Le dossier <strong>${reference}</strong> (programme ${programmeName}) vous a été transmis. Tous les documents sont accessibles sur votre espace.</p>
       ${attachmentHtml}
       ${button("Ouvrir mes dossiers", link)}`,
    ),
  };
}

// Retransmission de documents à un notaire déjà assigné (email avec PJ).
export function documentsTransmittedToNotaryMail(
  to: string,
  firstName: string,
  reference: string,
  programmeName: string,
  attachmentCount: number,
  comment?: string,
): MailMessage {
  const link = `${baseUrl}/notaire`;
  const text =
    `Bonjour Maître ${firstName},\n\n` +
    `${attachmentCount} document(s) du dossier ${reference} (programme ${programmeName}) ` +
    `vous sont transmis en pièce(s) jointe(s) de cet email.\n\n` +
    (comment ? `Message du collaborateur :\n${comment}\n\n` : "") +
    `Lien direct : ${link}`;
  const html = wrapHtml(
    `Documents transmis — dossier ${reference}`,
    `<p style="color:#1B2A4A;">Bonjour Maître ${firstName},</p>
     <p style="color:#475569; font-size:14px;"><strong>${attachmentCount} document(s)</strong> du dossier <strong>${reference}</strong> (programme ${programmeName}) vous sont transmis en pièce(s) jointe(s) de cet email.</p>
     ${
       comment
         ? `<div style="margin:16px 0; padding:12px 16px; background:#f8fafc; border-left:3px solid #0FB8A9; border-radius:4px;">
              <p style="color:#1B2A4A; font-size:13px; margin:0 0 4px;"><strong>Message du collaborateur :</strong></p>
              <p style="color:#475569; font-size:14px; margin:0; white-space:pre-line;">${comment.replace(/</g, "&lt;")}</p>
            </div>`
         : ""
     }
     ${button("Ouvrir mes dossiers", link)}`,
  );
  return {
    to,
    subject: `[Équatis] Documents transmis : dossier ${reference}`,
    html,
    text,
  };
}

// CDC §8.5 — Signature électronique complétée (notification collaborateur)
export function signatureCompletedCollaboratorMail(
  to: string,
  firstName: string,
  reference: string,
  dossierId: string,
): MailMessage {
  const link = `${baseUrl}/collaborateur/dossiers/${dossierId}`;
  return {
    to,
    subject: `[${reference}] Document signé électroniquement`,
    text: `Bonjour ${firstName},\n\nLe document du dossier ${reference} a été signé électroniquement. Le document signé est disponible sur le dossier.\nLien : ${link}`,
    html: wrapHtml(
      "Document signé",
      `<p style="color:#1B2A4A;">Bonjour ${firstName},</p>
       <p style="color:#475569; font-size:14px;">Le document du dossier <strong>${reference}</strong> a été signé électroniquement via Yousign. Le document signé est disponible sur le dossier.</p>
       ${button("Ouvrir le dossier", link)}`,
    ),
  };
}

// CDC §8.5 — Signature électronique complétée (notification client)
export function signatureCompletedClientMail(
  to: string,
  firstName: string,
  reference: string,
): MailMessage {
  const link = `${baseUrl}/client`;
  return {
    to,
    subject: "Votre document a été signé",
    text: `Bonjour ${firstName},\n\nVotre document du dossier ${reference} a été signé électroniquement. Vous pouvez le consulter sur votre espace.\nLien : ${link}`,
    html: wrapHtml(
      "Votre document est signé",
      `<p style="color:#1B2A4A;">Bonjour ${firstName},</p>
       <p style="color:#475569; font-size:14px;">Votre document pour le dossier <strong>${reference}</strong> a été signé électroniquement. Vous pouvez le consulter sur votre espace personnel.</p>
       ${button("Accéder à mon espace", link)}`,
    ),
  };
}

// CDC §8.5 — Acte prêt
export function actReadyMail(
  to: string,
  firstName: string,
  reference: string,
): MailMessage {
  const link = `${baseUrl}/client`;
  return {
    to,
    subject: "Votre acte de vente est signé",
    text: `Bonjour ${firstName},\n\nVotre acte de vente pour le dossier ${reference} a été signé chez le notaire. Félicitations !\nLien : ${link}`,
    html: wrapHtml(
      "Votre acte est signé",
      `<p style="color:#1B2A4A;">Bonjour ${firstName},</p>
       <p style="color:#475569; font-size:14px;">L'acte de vente pour votre dossier <strong>${reference}</strong> a été signé chez le notaire. Félicitations pour votre acquisition !</p>
       ${button("Accéder à mon dossier", link)}`,
    ),
  };
}
