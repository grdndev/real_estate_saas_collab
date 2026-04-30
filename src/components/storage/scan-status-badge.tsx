import { Badge } from "@/components/ui/badge";

const MAP = {
  PENDING: { label: "Scan en cours", variant: "neutral" as const },
  CLEAN: { label: "Sécurisé", variant: "success" as const },
  INFECTED: { label: "Infecté", variant: "danger" as const },
  ERROR: { label: "Erreur scan", variant: "danger" as const },
};

export function ScanStatusBadge({
  status,
}: {
  status: "PENDING" | "CLEAN" | "INFECTED" | "ERROR";
}) {
  const m = MAP[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
