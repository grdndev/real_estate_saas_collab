"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/auth/actions";

/**
 * Chargement progressif d'une liste (T14) — remplace la pagination par pages.
 *
 * Le découpage se fait **par curseur** et non par `skip`/`take` : la clé de tri
 * inclut toujours l'`id`, ce qui garantit un ordre total. Une ligne insérée ou
 * supprimée entre deux chargements ne peut donc ni dupliquer ni escamoter une
 * ligne, contrairement à un décalage numérique.
 *
 * Changement de filtres ou de tri : le composant appelant remonte la liste via
 * l'attribut `key` de React (`<MaListe key={cleDesFiltres} … />`). C'est plus
 * sûr qu'une réinitialisation interne — l'état repart de zéro par construction.
 */

/** Page de résultats renvoyée par une action paginée. */
export interface CursorPage<T> {
  rows: T[];
  /** Curseur de la page suivante, `null` s'il n'y a plus rien à charger. */
  nextCursor: string | null;
}

/** Action serveur paginée par curseur. */
export type LoadCursorPage<T> = (
  cursor: string | null,
) => Promise<ActionResult<CursorPage<T>>>;

interface UseInfiniteRowsOptions<T> {
  /** Première page, rendue par le serveur. */
  initialRows: T[];
  /** Curseur issu de la première page. */
  initialCursor: string | null;
  loadPage: LoadCursorPage<T>;
}

export interface InfiniteRowsState<T> {
  rows: T[];
  loading: boolean;
  /** Plus aucune page à charger. */
  done: boolean;
  error: string | null;
  /** À poser sur la sentinelle observée en bas de liste. */
  setSentinel: (node: HTMLElement | null) => void;
  /** Relance le chargement après une erreur. */
  retry: () => void;
}

export function useInfiniteRows<T>({
  initialRows,
  initialCursor,
  loadPage,
}: UseInfiniteRowsOptions<T>): InfiniteRowsState<T> {
  const [rows, setRows] = useState<T[]>(initialRows);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);

  // Le curseur et l'état de chargement sont doublés en refs : le callback
  // d'IntersectionObserver s'exécute hors du cycle de rendu et lirait sinon
  // des valeurs périmées, ce qui déclencherait deux fois la même page.
  const cursorRef = useRef(initialCursor);
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    const current = cursorRef.current;
    if (current === null) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    const result = await loadPage(current);

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      loadingRef.current = false;
      return;
    }

    setRows((previous) => {
      // Ceinture et bretelles : on écarte un identifiant déjà présent, au cas
      // où deux observations se déclencheraient sur le même curseur.
      const seen = new Set(
        previous.map((row) => (row as { id?: string }).id).filter(Boolean),
      );
      const fresh = result.value.rows.filter((row) => {
        const id = (row as { id?: string }).id;
        return id == null || !seen.has(id);
      });
      return [...previous, ...fresh];
    });
    cursorRef.current = result.value.nextCursor;
    setCursor(result.value.nextCursor);
    setLoading(false);
    loadingRef.current = false;
  }, [loadPage]);

  useEffect(() => {
    if (!sentinel || cursor === null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      // Marge basse : le chargement démarre avant que la sentinelle soit visible.
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, cursor, loadMore]);

  return {
    rows,
    loading,
    done: cursor === null,
    error,
    setSentinel,
    retry: () => void loadMore(),
  };
}

interface InfiniteSentinelProps {
  loading: boolean;
  done: boolean;
  error: string | null;
  setSentinel: (node: HTMLElement | null) => void;
  retry: () => void;
  /** Nombre de lignes déjà affichées, annoncé aux lecteurs d'écran. */
  loadedCount: number;
  /** Libellé de l'entité listée, ex. « dossier ». */
  itemLabel: string;
}

/**
 * Sentinelle de bas de liste : déclenche le chargement, annonce l'état.
 *
 * Le conteneur porte `aria-live="polite"` pour que l'arrivée de nouvelles
 * lignes et la fin de liste soient annoncées sans voler le focus.
 */
export function InfiniteSentinel({
  loading,
  done,
  error,
  setSentinel,
  retry,
  loadedCount,
  itemLabel,
}: InfiniteSentinelProps) {
  const plural = loadedCount > 1 ? "s" : "";
  // Élision devant une voyelle : « d'entrées » et non « de entrées ».
  const de = /^[aeiouyéèêà]/i.test(itemLabel) ? "d'" : "de ";

  return (
    <div
      aria-live="polite"
      aria-busy={loading}
      className="flex flex-col items-center gap-2 py-4 text-sm text-slate-500"
    >
      {error ? (
        <>
          <p role="alert" className="text-red-700">
            {error}
          </p>
          <Button variant="outline" size="sm" onClick={retry}>
            Réessayer
          </Button>
        </>
      ) : loading ? (
        <p>
          Chargement {de}
          {itemLabel}s supplémentaires…
        </p>
      ) : done ? (
        <p>
          {loadedCount} {itemLabel}
          {plural} — fin de la liste.
        </p>
      ) : null}

      {/* Sentinelle observée : hors du tableau, pour rester du HTML valide. */}
      {!done && !error && (
        <div ref={setSentinel} aria-hidden className="h-px w-full" />
      )}
    </div>
  );
}
