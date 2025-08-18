// src/hooks/useLiveRows.ts
// Realtime pro & stable (v2) via canaux, avec compat TypeScript encapsulée.
// - Pas de refetch global : on écoute INSERT/UPDATE/DELETE et on te renvoie la ligne à patcher.
// - Ne touche jamais aux filtres, à la route ou au scroll.
// - API externe proprement typée ; une petite compat interne évite les frictions de d.ts.
// - Import via alias "@" (conforme à ta config Vite/TS).

import { useEffect, useMemo, useRef, useTransition } from "react";
import { supabase } from "@/lib/supabase";

export type PgPayload<T> = {
  schema: string;
  table: string;
  commit_timestamp?: string; // non garanti en callback, on le garde optionnel
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: T;
};

export type UseLiveRowsOptions<T> = {
  /** Nom de la table (ex: "commandes") */
  table: string;
  /**
   * Filtres courants (semaine/secteur/client...). Ils ne déclenchent PAS une resubscription.
   * On filtre côté client dans le callback.
   */
  filters?: Record<string, unknown>;
  /**
   * Retourne true si la ligne est visible dans la vue courante.
   * Si omise, tous les événements passent.
   */
  isInView?: (row: T | null | undefined, filters?: Record<string, unknown>) => boolean;

  /** Callbacks pour patcher la donnée localement (ligne/cellule uniquement) */
  onInsert?: (row: T, raw: PgPayload<T>) => void;
  onUpdate?: (row: T, raw: PgPayload<T>) => void;
  onDelete?: (row: T, raw: PgPayload<T>) => void;

  /**
   * Nom de canal optionnel (utile si plusieurs hooks cohabitent).
   * Par défaut: "realtime:<table>"
   */
  channelName?: string;
};

export function useLiveRows<T = any>({
  table,
  filters,
  isInView,
  onInsert,
  onUpdate,
  onDelete,
  channelName,
}: UseLiveRowsOptions<T>) {
  const filtersRef = useRef(filters);
  const isInViewRef = useRef(isInView);
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);

  const [isPending, startTransition] = useTransition();

  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { isInViewRef.current = isInView; }, [isInView]);
  useEffect(() => { onInsertRef.current = onInsert; }, [onInsert]);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

  const chan = useMemo(
    () => channelName || `realtime:${table}`,
    [channelName, table]
  );

  useEffect(() => {
    // Création du canal (API officielle v2)
    const channel = (supabase as any).channel(chan);

    // Petite compat TS encapsulée : certains d.ts pickent la surcharge "system".
    // On force ici le bon event "postgres_changes" proprement.
    const onPostgresChanges = (event: "INSERT" | "UPDATE" | "DELETE" | "*") => {
      (channel as any).on(
        "postgres_changes",
        { event, schema: "public", table },
        (payload: any) => {
          // payload a la forme: { schema, table, commit_timestamp, eventType, new, old }
          const raw: PgPayload<T> = {
            schema: payload?.schema ?? "public",
            table,
            commit_timestamp: payload?.commit_timestamp,
            eventType: payload?.eventType,
            new: payload?.new as T,
            old: payload?.old as T,
          };

          // Filtrage côté client (vue courante)
          const fn = isInViewRef.current;
          const inView = (r: T | null | undefined) => (!fn ? true : fn(r, filtersRef.current));

          startTransition(() => {
            if (raw.eventType === "INSERT") {
              if (raw.new && inView(raw.new)) onInsertRef.current?.(raw.new, raw);
            } else if (raw.eventType === "UPDATE") {
              const wasIn = inView(raw.old);
              const isNowIn = inView(raw.new);
              if (wasIn && !isNowIn && (raw.old as any)?.id) {
                onDeleteRef.current?.(raw.old, raw);
              } else if (raw.new && isNowIn) {
                onUpdateRef.current?.(raw.new, raw);
              }
            } else if (raw.eventType === "DELETE") {
              if (raw.old && inView(raw.old)) onDeleteRef.current?.(raw.old, raw);
            }
          });
        }
      );
    };

    // On écoute tout (INSERT/UPDATE/DELETE) sur la table donnée, une seule souscription
    onPostgresChanges("*");

    // Subscribe
    (channel as any).subscribe?.();

    return () => {
      try {
        (channel as any).unsubscribe?.();
      } catch {
        // no-op
      }
    };
  }, [chan, table]);

  return { isPending };
}
