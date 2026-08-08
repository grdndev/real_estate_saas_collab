"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";

import { InfiniteSentinel } from "@/components/ui/infinite-rows";
import { TBody } from "@/components/ui/table";

/**
 * Révélation progressive d'une liste **déjà chargée** (T16).
 *
 * Pendant du scroll infini par curseur (`useInfiniteRows`) : ici la totalité
 * des lignes est déjà en mémoire — parce que la requête serveur est unique et
 * bornée en pratique — et seul le rendu est découpé. Cela évite de construire
 * des milliers de nœuds DOM d'un coup sans imposer d'aller-retour serveur.
 *
 * À réserver aux listes dont le volume est borné : pour une table qui croît
 * indéfiniment (journal d'activité, notifications), c'est `useInfiniteRows`
 * qu'il faut, sinon la charge utile transite entièrement à chaque visite.
 *
 * L'état retourné a la même forme que celui de `useInfiniteRows`, ce qui rend
 * `InfiniteSentinel` réutilisable tel quel.
 */

export const DEFAULT_CHUNK_SIZE = 50;

interface UseChunkedRowsOptions<T> {
  /** Liste complète, déjà résolue côté serveur. */
  allRows: readonly T[];
  /** Nombre de lignes révélées à chaque passage de la sentinelle. */
  chunkSize?: number;
}

export interface ChunkedRowsState<T> {
  rows: T[];
  loading: boolean;
  /** Toutes les lignes sont affichées. */
  done: boolean;
  error: null;
  /** À poser sur la sentinelle observée en bas de liste. */
  setSentinel: (node: HTMLElement | null) => void;
  retry: () => void;
  /** Nombre total de lignes disponibles, révélées ou non. */
  total: number;
}

export function useChunkedRows<T>({
  allRows,
  chunkSize = DEFAULT_CHUNK_SIZE,
}: UseChunkedRowsOptions<T>): ChunkedRowsState<T> {
  const [visible, setVisible] = useState(() =>
    Math.min(chunkSize, allRows.length),
  );
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);

  // La liste peut changer d'identité sans changer de contenu à chaque rendu du
  // parent ; on ne réinitialise que lorsque sa longueur change réellement.
  const lengthRef = useRef(allRows.length);
  useEffect(() => {
    if (lengthRef.current !== allRows.length) {
      lengthRef.current = allRows.length;
      setVisible(Math.min(chunkSize, allRows.length));
    }
  }, [allRows.length, chunkSize]);

  const reveal = useCallback(() => {
    setVisible((current) => Math.min(current + chunkSize, allRows.length));
  }, [chunkSize, allRows.length]);

  const done = visible >= allRows.length;

  useEffect(() => {
    if (!sentinel || done) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) reveal();
      },
      // Marge basse : la tranche suivante arrive avant que le bas soit atteint.
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, done, reveal]);

  return {
    rows: allRows.slice(0, visible) as T[],
    loading: false,
    done,
    error: null,
    setSentinel,
    retry: reveal,
    total: allRows.length,
  };
}

interface ChunkedTableBodyProps {
  /** Lignes `<Tr>` déjà rendues par l'appelant. */
  children: React.ReactNode;
  /** Nombre de colonnes du tableau : la sentinelle occupe une ligne entière. */
  colSpan: number;
  /** Libellé de l'entité listée, ex. « utilisateur ». */
  itemLabel: string;
  chunkSize?: number;
}

/**
 * `<TBody>` à révélation progressive.
 *
 * L'appelant — souvent un composant serveur — rend toutes ses lignes ; seules
 * les premières sont montées, les suivantes arrivent au défilement. Le tableau
 * qui l'englobe doit désactiver son scroll interne (`<Table scrollY={false}>`),
 * sinon la sentinelle est visible dès l'affichage et tout se révèle d'un coup.
 *
 * Sous le seuil d'une tranche, le corps est rendu tel quel : pas de sentinelle
 * ni de mention de fin de liste pour un tableau de trois lignes.
 */
export function ChunkedTableBody({
  children,
  colSpan,
  itemLabel,
  chunkSize = DEFAULT_CHUNK_SIZE,
}: ChunkedTableBodyProps) {
  const all = Children.toArray(children);
  const { rows, loading, done, error, setSentinel, retry } = useChunkedRows({
    allRows: all,
    chunkSize,
  });

  if (all.length <= chunkSize) return <TBody>{children}</TBody>;

  return (
    <TBody>
      {rows}
      <tr>
        <td colSpan={colSpan} className="p-0">
          <InfiniteSentinel
            loading={loading}
            done={done}
            error={error}
            setSentinel={setSentinel}
            retry={retry}
            loadedCount={rows.length}
            itemLabel={itemLabel}
          />
        </td>
      </tr>
    </TBody>
  );
}

interface ChunkedListProps {
  /** Éléments déjà rendus par l'appelant (cartes, `<li>`, blocs…). */
  children: React.ReactNode;
  itemLabel: string;
  chunkSize?: number;
}

/**
 * Variante hors tableau : rend les éléments visibles puis la sentinelle, en
 * frères. Le conteneur doit donc accepter un `<div>` — pour un `<tbody>`,
 * utiliser `ChunkedTableBody`.
 */
export function ChunkedList({
  children,
  itemLabel,
  chunkSize = DEFAULT_CHUNK_SIZE,
}: ChunkedListProps) {
  const all = Children.toArray(children);
  const { rows, loading, done, error, setSentinel, retry } = useChunkedRows({
    allRows: all,
    chunkSize,
  });

  if (all.length <= chunkSize) return <>{children}</>;

  return (
    <>
      {rows}
      <InfiniteSentinel
        loading={loading}
        done={done}
        error={error}
        setSentinel={setSentinel}
        retry={retry}
        loadedCount={rows.length}
        itemLabel={itemLabel}
      />
    </>
  );
}
