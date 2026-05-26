/**
 * Génère un PDF minimal en pur JS (sans dépendance externe).
 * Utilisé quand on déclenche une signature sans qu'un PDF spécifique
 * n'ait été uploadé sur le dossier — typiquement pour la démo.
 *
 * Le PDF contient :
 *   - Le nom du programme
 *   - La référence du dossier
 *   - Le lot
 *   - Une mention "À signer électroniquement"
 *
 * Format : PDF 1.4 minimal valide (1 page A4).
 */
export function generatePlaceholderPdf(args: {
  dossierReference: string;
  programmeName: string;
  lotReference?: string | null;
  signerName: string;
  date?: Date;
}): Buffer {
  const now = args.date ?? new Date();
  const formattedDate = now.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Échappement minimal pour les strings PDF (parenthèses, backslash).
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const lines = [
    "EQUATIS — DOCUMENT A SIGNER",
    "",
    `Dossier        : ${args.dossierReference}`,
    `Programme      : ${args.programmeName}`,
    args.lotReference ? `Lot            : ${args.lotReference}` : null,
    `Signataire     : ${args.signerName}`,
    `Date           : ${formattedDate}`,
    "",
    "Document genere automatiquement par la plateforme Equatis",
    "pour signature electronique via Yousign.",
    "",
    "En signant ce document, vous reconnaissez avoir pris",
    "connaissance des informations ci-dessus et acceptez",
    "les termes presentes.",
    "",
    "",
    "Signature :",
  ].filter((line): line is string => line !== null);

  // Construit le contenu de stream PDF : Tj pour chaque ligne, Td pour passer
  // à la ligne suivante (-16 unités sur Y).
  const streamParts: string[] = [
    "BT", // Begin text
    "/F1 12 Tf", // Police F1 taille 12
    "72 770 Td", // Position initiale (marge gauche, près du haut)
  ];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) streamParts.push("0 -18 Td"); // descend de 18 pour la ligne suivante
    const line = lines[i] ?? "";
    streamParts.push(`(${esc(line)}) Tj`);
  }
  streamParts.push("ET"); // End text
  const stream = streamParts.join("\n");

  const streamLength = Buffer.byteLength(stream, "latin1");

  // Objets PDF
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 =
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n";
  const obj4 = `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}\nendstream\nendobj\n`;
  const obj5 =
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n";

  // En-tête + corps
  const header = "%PDF-1.4\n%âãÏÓ\n";
  const body = obj1 + obj2 + obj3 + obj4 + obj5;

  // Calcul des offsets pour la xref
  const offsets: number[] = [];
  let cursor = Buffer.byteLength(header, "latin1");
  for (const obj of [obj1, obj2, obj3, obj4, obj5]) {
    offsets.push(cursor);
    cursor += Buffer.byteLength(obj, "latin1");
  }

  // Table xref (5 objets + entrée 0)
  const xref =
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets.map((o) => `${o.toString().padStart(10, "0")} 00000 n \n`).join("");

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF\n`;

  return Buffer.from(header + body + xref + trailer, "latin1");
}
