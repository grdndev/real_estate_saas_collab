import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { mapYousignEvent } from "@/lib/yousign/client";
import { notifySignatureUpdate } from "@/lib/yousign/actions";

export async function POST(request: Request) {
  if (!env.YOUSIGN_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook non configuré" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("x-yousign-signature-256");
  const rawBody = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 401 });
  }

  // Yousign utilise HMAC-SHA256 sur le corps brut.
  const computed =
    "sha256=" +
    createHmac("sha256", env.YOUSIGN_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

  const provided = Buffer.from(signature);
  const expected = Buffer.from(computed);
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }

  let payload: {
    event_name?: string;
    data?: { signature_request?: { id?: string } };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const eventName = payload.event_name;
  const procedureId = payload.data?.signature_request?.id;
  if (!eventName || !procedureId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const newStatus = mapYousignEvent(eventName);
  if (!newStatus) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    await notifySignatureUpdate(
      procedureId,
      newStatus as "SENT" | "OPENED" | "SIGNED" | "REFUSED" | "EXPIRED",
    );
  } catch (err) {
    console.error("[yousign webhook]", err);
    return NextResponse.json({ error: "Traitement échoué" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
