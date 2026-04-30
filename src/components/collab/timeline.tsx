import {
  CheckCircle2,
  Clock,
  FileSignature,
  FileText,
  Handshake,
  Home,
  PiggyBank,
  Send,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<string, LucideIcon> = {
  LEAD_CREATED: UserPlus,
  COMMERCIAL_MEETING: Handshake,
  RESERVATION_SENT: Send,
  RESERVATION_SIGNED: FileSignature,
  TRANSMITTED_TO_NOTARY: FileText,
  GUARANTEE_DEPOSIT_RECEIVED: PiggyBank,
  LOAN_OFFER_RECEIVED: PiggyBank,
  ACT_SIGNED: Home,
  STATUS_CHANGE: Clock,
  DOCUMENT_REQUESTED: FileText,
  CUSTOM: CheckCircle2,
};

interface TimelineEvent {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  occurredAt: Date;
  actor?: { firstName: string; lastName: string } | null;
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Aucun événement. Les étapes du dossier s&apos;afficheront ici au fur et
        à mesure.
      </p>
    );
  }
  return (
    <ol className="relative ml-3 border-l-2 border-slate-200">
      {events.map((event, index) => {
        const Icon = KIND_ICON[event.kind] ?? Clock;
        const isLast = index === events.length - 1;
        return (
          <li
            key={event.id}
            className={cn("relative pb-6 pl-6", isLast && "pb-0")}
          >
            <span
              aria-hidden
              className="bg-equatis-turquoise-500 absolute -left-[11px] flex size-5 items-center justify-center rounded-full ring-4 ring-white"
            >
              <Icon className="size-3 text-white" />
            </span>
            <p className="text-equatis-night-800 text-sm font-medium">
              {event.title}
            </p>
            {event.description && (
              <p className="mt-1 text-sm whitespace-pre-line text-slate-600">
                {event.description}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              <time dateTime={event.occurredAt.toISOString()}>
                {event.occurredAt.toLocaleString("fr-FR")}
              </time>
              {event.actor && (
                <>
                  {" · "}
                  {event.actor.firstName} {event.actor.lastName}
                </>
              )}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
