"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  LOT_FILTER_FIELDS,
  LOT_FILTER_OPERATOR_LABEL,
  LOT_FILTER_PARAM,
  lotFilterValueLabel,
  operatorsFor,
  parseLotFilter,
  parseLotFilters,
  serializeLotFilter,
  type LotFilterField,
  type LotFilterOperator,
} from "@/lib/lot/filter";

const FIELDS = Object.entries(LOT_FILTER_FIELDS) as [
  LotFilterField,
  (typeof LOT_FILTER_FIELDS)[LotFilterField],
][];

/**
 * Bouton + menu de filtrage de la grille des lots. Les filtres voyagent dans
 * l'URL (`?f=champ:opérateur:valeur`) ; la page les applique côté serveur.
 * Le menu est rendu dans un portail : le conteneur du tableau défile en
 * horizontal et rognerait un menu positionné en absolu.
 */
export function LotFilterMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>();

  const [field, setField] = useState<LotFilterField>("reference");
  const [operator, setOperator] = useState<LotFilterOperator>("eq");
  const [value, setValue] = useState("");

  const filters = parseLotFilters(params.getAll(LOT_FILTER_PARAM));
  const serializedFilters = filters.map(serializeLotFilter);
  const def = LOT_FILTER_FIELDS[field];
  const open = position !== undefined;

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(undefined);
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        close();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // Le menu suit le bouton quand la page ou le tableau défile.
    const follow = () => setPosition(anchorPosition());
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
    };
  }, [open]);

  function anchorPosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    return rect && { top: rect.bottom + 4, left: rect.left };
  }

  function toggle() {
    setPosition(open ? undefined : anchorPosition());
  }

  function navigate(nextFilters: string[]) {
    const next = new URLSearchParams(params.toString());
    next.delete(LOT_FILTER_PARAM);
    for (const f of nextFilters) next.append(LOT_FILTER_PARAM, f);
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function changeField(next: LotFilterField) {
    setField(next);
    setValue("");
    if (!operatorsFor(next).includes(operator)) setOperator("eq");
  }

  const candidate = parseLotFilter(
    serializeLotFilter({ field, operator, value: value.trim() }),
  );

  function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!candidate) return;
    const serialized = serializeLotFilter(candidate);
    if (!serializedFilters.includes(serialized)) {
      navigate([...serializedFilters, serialized]);
    }
    setValue("");
  }

  function remove(index: number) {
    navigate(serializedFilters.filter((_, i) => i !== index));
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label="Filtrer les lots"
        aria-expanded={open}
        className={cn(
          "hover:text-equatis-turquoise-700 relative inline-flex size-6 items-center justify-center rounded hover:bg-slate-200/60",
          filters.length > 0 && "text-equatis-turquoise-700",
        )}
      >
        <ListFilter className="size-4" aria-hidden />
        {filters.length > 0 && (
          <span className="bg-equatis-turquoise-500 absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full text-[9px] leading-none font-semibold text-white">
            {filters.length}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Filtres des lots"
            aria-busy={pending}
            style={{ top: position.top, left: position.left }}
            className="fixed z-50 flex w-max max-w-[calc(100vw-32px)] flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-lg"
          >
            <form
              onSubmit={apply}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-slate-600">Filtrer par :</span>
              <Select
                value={field}
                onChange={(e) => changeField(e.target.value as LotFilterField)}
                aria-label="Champ"
                className="h-9 w-auto"
              >
                {FIELDS.map(([key, f]) => (
                  <option key={key} value={key}>
                    {f.label}
                  </option>
                ))}
              </Select>
              <Select
                value={operator}
                onChange={(e) =>
                  setOperator(e.target.value as LotFilterOperator)
                }
                aria-label="Opérateur"
                className="h-9 w-auto"
              >
                {operatorsFor(field).map((op) => (
                  <option key={op} value={op}>
                    {LOT_FILTER_OPERATOR_LABEL[op]}
                  </option>
                ))}
              </Select>
              {"options" in def ? (
                <Select
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  aria-label="Valeur"
                  className="h-9 w-auto"
                >
                  <option value="">—</option>
                  {Object.entries(def.options).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  inputMode={def.kind === "number" ? "decimal" : undefined}
                  aria-label="Valeur"
                  placeholder="Valeur"
                  className="h-9 w-32"
                />
              )}
              <Button type="submit" size="sm" disabled={!candidate || pending}>
                Appliquer
              </Button>
            </form>

            {filters.map((f, i) => (
              <div
                key={serializedFilters[i]}
                className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1"
              >
                <span>
                  {LOT_FILTER_FIELDS[f.field].label}{" "}
                  <span className="text-slate-500">
                    {LOT_FILTER_OPERATOR_LABEL[f.operator]}
                  </span>{" "}
                  <span className="font-medium">{lotFilterValueLabel(f)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={pending}
                  aria-label="Supprimer le filtre"
                  className="inline-flex size-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
