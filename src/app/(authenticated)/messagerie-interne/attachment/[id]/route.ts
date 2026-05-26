import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { presignDownloadUrl } from "@/lib/storage/s3";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, ctx: RouteContext) {
  const me = await requireUser();
  const { id } = await ctx.params;

  const message = await prisma.directMessage.findUnique({ where: { id } });
  if (!message || !message.attachmentKey) {
    return new Response("Document introuvable", { status: 404 });
  }
  // Seuls l'expéditeur et le destinataire peuvent télécharger la pièce jointe.
  if (message.senderId !== me.id && message.recipientId !== me.id) {
    return new Response("Accès refusé", { status: 403 });
  }

  const url = await presignDownloadUrl(
    message.attachmentKey,
    message.attachmentName ?? "document",
  );
  redirect(url);
}
