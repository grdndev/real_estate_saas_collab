/**
 * Conversion d'un montant en euros vers son écriture en toutes lettres.
 * Exemple : 14250.5 → "quatorze mille deux cent cinquante euros et cinquante centimes"
 *
 * Règles françaises appliquées (orthographe traditionnelle, mots séparés
 * par des espaces, traits d'union uniquement à l'intérieur des nombres < 100) :
 *  - "et un" pour 21, 31, 41, 51, 61 et "et onze" pour 71 ;
 *  - "quatre-vingts" prend un "s" final, sauf s'il est suivi d'un autre
 *    adjectif numéral (quatre-vingt-un, quatre-vingt mille) ;
 *  - "cent" prend un "s" quand il est multiplié et termine le nombre
 *    (deux cents) mais pas sinon (deux cent un, deux cent mille) ;
 *  - "mille" est invariable (deux mille) ;
 *  - "million" et "milliard" sont des noms : ils s'accordent (deux millions).
 */

// Nombres de 0 à 16 : formes irrégulières, on les liste simplement.
const UNITES = [
  "zéro",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
];

// Dizaines "simples" (index = dizaine). 70 et 90 se construisent sur 60 et 80.
const DIZAINES = [
  "",
  "dix",
  "vingt",
  "trente",
  "quarante",
  "cinquante",
  "soixante",
];

/** Écrit un nombre de 0 à 99. */
function moinsDeCent(n: number): string {
  if (n < 17) return UNITES[n] ?? "";
  if (n < 20) return `dix-${UNITES[n - 10]}`; // dix-sept, dix-huit, dix-neuf

  // 70-79 et 90-99 : soixante/quatre-vingt + 10..19.
  if ((n >= 70 && n < 80) || n >= 90) {
    const base = n < 80 ? "soixante" : "quatre-vingt";
    const reste = n % 20; // 10..19
    if (reste === 11 && n < 80) return "soixante et onze"; // 71
    return `${base}-${moinsDeCent(reste)}`;
  }

  // 80-89 : jamais de "et" ; "quatre-vingts" seulement si rien ne suit.
  if (n >= 80) {
    return n === 80 ? "quatre-vingts" : `quatre-vingt-${UNITES[n - 80]}`;
  }

  // 17..69 restants : dizaine + unité.
  const dizaine = DIZAINES[Math.floor(n / 10)] ?? "";
  const unite = n % 10;
  if (unite === 0) return dizaine;
  if (unite === 1) return `${dizaine} et un`; // 21, 31, 41, 51, 61
  return `${dizaine}-${UNITES[unite]}`;
}

/** Écrit un nombre de 0 à 999. */
function moinsDeMille(n: number): string {
  if (n < 100) return moinsDeCent(n);

  const centaines = Math.floor(n / 100);
  const reste = n % 100;

  // "cent" seul pour 100..199, sinon "deux cent", "trois cent"…
  let mots = centaines === 1 ? "cent" : `${UNITES[centaines]} cent`;
  // "s" final quand cent est multiplié et termine le nombre : deux cents.
  if (centaines > 1 && reste === 0) mots += "s";
  if (reste > 0) mots += ` ${moinsDeCent(reste)}`;
  return mots;
}

/**
 * Retire le "s" final de "quatre-vingts" / "deux cents" quand le mot est
 * suivi de "mille" (adjectif numéral) : quatre-vingt mille, deux cent mille.
 */
function sansPlurielAvantMille(mots: string): string {
  return mots.endsWith("s") ? mots.slice(0, -1) : mots;
}

/** Écrit un entier positif quelconque (jusqu'aux milliards). */
export function nombreEnLettres(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`nombreEnLettres attend un entier positif, reçu : ${n}`);
  }
  if (n === 0) return "zéro";

  const milliards = Math.floor(n / 1_000_000_000);
  const millions = Math.floor(n / 1_000_000) % 1_000;
  const milliers = Math.floor(n / 1_000) % 1_000;
  const reste = n % 1_000;

  const parties: string[] = [];

  // "million" et "milliard" sont des noms : ils prennent un "s" au pluriel.
  if (milliards > 0) {
    parties.push(
      `${moinsDeMille(milliards)} milliard${milliards > 1 ? "s" : ""}`,
    );
  }
  if (millions > 0) {
    parties.push(`${moinsDeMille(millions)} million${millions > 1 ? "s" : ""}`);
  }
  if (milliers > 0) {
    // "mille" est invariable et "un mille" ne se dit pas.
    parties.push(
      milliers === 1
        ? "mille"
        : `${sansPlurielAvantMille(moinsDeMille(milliers))} mille`,
    );
  }
  if (reste > 0) parties.push(moinsDeMille(reste));

  return parties.join(" ");
}

/**
 * Convertit un montant en euros en toutes lettres.
 * Exemples :
 *  - 0        → "zéro euro"
 *  - 1        → "un euro"
 *  - 200      → "deux cents euros"
 *  - 14250.5  → "quatorze mille deux cent cinquante euros et cinquante centimes"
 */
export function montantEnLettres(montant: number): string {
  if (!Number.isFinite(montant) || montant < 0) {
    throw new Error(`montantEnLettres attend un montant positif : ${montant}`);
  }

  // On travaille en centimes entiers pour éviter les erreurs de flottants.
  const totalCentimes = Math.round(montant * 100);
  const euros = Math.floor(totalCentimes / 100);
  const centimes = totalCentimes % 100;

  // "euro" reste au singulier pour 0 et 1.
  // "un million euros" est incorrect : on écrit "un million d'euros".
  const eurosEnLettres = nombreEnLettres(euros);
  const liaison = /(million|milliard)s?$/.test(eurosEnLettres) ? " d'" : " ";
  let texte = `${eurosEnLettres}${liaison}euro${euros > 1 ? "s" : ""}`;

  if (centimes > 0) {
    texte += ` et ${nombreEnLettres(centimes)} centime${centimes > 1 ? "s" : ""}`;
  }

  return texte.toUpperCase();
}
