import { useEffect, useMemo, useState, useCallback } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, endOfWeek, getWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import type {
  JourPlanningCandidat,
  CommandeFull,
  CandidatDispoWithNom,
  StatutCommande,
} from "@/types/types-front";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, AlertCircle, Clock } from "lucide-react";
import { statutColors, disponibiliteColors } from "@/lib/colors";
import { ColonneCandidate } from "@/components/Planning/ColonneCandidate";
import CandidateJourneeDialog from "@/components/Planning/CandidateJourneeDialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

/* -----------------------------
   Constantes UI (cohérentes avec la nouvelle vue)
----------------------------- */
const COL_L = 260;              // largeur de la colonne gauche
const HALF_H = 48;              // hauteur d’un demi-slot (matin/soir)
const GAP = 6;                  // écart entre demi-slots
const FULL_H_ETAGES = 56;       // hauteur “Étages” 1 bloc
const ROW_H_OTHERS = HALF_H * 2 + GAP; // autres secteurs : 2 demi-blocs

/* -----------------------------
   Helpers format & statut
----------------------------- */
const fmt = (h?: string | null) => (h && h.length >= 5 ? h.slice(0, 5) : "");

const isPlanif = (s?: string | null) => {
  const v = (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  return v === "valide" || v === "planifie" || v === "a valider" || v === "à valider";
};

// Compacte un nom client proprement (multi-mots)
const compactClient = (raw?: string) => {
  if (!raw) return "Client ?";
  const trimmed = raw.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= 3) return trimmed.length > 26 ? trimmed.slice(0, 23) + "..." : trimmed;
  const reduced = words.slice(0, 3).join(" ");
  return reduced.length > 26 ? reduced.slice(0, 23) + "..." : reduced + " ...";
};

// timestamp (updated_at > created_at)
const ts = (x?: { updated_at?: string | null; created_at?: string | null } | null) =>
  (x?.updated_at ? Date.parse(x.updated_at) : 0) ||
  (x?.created_at ? Date.parse(x.created_at) : 0) ||
  0;

/* -----------------------------
   Vignettes (mêmes codes visuels que la nouvelle vue)
----------------------------- */
const VignettePlanifiee = ({ client, hours }: { client: string; hours: string }) => (
  <div
    className="w-full h-full rounded-md px-2 py-2 flex flex-col items-start justify-center gap-1 overflow-hidden shadow-sm min-w-0"
    style={{
      backgroundColor: statutColors["Validé"]?.bg,
      color: statutColors["Validé"]?.text,
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)",
    }}
  >
    <div className="block w-full min-w-0 font-bold text-[11px] leading-tight whitespace-nowrap truncate" title={client}>
      {compactClient(client)}
    </div>
    <div className="block w-full min-w-0 text-[12px] font-semibold opacity-95 leading-none whitespace-nowrap truncate" title={hours}>
      {hours}
    </div>
  </div>
);

const VignetteColor = ({ color, onClick }: { color: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full h-full rounded-md shadow-sm cursor-pointer overflow-hidden min-w-0"
    style={{ backgroundColor: color, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)" }}
    title="Modifier la disponibilité"
  />
);

const VignetteEmpty = ({ onAdd }: { onAdd: () => void }) => (
  <button
    type="button"
    className="w-full h-full rounded-md relative shadow-[inset_0_0_0_1px_rgba(203,213,225,0.9)] hover:shadow-md transition overflow-hidden min-w-0"
    style={{
      backgroundColor: "#ffffff",
      backgroundImage:
        "repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0, rgba(0,0,0,0.03) 10px, transparent 10px, transparent 20px)",
    }}
    title="Ajouter une disponibilité"
    onClick={onAdd}
  >
    <div className="absolute inset-0 flex items-center justify-center">
      <Plus className="w-4 h-4 text-gray-500" />
    </div>
  </button>
);

/* -----------------------------
   Types (internes mapping)
----------------------------- */
type CommandeRowLike = {
  id: string;
  date: string;
  statut: StatutCommande | string;
  secteur: string;
  service?: string | null;
  client?: { nom: string } | null;
  candidat_id?: string | null;
  heure_debut_matin?: string | null;
  heure_fin_matin?: string | null;
  heure_debut_soir?: string | null;
  heure_fin_soir?: string | null;
  heure_debut_nuit?: string | null;
  heure_fin_nuit?: string | null;
  created_at: string;
  updated_at?: string | null;
};

/* -----------------------------
   Composant principal
----------------------------- */
export default function PlanningMiniCandidat({ candidatId }: { candidatId: string }) {
  const [currentStartDate, setCurrentStartDate] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [candidatNomPrenom, setCandidatNomPrenom] = useState("");
  const [planning, setPlanning] = useState<JourPlanningCandidat[]>([]);
  const [totalHeures, setTotalHeures] = useState("00:00");

  // Dialog de saisie
  const [dispoDialog, setDispoDialog] = useState<{
    open: boolean;
    date: string | null;
    secteur: string;
    candidatId: string;
    service: string;
    disponibilite: any;
    candidatNomPrenom: string;
    creneauVerrouille: "matin" | "soir";
  }>({
    open: false,
    date: null,
    secteur: "",
    candidatId: "",
    service: "",
    disponibilite: null,
    candidatNomPrenom: "",
    creneauVerrouille: "matin",
  });

  const openDispo = (args: Omit<typeof dispoDialog, "open">) => setDispoDialog({ ...args, open: true });
  const closeDispo = () => setDispoDialog((d) => ({ ...d, open: false }));

  const onDialogSuccess = () => {
    try {
      if (dispoDialog.candidatId && dispoDialog.date) {
        window.dispatchEvent(
          new CustomEvent("dispos:updated", {
            detail: { candidatId: dispoDialog.candidatId, date: dispoDialog.date },
          })
        );
      }
    } catch {}
    fetchWeek();
    closeDispo();
  };

  const dates = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => format(addDays(currentStartDate, i), "yyyy-MM-dd")),
    [currentStartDate]
  );
  const numeroSemaine = getWeek(currentStartDate, { weekStartsOn: 1 });

  const toCommandeFull = (cmd: CommandeRowLike): CommandeFull => ({
    id: cmd.id,
    date: cmd.date,
    secteur: cmd.secteur,
    service: (cmd.service ?? null) as string | null,
    statut: (cmd.statut as StatutCommande) || "En recherche",
    client_id: "", // non utilisé ici
    candidat_id: cmd.candidat_id ?? null,
    heure_debut_matin: cmd.heure_debut_matin ?? null,
    heure_fin_matin: cmd.heure_fin_matin ?? null,
    heure_debut_soir: cmd.heure_debut_soir ?? null,
    heure_fin_soir: cmd.heure_fin_soir ?? null,
    heure_debut_nuit: cmd.heure_debut_nuit ?? null,
    heure_fin_nuit: cmd.heure_fin_nuit ?? null,
    commentaire: null,
    created_at: cmd.created_at,
    updated_at: cmd.updated_at ?? undefined,
    mission_slot: 0,
    candidat: null,
    client: cmd.client ? { nom: cmd.client.nom } : undefined,
    motif_contrat: null,
  });

  // Fallback "planification" -> transforme en CommandeRowLike
  const buildFromPlanif = (p: any): CommandeRowLike => ({
    id: String(p.commande?.id || p.commande_id || p.id),
    date: String(p.date),
    statut: (p.statut as StatutCommande) || "Validé",
    secteur: String(p.commande?.secteur || p.secteur || "Inconnu"),
    service: (p.commande?.service ?? null) as string | null,
    client: p.commande?.client ? { nom: p.commande.client.nom } : null,
    candidat_id: String(p.candidat_id),
    heure_debut_matin: p.heure_debut_matin,
    heure_fin_matin: p.heure_fin_matin,
    heure_debut_soir: p.heure_debut_soir,
    heure_fin_soir: p.heure_fin_soir,
    heure_debut_nuit: p.heure_debut_nuit,
    heure_fin_nuit: p.heure_fin_nuit,
    created_at: String(p.created_at),
    updated_at: p.updated_at ?? null,
  });

  const toDispoFull = (d: any): CandidatDispoWithNom => ({
    id: d.id,
    date: d.date,
    secteur: d.secteur,
    service: d.service ?? null,
    statut: (d.statut || "Non Renseigné") as "Dispo" | "Non Dispo" | "Non Renseigné",
    matin: !!d.dispo_matin,
    soir: !!d.dispo_soir,
    nuit: !!d.dispo_nuit,
    commentaire: d.commentaire || "",
    candidat_id: d.candidat_id,
    created_at: d.created_at,
    updated_at: d.updated_at ?? null,
    candidat: d.candidat ? { nom: d.candidat.nom, prenom: d.candidat.prenom } : undefined,
  });

  // Calcule les heures sur la semaine (Validé/Planifié/À valider)
  const fetchWeeklyHours = useCallback(async (monday: Date) => {
    const sunday = endOfWeek(monday, { weekStartsOn: 1 });
    const from = format(monday, "yyyy-MM-dd");
    const to = format(sunday, "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("commandes")
      .select("*")
      .in("statut", ["Validé", "Planifié", "À valider"])
      .eq("candidat_id", candidatId)
      .gte("date", from)
      .lte("date", to);

    if (error) {
      setTotalHeures("00:00");
      return;
    }

    let totalMinutes = 0;
    data?.forEach((cmd) => {
      if (cmd.heure_debut_matin && cmd.heure_fin_matin) {
        const [h1, m1] = cmd.heure_debut_matin.split(":").map(Number);
        const [h2, m2] = cmd.heure_fin_matin.split(":").map(Number);
        totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
      }
      if (cmd.heure_debut_soir && cmd.heure_fin_soir) {
        const [h1, m1] = cmd.heure_debut_soir.split(":").map(Number);
        const [h2, m2] = cmd.heure_fin_soir.split(":").map(Number);
        totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
      }
      if (cmd.heure_debut_nuit && cmd.heure_fin_nuit) {
        const [h1, m1] = cmd.heure_debut_nuit.split(":").map(Number);
        const [h2, m2] = cmd.heure_fin_nuit.split(":").map(Number);
        totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
      }
    });

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    setTotalHeures(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }, [candidatId]);

  const composeJour = useCallback((
    date: string,
    dispoRow: any | null,
    commandesRows: CommandeRowLike[]
  ): {
    secteur: string;
    service: string | null;
    commande?: CommandeFull;
    autresCommandes: CommandeFull[];
    disponibilite?: CandidatDispoWithNom;
  } => {
    const dispoFull = dispoRow ? toDispoFull(dispoRow) : undefined;

    const valides = commandesRows.filter((c) => isPlanif(c.statut));
    const annexes = commandesRows.filter((c) =>
      ["Annule Int", "Absence", "Annule Client", "Annule ADA"].includes((c.statut || "").trim())
    );

    let principale: CommandeFull | undefined;
    const secondaires: CommandeFull[] = [];
    let secteur = dispoRow?.secteur || commandesRows[0]?.secteur || "Étages";
    let service = (dispoRow?.service ?? commandesRows[0]?.service) ?? null;

    if (valides.length > 0) {
      const missionMatin = valides.find((c) => !!c.heure_debut_matin && !!c.heure_fin_matin);
      const missionSoir  = valides.find((c) => !!c.heure_debut_soir  && !!c.heure_fin_soir);

      if (missionMatin) {
        const m = toCommandeFull(missionMatin);
        principale = m;
        secteur = m.secteur;
        service = (m.service ?? service) ?? null;
        if (missionSoir) {
          const s = toCommandeFull(missionSoir);
          if (m.client?.nom && s.client?.nom && m.client.nom !== s.client.nom) {
            secondaires.push(s);
          }
        }
      } else if (missionSoir) {
        const s = toCommandeFull(missionSoir);
        principale = s;
        secteur = s.secteur;
        service = (s.service ?? service) ?? null;
      } else {
        const lastValide = [...valides].sort((a, b) => ts(b) - ts(a))[0];
        const v = toCommandeFull(lastValide);
        principale = v;
        secteur = v.secteur;
        service = (v.service ?? service) ?? null;
      }
    } else {
      const lastAnnexe = annexes.length > 0 ? [...annexes].sort((a, b) => ts(b) - ts(a))[0] : null;
      if (lastAnnexe && (!dispoFull || ts(lastAnnexe) >= ts(dispoFull))) {
        const a = toCommandeFull(lastAnnexe);
        principale = a;
        secteur = a.secteur;
        service = (a.service ?? service) ?? null;
      }
    }

    return {
      secteur,
      service,
      commande: principale,
      autresCommandes: secondaires,
      disponibilite: dispoFull,
    };
  }, []);

  const fetchWeek = useCallback(async () => {
    if (!candidatId) return;

    // Nom candidat
    const { data: candidatData } = await supabase
      .from("candidats")
      .select("nom, prenom")
      .eq("id", candidatId)
      .maybeSingle();
    if (candidatData) setCandidatNomPrenom(`${candidatData.prenom ?? ""} ${candidatData.nom ?? ""}`.trim());

    // Dispos (semaine)
    const { data: disponibilites } = await supabase
      .from("disponibilites")
      .select("*, candidat:candidat_id(nom, prenom)")
      .eq("candidat_id", candidatId)
      .in("date", dates);

    // Commandes (semaine)
    const { data: commandes } = await supabase
      .from("commandes")
      .select("*, client:client_id(nom)")
      .eq("candidat_id", candidatId)
      .in("date", dates);

    // Planification (fallback, semaine)
    const { data: planif } = await supabase
      .from("planification")
      .select(`
        id, commande_id, candidat_id, date, secteur, statut,
        heure_debut_matin, heure_fin_matin,
        heure_debut_soir,  heure_fin_soir,
        heure_debut_nuit,  heure_fin_nuit,
        created_at, updated_at,
        commande:commande_id (
          id, client_id, secteur, service,
          client:client_id ( nom )
        )
      `)
      .eq("candidat_id", candidatId)
      .in("date", dates);

    // Compose 7 jours
    const result: JourPlanningCandidat[] = dates.map((date) => {
      const dispoRow = (disponibilites ?? []).find((d) => d.date === date) ?? null;
      let cs = (commandes ?? []).filter((c) => c.date === date) as unknown as CommandeRowLike[];

      // fallback planif si aucune commande
      if (!cs || cs.length === 0) {
        const ps = (planif ?? []).filter((p: any) => p.date === date).map(buildFromPlanif);
        cs = ps;
      }

      const composed = composeJour(date, dispoRow, cs);
      return {
        date,
        secteur: composed.secteur,
        service: composed.service,
        commande: composed.commande,
        autresCommandes: composed.autresCommandes,
        disponibilite: composed.disponibilite,
      };
    });

    setPlanning(result);
    fetchWeeklyHours(currentStartDate);
  }, [candidatId, dates, composeJour, currentStartDate, fetchWeeklyHours]);

  useEffect(() => {
    fetchWeek();
  }, [fetchWeek]);

  // Map rapide par date
  const byDate: Record<string, JourPlanningCandidat> = useMemo(() => {
    const m: Record<string, JourPlanningCandidat> = {};
    planning.forEach((j) => (m[j.date] = j));
    return m;
  }, [planning]);

  // Statut global (colonne gauche)
  const hasDispo = useMemo(() => planning.some((j) => j.disponibilite?.statut === "Dispo"), [planning]);

  // ✅ Secteur à afficher dans la colonne gauche :
  // on prend le premier jour où il y a vraiment quelque chose (commande ou dispo),
  // pour éviter d'utiliser un secteur par défaut ("Étages") sur un jour totalement vide.
  const secteurColonne = useMemo(() => {
    const j = planning.find(
      (d) =>
        d &&
        d.secteur &&
        (d.commande || d.disponibilite || (d.autresCommandes && d.autresCommandes.length > 0))
    );
    return j?.secteur || "";
  }, [planning]);

  /* -----------------------------
     Rendu
  ----------------------------- */
  return (
    <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
      {/* Navigation (semaine) */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <Button variant="ghost" size="icon" onClick={() => setCurrentStartDate((p) => subWeeks(p, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-sm font-medium text-gray-800">Semaine {numeroSemaine}</div>
        <Button variant="ghost" size="icon" onClick={() => setCurrentStartDate((p) => addWeeks(p, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Entête jours */}
      <div
        className="grid bg-gray-800 text-white text-sm font-medium"
        style={{ gridTemplateColumns: `[col0] ${COL_L}px [col1] repeat(7, minmax(0, 1fr))` }}
      >
        <div className="p-3 border-r flex items-center justify-center min-h-[56px]">
          Semaine {numeroSemaine}
        </div>
        {dates.map((_, i) => {
          const jour = addDays(currentStartDate, i);
          return (
            <div key={i} className="p-3 border-r text-center leading-tight min-h-[56px]">
              <div>{format(jour, "eeee", { locale: fr })}</div>
              <div className="text-xs opacity-90">{format(jour, "dd MMMM", { locale: fr })}</div>
            </div>
          );
        })}
      </div>

      {/* Ligne unique (candidat) */}
      <div
        className="grid text-sm"
        style={{ gridTemplateColumns: `[col0] ${COL_L}px [col1] repeat(7, minmax(0, 1fr))` }}
      >
        {/* Colonne gauche (mêmes données que la nouvelle vue) */}
        <ColonneCandidate
          nomComplet={candidatNomPrenom || "Candidat ?"}
          secteur={secteurColonne}
          semaine={String(numeroSemaine)}
          statutGlobal={hasDispo ? "Dispo" : "Non Dispo"}
          candidatId={candidatId}
          totalHeures={totalHeures}
        />

        {/* 7 cellules */}
        {dates.map((dateStr, i) => {
          const j = byDate[dateStr];
          const dispo = j?.disponibilite;
          const secteurCell = j?.secteur || planning[0]?.secteur || "Étages";
          const isEtages = secteurCell === "Étages";

          // commandes visibles du jour
          const rawCmds: CommandeFull[] = [
            ...(j?.commande ? [j.commande] : []),
            ...((j?.autresCommandes || []) as CommandeFull[]),
          ].filter(Boolean);
          const valides = rawCmds.filter((c) => isPlanif(c.statut));

          const missionMatin = valides.find((c) => !!c.heure_debut_matin && !!c.heure_fin_matin);
          const missionSoir  = valides.find((c) => !!c.heure_debut_soir  && !!c.heure_fin_soir);

          const colorDispo = disponibiliteColors["Dispo"]?.bg || "#d1d5db";
          const colorNonDispo = disponibiliteColors["Non Dispo"]?.bg || "#6b7280";

          const minH = isEtages ? FULL_H_ETAGES : ROW_H_OTHERS;

          const secondary = j?.autresCommandes && j.autresCommandes.length > 0 ? j.autresCommandes[0] : undefined;

          return (
            <div key={i} className="border-r p-2 min-w-0 relative" style={{ minHeight: minH, overflow: "hidden" }}>
              {/* Icône “info” si commande secondaire */}
              {secondary && (
                <Popover>
                  <PopoverTrigger asChild>
                    <div
                      className="absolute top-2 right-2 bg-white rounded-full p-1 shadow z-20 translate-x-1/4 -translate-y-1/4 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                      title="Autre mission ce jour"
                    >
                      <AlertCircle className="w-5 h-5 text-[#840404]" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    className="text-sm max-w-xs space-y-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="font-semibold">{secondary.client?.nom || "Client ?"}</div>
                    {secondary.service && <div>{secondary.service}</div>}
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>
                        {secondary.heure_debut_matin
                          ? `${fmt(secondary.heure_debut_matin)} - ${fmt(secondary.heure_fin_matin)}`
                          : secondary.heure_debut_soir
                          ? `${fmt(secondary.heure_debut_soir)} - ${fmt(secondary.heure_fin_soir)}`
                          : "Non renseigné"}
                      </span>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Étages => 1 bloc plein */}
              {isEtages ? (
                <div className="w-full h-full min-w-0 overflow-hidden">
                  {missionMatin || missionSoir ? (
                    <VignettePlanifiee
                      client={(missionMatin || missionSoir)!.client?.nom || "Client ?"}
                      hours={[
                        missionMatin ? `${fmt(missionMatin.heure_debut_matin)} ${fmt(missionMatin.heure_fin_matin)}` : "",
                        missionSoir ? `${fmt(missionSoir.heure_debut_soir)} ${fmt(missionSoir.heure_fin_soir)}` : "",
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                    />
                  ) : dispo?.matin === true ? (
                    <VignetteColor
                      color={colorDispo}
                      onClick={() =>
                        openDispo({
                          date: dateStr,
                          secteur: secteurCell,
                          candidatId,
                          service: j?.service || "",
                          disponibilite: dispo || null,
                          candidatNomPrenom: candidatNomPrenom,
                          creneauVerrouille: "matin",
                        })
                      }
                    />
                  ) : dispo?.matin === false ? (
                    <VignetteColor
                      color={colorNonDispo}
                      onClick={() =>
                        openDispo({
                          date: dateStr,
                          secteur: secteurCell,
                          candidatId,
                          service: j?.service || "",
                          disponibilite: dispo || null,
                          candidatNomPrenom: candidatNomPrenom,
                          creneauVerrouille: "matin",
                        })
                      }
                    />
                  ) : (
                    <VignetteEmpty
                      onAdd={() =>
                        openDispo({
                          date: dateStr,
                          secteur: secteurCell,
                          candidatId,
                          service: j?.service || "",
                          disponibilite: dispo || null,
                          candidatNomPrenom: candidatNomPrenom,
                          creneauVerrouille: "matin",
                        })
                      }
                    />
                  )}
                </div>
              ) : (
                // Autres secteurs => 2 demi-blocs (matin/soir)
                <div
                  className="grid h-full gap-[6px] min-w-0"
                  style={{ gridTemplateRows: `repeat(2, minmax(${HALF_H}px, ${HALF_H}px))`, overflow: "hidden" }}
                >
                  {/* Matin */}
                  <div className="w-full h-full min-w-0 overflow-hidden">
                    {missionMatin ? (
                      <VignettePlanifiee
                        client={missionMatin.client?.nom || "Client ?"}
                        hours={`${fmt(missionMatin.heure_debut_matin)} ${fmt(missionMatin.heure_fin_matin)}`}
                      />
                    ) : dispo?.matin === true ? (
                      <VignetteColor
                        color={colorDispo}
                        onClick={() =>
                          openDispo({
                            date: dateStr,
                            secteur: secteurCell,
                            candidatId,
                            service: j?.service || "",
                            disponibilite: dispo || null,
                            candidatNomPrenom: candidatNomPrenom,
                            creneauVerrouille: "matin",
                          })
                        }
                      />
                    ) : dispo?.matin === false ? (
                      <VignetteColor
                        color={colorNonDispo}
                        onClick={() =>
                          openDispo({
                            date: dateStr,
                            secteur: secteurCell,
                            candidatId,
                            service: j?.service || "",
                            disponibilite: dispo || null,
                            candidatNomPrenom: candidatNomPrenom,
                            creneauVerrouille: "matin",
                          })
                        }
                      />
                    ) : (
                      <VignetteEmpty
                        onAdd={() =>
                          openDispo({
                            date: dateStr,
                            secteur: secteurCell,
                            candidatId,
                            service: j?.service || "",
                            disponibilite: dispo || null,
                            candidatNomPrenom: candidatNomPrenom,
                            creneauVerrouille: "matin",
                          })
                        }
                      />
                    )}
                  </div>

                  {/* Soir */}
                  <div className="w-full h-full min-w-0 overflow-hidden">
                    {missionSoir ? (
                      <VignettePlanifiee
                        client={missionSoir.client?.nom || "Client ?"}
                        hours={`${fmt(missionSoir.heure_debut_soir)} ${fmt(missionSoir.heure_fin_soir)}`}
                      />
                    ) : dispo?.soir === true ? (
                      <VignetteColor
                        color={colorDispo}
                        onClick={() =>
                          openDispo({
                            date: dateStr,
                            secteur: secteurCell,
                            candidatId,
                            service: j?.service || "",
                            disponibilite: dispo || null,
                            candidatNomPrenom: candidatNomPrenom,
                            creneauVerrouille: "soir",
                          })
                        }
                      />
                    ) : dispo?.soir === false ? (
                      <VignetteColor
                        color={colorNonDispo}
                        onClick={() =>
                          openDispo({
                            date: dateStr,
                            secteur: secteurCell,
                            candidatId,
                            service: j?.service || "",
                            disponibilite: dispo || null,
                            candidatNomPrenom: candidatNomPrenom,
                            creneauVerrouille: "soir",
                          })
                        }
                      />
                    ) : (
                      <VignetteEmpty
                        onAdd={() =>
                          openDispo({
                            date: dateStr,
                            secteur: secteurCell,
                            candidatId,
                            service: j?.service || "",
                            disponibilite: dispo || null,
                            candidatNomPrenom: candidatNomPrenom,
                            creneauVerrouille: "soir",
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog de saisie (uniquement quand ouvert) */}
      {dispoDialog.open && dispoDialog.date && (
        <CandidateJourneeDialog
          open={dispoDialog.open}
          onClose={closeDispo}
          date={dispoDialog.date}
          secteur={dispoDialog.secteur}
          candidatId={dispoDialog.candidatId}
          service={dispoDialog.service}
          disponibilite={dispoDialog.disponibilite}
          onSuccess={onDialogSuccess}
          candidatNomPrenom={dispoDialog.candidatNomPrenom}
          creneauVerrouille={dispoDialog.creneauVerrouille}
        />
      )}
    </div>
  );
}
