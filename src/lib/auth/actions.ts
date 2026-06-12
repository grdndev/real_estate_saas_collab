"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { encrypt } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { getMailer } from "@/lib/mail";
import {
  emailVerificationMail,
  passwordResetMail,
  welcomeMail,
} from "@/lib/mail/templates";
import { generateOpaqueToken } from "@/lib/auth/tokens";
import { hashToken } from "@/lib/crypto";
import { getRequestContext } from "@/lib/request-context";
import { notify } from "@/lib/notifications";
import {
  loginSchema,
  signupSchema,
  resetRequestSchema,
  resetApplySchema,
  type LoginInput,
  type SignupInput,
  type ResetRequestInput,
  type ResetApplyInput,
} from "@/lib/auth/schemas";
import { homePathFor } from "@/lib/auth/rbac";
import { env } from "@/lib/env";

function flatten(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

// =====================================================
// Types de retour
// =====================================================

export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// =====================================================
// LOGIN
// =====================================================

export async function loginAction(
  input: LoginInput,
): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const { email, password, from, remember } = parsed.data;
  const ctx = await getRequestContext();
  const h = await headers();
  const reqMeta = {
    host: h.get("host"),
    forwardedHost: h.get("x-forwarded-host"),
    forwardedProto: h.get("x-forwarded-proto"),
    forwardedPort: h.get("x-forwarded-port"),
    origin: h.get("origin"),
    referer: h.get("referer"),
    userAgent: h.get("user-agent"),
    hasCookie: !!h.get("cookie"),
  };

  // Trace de tentative (avant l'évaluation du mot de passe).
  await prisma.loginAttempt.create({
    data: {
      email,
      ip: ctx.ip ?? "unknown",
      userAgent: ctx.userAgent,
      success: false, // sera remis à jour si succès via audit
    },
  });

  const user = await prisma.user.findUnique({ where: { email } });

  // Re-fetch user pour la redirection ciblée par rôle.
  if (!user || user.deletedAt) {
    return { ok: false, error: "Compte introuvable" };
  }

  if (user.status === "PENDING_EMAIL") {
    return {
      ok: false,
      error:
        "Votre adresse email n'est pas encore vérifiée. Veuillez vérifier votre boîte de réception.",
    };
  }

  if (user.status === "PENDING_ASSOCIATION") {
    return {
      ok: false,
      error:
        "Votre compte est en attente d'association à une entité. Veuillez contacter le support.",
    };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      remember,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      await audit({
        action: "USER_LOGIN_FAILED",
        resourceType: "User",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        metadata: { email },
      });
      return { ok: false, error: "Email ou mot de passe incorrect." };
    }
    throw err;
  }

  await audit({
    userId: user.id,
    action: "USER_LOGIN",
    resourceType: "User",
    resourceId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  // Si "from" pointe vers une URL légitime, on s'y rend ; sinon, dashboard du rôle.
  const dest =
    from && from.startsWith("/") && !from.startsWith("//")
      ? from
      : homePathFor(user.role);
  return { ok: true, value: { redirectTo: dest } };
}

// =====================================================
// SIGNUP CLIENT
// =====================================================

export async function signupClientAction(
  input: SignupInput,
): Promise<ActionResult<{ email: string }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const data = parsed.data;
  const ctx = await getRequestContext();

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  // On ne révèle JAMAIS si l'email existe déjà (anti-énumération).
  // On envoie quand même la réponse positive pour ne pas leaker d'information.
  if (existing) {
    return { ok: true, value: { email: data.email } };
  }

  const passwordHash = await hashPassword(data.password);
  const phoneEnc = encrypt(data.phone);
  const addressEnc = encrypt(
    JSON.stringify({
      line: data.addressLine,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country,
    }),
  );

  const user = await prisma.user.create({
    data: {
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      passwordHash,
      phoneEnc,
      addressEnc,
      role: "CLIENT",
      status: "PENDING_EMAIL",
    },
  });

  await audit({
    userId: user.id,
    action: "USER_CREATED",
    resourceType: "User",
    resourceId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { role: "CLIENT", via: "self_signup" },
  });

  const { token, hash } = generateOpaqueToken();
  await prisma.emailVerification.create({
    data: {
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
    },
  });

  try {
    await getMailer().send(
      emailVerificationMail(user.email, user.firstName, token),
    );
  } catch (error) {
    console.error("Failed to send verification email", user.email, { error });
    return {
      ok: false,
      error: "Une erreur est survenue. Veuillez réessayer plus tard.",
    };
  }

  return { ok: true, value: { email: user.email } };
}

// =====================================================
// EMAIL VERIFICATION
// =====================================================

export async function verifyEmailAction(
  rawToken: string,
): Promise<ActionResult> {
  if (!rawToken || rawToken.length < 16) {
    return { ok: false, error: "Lien invalide" };
  }
  const tokenHash = hashToken(rawToken);
  const verification = await prisma.emailVerification.findUnique({
    where: { tokenHash },
  });

  if (!verification || verification.verifiedAt) {
    return { ok: false, error: "Lien invalide ou déjà utilisé" };
  }
  if (verification.expiresAt < new Date()) {
    return { ok: false, error: "Lien expiré. Demandez un nouveau lien." };
  }

  const ctx = await getRequestContext();
  const user = await prisma.user.update({
    where: { id: verification.userId },
    data: {
      emailVerifiedAt: new Date(),
      status: "PENDING_ASSOCIATION",
    },
  });

  await prisma.emailVerification.update({
    where: { id: verification.id },
    data: { verifiedAt: new Date() },
  });

  const staff = await prisma.user.findMany({
    where: {
      role: { in: ["SUPER_ADMIN", "COLLABORATOR"] },
      status: "ACTIVE",
    },
    select: { id: true },
  });
  await Promise.all(
    staff.map((u) =>
      notify({
        userId: u.id,
        kind: "NEW_LEAD",
        title: "Nouveau prospect",
        body: `${user.firstName} ${user.lastName} est en attente d'association.`,
        link: "/collaborateur",
      }),
    ),
  );

  await getMailer().send(welcomeMail(user.email, user.firstName));

  await audit({
    userId: user.id,
    action: "USER_UPDATED",
    resourceType: "User",
    resourceId: user.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { transition: "PENDING_EMAIL→PENDING_ASSOCIATION" },
  });

  return { ok: true, value: undefined };
}

// =====================================================
// PASSWORD RESET — DEMANDE
// =====================================================

export async function requestPasswordResetAction(
  input: ResetRequestInput,
): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const { email } = parsed.data;
  const ctx = await getRequestContext();

  const user = await prisma.user.findUnique({ where: { email } });
  // Réponse identique que l'email existe ou non (anti-énumération).
  if (user && !user.deletedAt) {
    await audit({
      userId: user.id,
      action: "USER_PASSWORD_CHANGED",
      resourceType: "User",
      resourceId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { step: "reset_requested" },
    });

    const { token, hash } = generateOpaqueToken();
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + 2 * 60 * 60_000),
      },
    });

    try {
      await getMailer().send(
        passwordResetMail(user.email, user.firstName, token),
      );
    } catch (error) {
      console.error("Failed to send password reset email", user.email, {
        error,
      });
      return {
        ok: false,
        error:
          "Une erreur est survenue lors de l'envoi de l'email. Veuillez réessayer plus tard.",
      };
    }
  }
  return { ok: true, value: undefined };
}

// =====================================================
// PASSWORD RESET — APPLICATION
// =====================================================

export async function applyPasswordResetAction(
  input: ResetApplyInput,
): Promise<ActionResult> {
  const parsed = resetApplySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Saisie invalide",
      fieldErrors: flatten(parsed.error),
    };
  }
  const { token, password } = parsed.data;
  const ctx = await getRequestContext();

  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!reset || reset.usedAt) {
    return { ok: false, error: "Lien invalide ou déjà utilisé" };
  }
  if (reset.expiresAt < new Date()) {
    return { ok: false, error: "Lien expiré" };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: reset.userId },
    data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
  });
  await prisma.passwordReset.update({
    where: { id: reset.id },
    data: { usedAt: new Date() },
  });
  // Révocation des sessions actives.
  await prisma.session.updateMany({
    where: { userId: reset.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await audit({
    userId: reset.userId,
    action: "USER_PASSWORD_CHANGED",
    resourceType: "User",
    resourceId: reset.userId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    metadata: { step: "reset_applied" },
  });

  return { ok: true, value: undefined };
}

// =====================================================
// LOGOUT
// =====================================================

export async function logoutAction(): Promise<never> {
  const ctx = await getRequestContext();
  await audit({
    action: "USER_LOGOUT",
    resourceType: "User",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  await signOut({ redirect: false });
  redirect("/connexion");
}

// "env" est conservé pour expansion future (politiques côté serveur).
void env;
