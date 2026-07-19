/**
 * Test end-to-end Yousign sandbox.
 *
 * Crée une procédure, upload un PDF placeholder, ajoute un champ signature,
 * active → le signataire reçoit un email Yousign.
 *
 * Usage :
 *   npx tsx scripts/test-yousign.ts <signer-email>
 * Exemple :
 *   npx tsx scripts/test-yousign.ts test@example.com
 */

import "dotenv/config";
import {
  activateSignatureRequest,
  addSignatureField,
  createSignatureRequest,
  uploadDocument,
} from "../src/lib/yousign/client";
import { generatePlaceholderPdf } from "../src/lib/storage/pdf-placeholder";

async function main() {
  const signerEmail = process.argv[2];
  if (!signerEmail || !signerEmail.includes("@")) {
    console.error("Usage : npx tsx scripts/test-yousign.ts <signer-email>");
    process.exit(1);
  }

  console.log("🧪 Test Yousign sandbox");
  console.log(`   Signataire : ${signerEmail}\n`);

  // 1. PDF placeholder
  const pdf = generatePlaceholderPdf({
    programmeName: "Résidence Antarès",
    lotReference: "A102",
    signerName: "Test Signataire",
  });
  console.log(`✓ PDF généré (${pdf.length} octets)`);

  // 2. Créer procédure
  console.log("→ POST /signature_requests…");
  const procedure = await createSignatureRequest("Équatis — Test signature", {
    firstName: "Test",
    lastName: "Signataire",
    email: signerEmail,
  });
  console.log(
    `✓ Procédure créée : ${procedure.id} (status: ${procedure.status})`,
  );
  const signerId = procedure.signers?.[0]?.id;
  if (!signerId) {
    throw new Error("Aucun signer_id renvoyé par Yousign");
  }
  console.log(`  Signer ID : ${signerId}`);

  // 3. Upload PDF
  console.log("→ POST /signature_requests/.../documents…");
  const doc = await uploadDocument(procedure.id, "test_signature.pdf", pdf);
  console.log(`✓ Document uploadé : ${doc.id}`);

  // 4. Ajouter champ signature
  console.log("→ POST /signature_requests/.../documents/.../fields…");
  try {
    await addSignatureField(procedure.id, doc.id, signerId);
    console.log("✓ Champ signature ajouté");
  } catch (err) {
    console.warn(
      `⚠ Échec ajout champ : ${err instanceof Error ? err.message : err}`,
    );
  }

  // 5. Activer
  console.log("→ POST /signature_requests/.../activate…");
  await activateSignatureRequest(procedure.id);
  console.log("✓ Procédure activée — Yousign envoie l'email maintenant\n");

  console.log("🎉 Succès !");
  console.log(`   Email parti vers : ${signerEmail}`);
  console.log(`   Procedure ID : ${procedure.id}`);
  console.log("   Connectez-vous au dashboard Yousign pour vérifier.");
}

main().catch((err) => {
  console.error("❌ Échec :", err);
  process.exit(1);
});
