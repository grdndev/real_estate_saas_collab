/**
 * Lecture du CSV d'import de prospects (Google Forms et export équivalent).
 *
 * Module pur, sans « use server » : il est appelé par `importProspectsAction`
 * et couvert directement par des tests unitaires.
 */

/**
 * Ligne d'import CSV (T2) : nom, prénom, téléphone et email uniquement.
 * La commune n'est plus reprise du fichier ; elle reste saisissable à la main
 * sur la fiche du prospect.
 */
export interface ImportRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export function parseCsv(csv: string): ImportRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headerLine = lines[0]!;
  const header = headerLine
    .split(/[,;]/)
    .map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));

  function findIdx(...names: string[]): number {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const idxFirst = findIdx("prénom", "prenom", "first name", "firstname");
  const idxLast = findIdx("nom", "last name", "lastname");
  const idxEmail = findIdx(
    "email",
    "adresse e-mail",
    "adresse email",
    "e-mail",
  );
  const idxPhone = findIdx(
    "téléphone",
    "telephone",
    "phone",
    "tel",
    "mobile",
    "portable",
  );

  if (idxFirst === -1 || idxLast === -1 || idxEmail === -1) return [];

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const cells = line.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const firstName = cells[idxFirst];
    const lastName = cells[idxLast];
    const email = cells[idxEmail];
    if (!firstName || !lastName || !email) continue;
    rows.push({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone: idxPhone !== -1 ? cells[idxPhone] : undefined,
    });
  }
  return rows;
}
