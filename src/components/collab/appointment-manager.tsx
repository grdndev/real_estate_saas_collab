"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createAppointmentAction,
  cancelAppointmentAction,
} from "@/lib/appointment/actions";

export interface AppointmentItem {
  id: string;
  scheduledAt: string;
  location: string | null;
  notes: string | null;
  status: "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
}

const STATUS_LABEL: Record<AppointmentItem["status"], string> = {
  SCHEDULED: "Planifié",
  CONFIRMED: "Confirmé",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

interface Props {
  dossierId: string;
  appointments: AppointmentItem[];
  canManage: boolean;
}

export function AppointmentManager({
  dossierId,
  appointments,
  canManage,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function submit() {
    setError(null);
    if (!scheduledAt) {
      setError("Indiquez la date et l'heure du rendez-vous.");
      return;
    }
    startTransition(async () => {
      const result = await createAppointmentAction({
        dossierId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        localeTime: scheduledAt,
        location,
        notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setScheduledAt("");
      setLocation("");
      setNotes("");
      setShowForm(false);
      router.refresh();
    });
  }

  function cancel(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await cancelAppointmentAction(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {appointments.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun rendez-vous notaire planifié.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {appointments.map((a) => (
            <li
              key={a.id}
              className="rounded-md border border-slate-200 p-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <CalendarClock className="size-4" aria-hidden />
                  {new Date(a.scheduledAt).toLocaleString("fr-FR", {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                </span>
                <Badge
                  variant={a.status === "CANCELLED" ? "danger" : "success"}
                >
                  {STATUS_LABEL[a.status]}
                </Badge>
              </div>
              {a.location && (
                <p className="mt-1 text-xs text-slate-600">{a.location}</p>
              )}
              {a.notes && (
                <p className="mt-1 text-xs text-slate-500">{a.notes}</p>
              )}
              {canManage && a.status !== "CANCELLED" && (
                <button
                  type="button"
                  onClick={() => cancel(a.id)}
                  disabled={pending}
                  className="mt-2 text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  Annuler le rendez-vous
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}

      {canManage &&
        (showForm ? (
          <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-500">
                Date et heure
              </span>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-slate-500">
                Lieu (étude notariale)
              </span>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Étude Me Rousseau, Saint-Denis"
              />
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Précisions (optionnel)"
              maxLength={500}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={submit}
                disabled={pending}
              >
                {pending ? "Enregistrement…" : "Planifier le RDV"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
                disabled={pending}
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
            >
              <CalendarClock className="size-4" aria-hidden />
              Planifier un RDV notaire
            </Button>
          </div>
        ))}
    </div>
  );
}
