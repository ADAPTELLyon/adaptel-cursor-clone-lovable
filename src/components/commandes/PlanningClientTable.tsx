// src/components/commandes/PlanningClientTable.tsx
import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, addDays, getWeek, getWeekYear } from "date-fns";
import { fr } from "date-fns/locale";
import { indicateurColors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import type { CommandeWithCandidat, JourPlanning } from "@/types/types-front";
import { ColonneClient } from "@/components/commandes/ColonneClient";
import NouvelleCommandeDialog from "@/components/commandes/NouvelleCommandeDialog";
import { CellulePlanning } from "@/components/commandes/CellulePlanning";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PlanningClientTableProps {
  planning: Record<string, JourPlanning[]>;
  selectedSecteurs: string[];
  selectedSemaine: string;
  onRefresh: () => void;
  refreshTrigger?: number;
  clientId?: string;
  onOpenClientEdit?: (clientId: string) => void;
}

export function PlanningClientTable({
  planning,
  selectedSecteurs,
  selectedSemaine,
  onRefresh,
  refreshTrigger,
  clientId,
  onOpenClientEdit,
}: PlanningClientTableProps) {
  const [editId, setEditId] = useState<string | null>(null);
  const [heureTemp, setHeureTemp] = useState<Record<string, string>>({});
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentaireTemp, setCommentaireTemp] = useState<string>("");
  const [lastClickedCommandeId, setLastClickedCommandeId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [commandeToEdit, setCommandeToEdit] = useState<any | null>(null);
  const [openEdit, setOpenEdit] = useState(false);

  useEffect(() => {
    const elt = document.getElementById("commandes-filters");
    if (elt) {
      const update = () => setOffset(elt.getBoundingClientRect().bottom);
      update();
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
  }, []);

  const champsHoraire: (keyof CommandeWithCandidat)[] = [
    "heure_debut_matin",
    "heure_fin_matin",
    "heure_debut_soir",
    "heure_fin_soir",
  ];

  // 🔧 Normalisation: champ vide => NULL (suppression). "00:00" reste une heure valide.
  const normalizeTimeValue = (val: string | null | undefined) => {
    if (val == null) return null;
    const v = String(val).trim();
    if (v === "") return null;
    return v; // ex: "00:00" conservé tel quel
    };

  const updateHeure = async (
    commande: CommandeWithCandidat,
    champ: keyof CommandeWithCandidat,
    nouvelleValeur: string
  ) => {
    const isChampHoraire = champsHoraire.includes(champ);
    const isMotif = champ === "motif_contrat";

    // ✅ Autoriser effacement: si champ horaire vide, on passe NULL ; "00:00" est accepté comme valide
    const normalized = isChampHoraire ? normalizeTimeValue(nouvelleValeur) : nouvelleValeur;

    // ✅ Valider uniquement si non vide: "HH:MM"
    const isValidTime =
      !isChampHoraire || normalized === null || /^\d{2}:\d{2}$/.test(String(normalized));
    if (!isValidTime) return;

    const { data: authData } = await supabase.auth.getUser();
    const userEmail = authData?.user?.email || null;

    const { data: userApp } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("email", userEmail)
      .single();

    const userId = userApp?.id || null;

    // 1) Met à jour la table COMMANDES
    const { error } = await supabase
      .from("commandes")
      .update({ [champ]: normalized as any })
      .eq("id", commande.id);

    if (!error && userId) {
      const isTime = isChampHoraire;
      const action = isTime
        ? "modification_horaire"
        : isMotif
        ? "modification_motif"
        : "modification_commentaire";

      const description = isTime
        ? `Changement de ${String(champ)} à ${normalized ?? "—"}`
        : isMotif
        ? `Motif contrat mis à jour : ${normalized || "—"}`
        : `Nouveau commentaire : ${normalized || "—"}`;

      await supabase.from("historique").insert({
        table_cible: "commandes",
        ligne_id: commande.id,
        action,
        description,
        user_id: userId,
        date_action: new Date().toISOString(),
        apres: isTime
          ? { champ, valeur: normalized }
          : isMotif
          ? { motif_contrat: normalized }
          : { commentaire: normalized },
      });
    }

    // 2) 🔁 Sync immédiate sur la table PLANIFICATION (même champ, même valeur)
    if (isChampHoraire) {
      await supabase
        .from("planification")
        .update({ [champ]: normalized as any })
        .eq("commande_id", commande.id);
    }
  };

  /**
   * AGRÉGATION **ANNEE + SEMAINE**
   * -> clé de 1er niveau: "YYYY-Www" (ex: "2026-W01")
   * -> évite les collisions entre années (S01 2025 vs S01 2026)
   * -> résout les décalages d’affichage inter-années
   */
  const groupesParSemaineEtSecteur = useMemo(() => {
    const groupes: Record<string, Record<string, Record<string, JourPlanning[]>>> = {};

    Object.entries(planning).forEach(([clientNom, jours]) => {
      jours.forEach((jour) => {
        jour.commandes.forEach((commande) => {
          if (clientId && commande.client_id !== clientId) return;

          const d = new Date(jour.date);
          const week = getWeek(d, { weekStartsOn: 1 });
          const weekYear = getWeekYear(d, { weekStartsOn: 1 });
          const semaineKey = `${weekYear}-W${String(week).padStart(2, "0")}`;

          const secteur = jour.secteur;
          const service = commande.service || "";
          const missionSlot = commande.mission_slot;

          // NB: on ne dépend pas de "semaine" dans la clé de ligne (on a déjà semaineKey au niveau au-dessus)
          const groupKey = `${clientNom}||${secteur}||${service}||${missionSlot}`;

          if (!groupes[semaineKey]) groupes[semaineKey] = {};
          if (!groupes[semaineKey][secteur]) groupes[semaineKey][secteur] = {};
          if (!groupes[semaineKey][secteur][groupKey]) groupes[semaineKey][secteur][groupKey] = [];

          const arr = groupes[semaineKey][secteur][groupKey];

          const existing = arr.find((j) => j.date === jour.date && j.secteur === jour.secteur && (j.service ?? "") === (jour.service ?? "") && (j.mission_slot ?? 0) === (jour.mission_slot ?? 0));
          if (existing) {
            existing.commandes.push(commande);
          } else {
            arr.push({
              ...jour,
              commandes: [commande],
            });
          }
        });
      });
    });

    return groupes;
  }, [planning, clientId]);

  // -------- Helper de normalisation (pour tri alpha cohérent)
  const norm = (s: string = "") =>
    s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

  // ➕ Helper: tri "YYYY-Www" croissant
  const sortYearWeekAsc = (a: string, b: string) => {
    const [ay, aw] = a.split("-W");
    const [by, bw] = b.split("-W");
    const ya = parseInt(ay, 10);
    const yb = parseInt(by, 10);
    if (ya !== yb) return ya - yb;
    return (parseInt(aw, 10) || 0) - (parseInt(bw, 10) || 0);
  };

  // ➕ Helper: lundi de la semaine basé sur une date RÉELLE du groupe (sécurise le changement d'année)
  const mondayFromGroup = (secteurs: Record<string, Record<string, JourPlanning[]>>) => {
    // On va chercher une date existante dans n'importe quelle ligne/groupe
    for (const lignes of Object.values(secteurs)) {
      for (const ligne of Object.values(lignes)) {
        const ref = ligne[0]?.date;
        if (ref) return startOfWeek(new Date(ref), { weekStartsOn: 1 });
      }
    }
    // fallback théorique (ne devrait pas arriver si le groupe contient des commandes)
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-8 mt-8">
        {Object.entries(groupesParSemaineEtSecteur)
          .sort(([a], [b]) => sortYearWeekAsc(a, b))
          .map(([semaineKey, secteurs]) => {
            const [yearStr, wStr] = semaineKey.split("-W");
            const year = parseInt(yearStr, 10);
            const weekNum = parseInt(wStr, 10);

            // ✅ Lundi correct basé sur une VRAIE date du groupe (gère les bascules d'année)
            const lundiSemaine = mondayFromGroup(secteurs);

            const jours = Array.from({ length: 7 }, (_, i) => {
              const jour = addDays(lundiSemaine, i);
              return {
                date: jour,
                dateStr: format(jour, "yyyy-MM-dd"),
                label: format(jour, "eeee dd MMMM", { locale: fr }),
              };
            });

            // Détermination de l'ordre visuel par créneau (Matin/Midi < Soir < Nuit)
            const getCreneauRankDeterministe = (ligne: JourPlanning[]) => {
              for (const j of jours) {
                const found = ligne.find(
                  (x) => format(new Date(x.date), "yyyy-MM-dd") === j.dateStr
                );
                if (!found) continue;
                const c = found.commandes[0];
                if (!c) continue;

                const hasMatin = !!(c.heure_debut_matin || c.heure_fin_matin);
                const hasSoir  = !!(c.heure_debut_soir  || c.heure_fin_soir);
                const hasNuit  = !!(c as any).heure_debut_nuit || !!(c as any).heure_fin_nuit;

                if (hasMatin && !hasSoir && !hasNuit) return 0;
                if (!hasMatin && hasSoir && !hasNuit) return 1;
                if (!hasMatin && !hasSoir && hasNuit) return 2;

                if (hasMatin) return 0;
                if (hasSoir)  return 1;
                if (hasNuit)  return 2;
              }
              return 0;
            };

            return Object.entries(secteurs).map(([secteur, groupes]) => {
              const semaineTexte = `Semaine ${String(weekNum)} • ${secteur} • ${year}`;

              return (
                <div
                  key={`${semaineKey}-${secteur}`}
                  className="border rounded-lg overflow-hidden shadow-sm"
                >
                  {/* En-tête des jours */}
                  <div
                    className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-gray-800 text-sm font-medium text-white sticky z-[10]"
                    style={{ top: offset }}
                  >
                    <div className="p-4 border-r flex items-center justify-center min-h-[64px]">
                      {semaineTexte}
                    </div>
                    {jours.map((jour, index) => {
                      let totalMissions = 0;
                      let nbEnRecherche = 0;
                      let nbValides = 0;

                      Object.values(groupes).forEach((ligne) => {
                        const jourCell = ligne.find(
                          (j) => format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr
                        );
                        if (jourCell) {
                          totalMissions += jourCell.commandes.length;
                          nbEnRecherche += jourCell.commandes.filter(
                            (cmd) => cmd.statut === "En recherche"
                          ).length;
                          nbValides += jourCell.commandes.filter(
                            (cmd) => cmd.statut === "Validé"
                          ).length;
                        }
                      });

                      return (
                        <div
                          key={index}
                          className="p-4 border-r text-center relative leading-tight min-h-[64px]"
                        >
                          <div className="text-sm font-semibold leading-tight">
                            {jour.label.split(" ")[0]}
                          </div>
                          <div className="text-sm leading-tight">
                            {jour.label.split(" ").slice(1).join(" ")}
                          </div>
                          {totalMissions === 0 ? (
                            <div className="absolute top-1 right-1">
                              <div className="h-5 w-5 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs">
                                –
                              </div>
                            </div>
                          ) : nbEnRecherche > 0 ? (
                            <div
                              className="absolute top-1 right-1 h-5 w-5 text-xs rounded-full flex items-center justify-center"
                              style={{
                                backgroundColor: indicateurColors["En recherche"],
                                color: "#1f2937",
                              }}
                            >
                              {nbEnRecherche}
                            </div>
                          ) : (
                            <div className="absolute top-1 right-1">
                              <div className="h-5 w-5 rounded-full bg-[#a9d08e] text-xs flex items-center justify-center text-gray-800">
                                {nbValides}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Lignes planning */}
                  {Object.entries(groupes)
                    .sort(([aKey, aLigne], [bKey, bLigne]) => {
                      // Clé = clientNom || secteur || service || missionSlot
                      const [aClient, , aService = "", aSlot] = aKey.split("||");
                      const [bClient, , bService = "", bSlot] = bKey.split("||");

                      const cmpClient = norm(aClient).localeCompare(norm(bClient));
                      if (cmpClient !== 0) return cmpClient;

                      const cmpService = norm(aService).localeCompare(norm(bService));
                      if (cmpService !== 0) return cmpService;

                      const ra = getCreneauRankDeterministe(aLigne as JourPlanning[]);
                      const rb = getCreneauRankDeterministe(bLigne as JourPlanning[]);
                      if (ra !== rb) return ra - rb;

                      const ai = parseInt(aSlot, 10) || 0;
                      const bi = parseInt(bSlot, 10) || 0;
                      return ai - bi;
                    })
                    .map(([groupKey, ligne]) => {
                      const [clientNom, secteurNom, service, missionSlotStr] =
                        groupKey.split("||");
                      const missionSlot = parseInt(missionSlotStr);
                      const nbEnRecherche = ligne
                        .flatMap((j) => j.commandes)
                        .filter((cmd) => cmd.statut === "En recherche").length;
                      const commandeIdsLigne = ligne.flatMap((j) =>
                        j.commandes.map((c) => c.id)
                      );
                      const toutesCommandes = ligne.flatMap((j) => j.commandes);
                      const ligneClientId = ligne[0]?.commandes[0]?.client_id;

                      return (
                        <div
                          key={groupKey}
                          className="grid grid-cols-[260px_repeat(7,minmax(0,1fr))] bg-white text-sm font-medium text-gray-800 border-b"
                        >
                          <ColonneClient
                            clientNom={clientNom}
                            secteur={secteurNom}
                            service={service}
                            // on continue d'afficher uniquement le n° de semaine ici
                            semaine={String(weekNum)}
                            nbEnRecherche={nbEnRecherche}
                            commandeIdsLigne={commandeIdsLigne}
                            semaineDate={lundiSemaine.toISOString()}
                            commandes={toutesCommandes}
                            clientId={ligneClientId}
                            onOpenClientEdit={onOpenClientEdit}
                            onOpenCommandeEdit={(commande) => {
                              setCommandeToEdit(commande);
                              setOpenEdit(true);
                            }}
                          />
                          {jours.map((jour, index) => {
                            const jourCell = ligne.find(
                              (j) =>
                                format(new Date(j.date), "yyyy-MM-dd") === jour.dateStr
                            );
                            const commande = jourCell?.commandes[0];
                            const jourLabel = format(jour.date, "EEEE dd MMMM", { locale: fr });

                            return (
                              <Tooltip key={index}>
                                <TooltipTrigger asChild>
                                  <div
                                    className="border-r p-2 h-28 relative"
                                    data-commande-id={commande?.id}
                                    onClick={() => {
                                      if (commande?.id) {
                                        setLastClickedCommandeId(commande.id);
                                        localStorage.setItem(
                                          "lastClickedCommandeId",
                                          commande.id
                                        );
                                      }
                                    }}
                                  >
                                    <CellulePlanning
                                      commande={commande}
                                      secteur={secteurNom}
                                      editId={editId}
                                      heureTemp={heureTemp}
                                      setEditId={setEditId}
                                      setHeureTemp={setHeureTemp}
                                      updateHeure={updateHeure}
                                      commentaireTemp={commentaireTemp}
                                      setCommentaireTemp={setCommentaireTemp}
                                      editingCommentId={editingCommentId}
                                      setEditingCommentId={setEditingCommentId}
                                      date={jour.dateStr}
                                      clientId={ligneClientId}
                                      service={service}
                                      onSuccess={onRefresh}
                                      lastClickedCommandeId={lastClickedCommandeId}
                                      missionSlot={missionSlot}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-sm capitalize">
                                  {jourLabel}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      );
                    })}
                </div>
              );
            });
          })}
      </div>

      <NouvelleCommandeDialog
        open={openEdit}
        onOpenChange={(o) => {
          setOpenEdit(o);
          if (!o) setCommandeToEdit(null);
        }}
        onRefreshDone={onRefresh}
        commande={commandeToEdit}
      />
    </TooltipProvider>
  );
}
