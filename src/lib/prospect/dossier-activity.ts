// Détermine si un dossier issu d'une conversion possède une « activité » réelle,
// qui interdit alors l'annulation de la conversion. On considère comme activité
// tout document, signature, message, facture, ou événement de timeline autre que
// les événements initiaux (création / changement de statut initial).
// Doit rester aligné avec `revertProspectConversionAction`.

const INITIAL_TIMELINE_KINDS = new Set(["LEAD_CREATED", "STATUS_CHANGE"]);

export interface DossierActivityInput {
  timelineEvents: { kind: string }[];
  _count: {
    documents: number;
    signatures: number;
    messages: number;
    invoices: number;
  };
}

export function dossierHasActivity(
  d: DossierActivityInput | null | undefined,
): boolean {
  if (!d) return false;
  const nonInitial = d.timelineEvents.filter(
    (e) => !INITIAL_TIMELINE_KINDS.has(e.kind),
  ).length;
  return (
    d._count.documents > 0 ||
    d._count.signatures > 0 ||
    d._count.messages > 0 ||
    d._count.invoices > 0 ||
    nonInitial > 0
  );
}
