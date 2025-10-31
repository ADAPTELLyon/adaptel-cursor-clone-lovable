// src/hooks/useLiveRows.ts
// Realtime pro & stable (v2) via canaux, avec compat TypeScript encapsulée.
// - Pas de refetch global : on écoute INSERT/UPDATE/DELETE et on te renvoie la ligne à patcher.
// - Ne touche jamais aux filtres, à la route ou au scroll.
// - Ajout: filtres serveur optionnels (secteur/semaine...) pour réduire le flux Realtime.
// - API externe typée ; compat interne évite les frictions de d.ts.

import { useEffect, useMemo, useRef, useTransition } from "react";
import { supabase } from "@/lib/supabase";

export type PgPayload<T> = {
  schema: string;
  table: string;
  commit_timestamp?: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T;
  old: T;
};

export type UseLiveRowsOptions<T> = {
  /** Nom de la table (ex: "commandes") */
  table: string;

  /**
   * Filtres courants (utilisés côté client par isInView).
   * Ils NE déclenchent PAS une resubscription.
   */
  filters?: Record<string, unknown>;

  /**
   * Retourne true si la ligne est visible dans la vue courante.
   * Si omise, tous les événements passent (après filtre serveur éventuel).
   */
  isInView?: (row: T | null | undefined, filters?: Record<string, unknown>) => boolean;

  /** Callbacks pour patcher la donnée localement (ligne/cellule uniquement) */
  onInsert?: (row: T, raw: PgPayload<T>) => void;
  onUpdate?: (row: T, raw: PgPayload<T>) => void;
  onDelete?: (row: T, raw: PgPayload<T>) => void;

  /**
   * Nom de canal de base (utile si plusieurs hooks cohabitent).
   * Par défaut: "realtime:<table>"
   */
  channelName?: string;

  /**
   * Filtres serveur pour Realtime (réduction d’egress).
   * - string  : un filtre unique, ex. "secteur=eq.Étages" ou "date=gte.2025-09-15"
   * - string[]: plusieurs filtres -> on ouvre 1 canal par filtre (utile si secteurs multiples)
   *
   * NB: Realtime n’accepte qu’UN filtre par .on(). Si tu dois combiner (ET),
   * ouvre plusieurs canaux ou complète avec isInView (côté client).
   */
  serverFilters?: string | string[];

  /**
   * Fabrique le(s) filtre(s) serveur à partir de `filters`.
   * Si fourni, son résultat prime sur `serverFilters`.
   */
  buildServerFilters?: (filters?: Record<string, unknown>) => string | string[] | undefined;
};

export function useLiveRows<T = any>({
  table,
  filters,
  isInView,
  onInsert,
  onUpdate,
  onDelete,
  channelName,
  serverFilters,
  buildServerFilters,
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

  const baseChanName = useMemo(
    () => channelName || `realtime:${table}`,
    [channelName, table]
  );

  // Résout la liste finale des filtres serveur à utiliser (0..N)
  const resolvedServerFilters = useMemo(() => {
    const fromBuilder = buildServerFilters?.(filtersRef.current);
    const raw = fromBuilder ?? serverFilters;

    if (!raw) return [] as string[];
    if (Array.isArray(raw)) {
      return raw.filter(Boolean) as string[];
    }
    return [raw];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseChanName, table, buildServerFilters, serverFilters]); // volontairement détaché des `filters`

  useEffect(() => {
    // Si aucun filtre serveur n'est fourni, on garde un canal "global" (comme avant).
    const filtersList = resolvedServerFilters.length > 0 ? resolvedServerFilters : [undefined];

    // On ouvre 1 canal par filtre serveur (bonne pratique si secteurs multiples).
    const channels: any[] = filtersList.map((flt, idx) => {
      const chan = `${baseChanName}${resolvedServerFilters.length > 1 ? `:${idx}` : ""}`;
      const channel = (supabase as any).channel(chan);

      const subscribeWithFilter = (event: "INSERT" | "UPDATE" | "DELETE" | "*") => {
        const opts: any = { event, schema: "public", table };
        if (flt) opts.filter = flt; // ex. "secteur=eq.Étages" ou "date=gte.2025-09-15"

        (channel as any).on(
          "postgres_changes",
          opts,
          (payload: any) => {
            const raw: PgPayload<T> = {
              schema: payload?.schema ?? "public",
              table,
              commit_timestamp: payload?.commit_timestamp,
              eventType: payload?.eventType,
              new: payload?.new as T,
              old: payload?.old as T,
            };

            // Garde côté client (vue courante)
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

      // On écoute tout (INSERT/UPDATE/DELETE) sur la table donnée
      subscribeWithFilter("*");

      (channel as any).subscribe?.();
      return channel;
    });

    return () => {
      // Cleanup propre: on ferme tous les canaux ouverts par ce hook
      try {
        channels.forEach((ch) => (ch as any).unsubscribe?.());
      } catch {
        // no-op
      }
    };
    // IMPORTANT: on NE resouscrit pas quand `filters` changent (seulement si config serveur change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseChanName, table, resolvedServerFilters]);

  return { isPending };
}
