/**
 * Règles d'archivage et de réactivation des dossiers (T10).
 *
 * `Lot.dossierId` désigne le dossier ACTIF d'un lot. Un même lot peut porter
 * plusieurs dossiers au fil du temps — un par client — dont un seul est actif :
 *
 *  - dissociation d'un client → le dossier est archivé (`archivedAt`), le lot
 *    est détaché, et `archivedLotId` mémorise le lot pour pouvoir restituer
 *    l'historique plus tard ;
 *  - association d'un client sur un lot où ce client avait déjà un dossier
 *    archivé → ce dossier est réactivé, avec ses messages, documents et
 *    timeline ; le dossier vide qui servait de support est supprimé ;
 *  - association d'un client inconnu du lot → le dossier courant est
 *    simplement rattaché à ce client (fil de discussion vierge).
 *
 * Ces fonctions sont pures : elles décrivent la décision, la server action
 * l'exécute. Cela les rend testables sans base de données.
 */

/** Contenu d'un dossier permettant de savoir s'il porte un historique. */
export interface DossierContentCounts {
  messages: number;
  documents: number;
  timelineEvents: number;
  invoices: number;
  signatures: number;
  appointments: number;
  notes: number;
}

/**
 * Un dossier est « vide » s'il ne porte aucune trace métier autre que les
 * événements de timeline générés automatiquement à sa création.
 *
 * Seuls les dossiers vides peuvent être supprimés : dès qu'un dossier porte un
 * message, un document, une facture, une signature, un rendez-vous ou une note,
 * il est archivé et jamais détruit.
 */
export function isDossierEmpty(counts: DossierContentCounts): boolean {
  return (
    counts.messages === 0 &&
    counts.documents === 0 &&
    counts.invoices === 0 &&
    counts.signatures === 0 &&
    counts.appointments === 0 &&
    counts.notes === 0
  );
}

export type ClientAssignmentPlan =
  | {
      /** Aucun historique : on rattache le client au dossier courant. */
      kind: "attach";
    }
  | {
      /** Historique retrouvé : on réactive le dossier archivé du client. */
      kind: "reactivate";
      archivedDossierId: string;
      /** Le dossier courant est supprimé s'il est vide, archivé sinon. */
      currentDossierDisposal: "delete" | "archive";
    };

export interface AssignmentContext {
  /** Dossier archivé de ce couple (lot, client), s'il en existe un. */
  archivedDossierId: string | null;
  /** Contenu du dossier courant, qui sert de support à l'association. */
  currentCounts: DossierContentCounts;
}

/**
 * Décide de la marche à suivre pour associer un client à un dossier.
 *
 * @returns « reactivate » si le client avait déjà un dossier archivé sur ce
 *          lot, « attach » sinon.
 */
export function planClientAssignment({
  archivedDossierId,
  currentCounts,
}: AssignmentContext): ClientAssignmentPlan {
  if (!archivedDossierId) return { kind: "attach" };
  return {
    kind: "reactivate",
    archivedDossierId,
    currentDossierDisposal: isDossierEmpty(currentCounts)
      ? "delete"
      : "archive",
  };
}
