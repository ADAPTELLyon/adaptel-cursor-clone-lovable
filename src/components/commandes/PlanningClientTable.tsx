import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, addDays, getWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { indicateurColors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import type { CommandeWithCandidat, JourPlanning } from "@/types/types-front";
import { ColonneClient } from "@/components/commandes/ColonneClient";
import NouvelleCommandeDialog from "@/components/commandes/NouvelleCommandeDialog"
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
  const [commandeToEdit, setCommandeToEdit] = useState<any | null>(null)
  const [openEdit, setOpenEdit] = useState(false)

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

  const updateHeure = async (
    commande: CommandeWithCandidat,
    champ: keyof CommandeWithCandidat,
    nouvelleValeur: string
  ) => {
    const isChampHoraire = champsHoraire.includes(champ);
    const isMotif = champ === "motif_contrat";
    const isValidTime = !isChampHoraire || /^\d{2}:\d{2}$/.test(nouvelleValeur);
    if (!isValidTime) return;

    const { data: authData } = await supabase.auth.getUser();
    const userEmail = authData?.user?.email || null;

    const { data: userApp } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("email", userEmail)
      .single();

    const userId = userApp?.id || null;

    const { error } = await supabase
      .from("commandes")
      .update({ [champ]: nouvelleValeur })
      .eq("id", commande.id);

    if (!error && userId) {
      const action = isChampHoraire
        ? "modification_horaire"
        : isMotif
        ? "modification_motif"
        : "modification_commentaire";

      const description = isChampHoraire
        ? `Changement de ${String(champ)} à ${nouvelleValeur}`
        : isMotif
        ? `Motif contrat mis à jour : ${nouvelleValeur || "—"}`
        : `Nouveau commentaire : ${nouvelleValeur}`;

      await supabase.from("historique").insert({
        table_cible: "commandes",
        ligne_id: commande.id,
        action,
        description,
        user_id: userId,
        date_action: new Date().toISOString(),
        apres: isChampHoraire
          ? { champ, valeur: nouvelleValeur }
          : isMotif
          ? { motif_contrat: nouvelleValeur }
          : { commentaire: nouvelleValeur },
      });
    }
  };

  const groupesParSemaineEtSecteur = useMemo(() => {
    const groupes: Record<string, Record<string, Record<string, JourPlanning[]>>> = {};

    Object.values(planning)
      .flat()
      .forEach((jour) => {
        jour.commandes.forEach((commande) => {
          if (!commande.client) return;
          if (clientId && commande.client_id !== clientId) return;

          const semaine = getWeek(new Date(jour.date), { weekStartsOn: 1 }).toString();
          const secteur = jour.secteur;
          const clientNom = commande.client.nom;
          const service = commande.service || "";
          const missionSlot = commande.mission_slot;

          const groupKey = `${clientNom}||${secteur}||${semaine}||${service}||${missionSlot}`;

          groupes[semaine] = groupes[semaine] || {};
          groupes[semaine][secteur] = groupes[semaine][secteur] || {};
          groupes[semaine][secteur][groupKey] =
            groupes[semaine][secteur][groupKey] || [];

          let jourExistant = groupes[semaine][secteur][groupKey].find(
            (j) => j.date === jour.date
          );

          if (jourExistant) {
            jourExistant.commandes.push(commande);
          } else {
            groupes[semaine][secteur][groupKey].push({
              ...jour,
              commandes: [commande],
            });
          }
        });
      });

    return groupes;
  }, [planning, clientId]);

  // -------- Helper de normalisation (pour tri alpha cohérent)
  const norm = (s: string = "") =>
    s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-8 mt-8">
        {Object.entries(groupesParSemaineEtSecteur).map(([semaine, secteurs]) => {
          const baseDate = startOfWeek(new Date(), { weekStartsOn: 1 });
          const semaineDifference =
            parseInt(semaine) - getWeek(baseDate, { weekStartsOn: 1 });
          const lundiSemaine = addDays(baseDate, semaineDifference * 7);

          const jours = Array.from({ length: 7 }, (_, i) => {
            const jour = addDays(lundiSemaine, i);
            return {
              date: jour,
              dateStr: format(jour, "yyyy-MM-dd"),
              label: format(jour, "eeee dd MMMM", { locale: fr }),
            };
          });

          // --- NOUVEAU : rang de créneau DÉTERMINISTE basé sur le PREMIER jour qui a des heures
          // Matin/Midi = 0, Soir = 1, Nuit = 2. Fallback 0 si rien trouvé.
          const getCreneauRankDeterministe = (ligne: JourPlanning[]) => {
            for (const j of jours) {
              const found = ligne.find(
                (x) => format(new Date(x.date), "yyyy-MM-dd") === j.dateStr
              );
              if (!found) continue;
              // Une ligne a au plus une commande par jour (dans ce groupKey)
              const c = found.commandes[0];
              if (!c) continue;

              const hasMatin = !!(c.heure_debut_matin || c.heure_fin_matin);
              const hasSoir  = !!(c.heure_debut_soir  || c.heure_fin_soir);
              const hasNuit  = !!(c as any).heure_debut_nuit || !!(c as any).heure_fin_nuit;

              if (hasMatin && !hasSoir && !hasNuit) return 0; // Matin/Midi
              if (!hasMatin && hasSoir && !hasNuit) return 1; // Soir
              if (!hasMatin && !hasSoir && hasNuit) return 2; // Nuit

              // Cas mixtes sur le même jour (sécurité) : Matin < Soir < Nuit
              if (hasMatin) return 0;
              if (hasSoir)  return 1;
              if (hasNuit)  return 2;
            }
            return 0;
          };

          return Object.entries(secteurs).map(([secteur, groupes]) => {
            const semaineTexte = `Semaine ${semaine} • ${secteur}`;

            return (
              <div
                key={`${semaine}-${secteur}`}
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
                    // Clé = clientNom || secteur || semaine || service || missionSlot
                    const [aClient, , , aService = "", aSlot] = aKey.split("||");
                    const [bClient, , , bService = "", bSlot] = bKey.split("||");

                    // 1) Client (inchangé)
                    const cmpClient = norm(aClient).localeCompare(norm(bClient));
                    if (cmpClient !== 0) return cmpClient;

                    // 2) Service (inchangé) — "" ne casse pas l'ordre actuel
                    const cmpService = norm(aService).localeCompare(norm(bService));
                    if (cmpService !== 0) return cmpService;

                    // 3) NOUVEAU : ordre visuel déterministe par créneau
                    const ra = getCreneauRankDeterministe(aLigne as JourPlanning[]);
                    const rb = getCreneauRankDeterministe(bLigne as JourPlanning[]);
                    if (ra !== rb) return ra - rb;

                    // 4) Fallback : mission_slot (inchangé)
                    const ai = parseInt(aSlot, 10) || 0;
                    const bi = parseInt(bSlot, 10) || 0;
                    return ai - bi;
                  })
                  .map(([groupKey, ligne]) => {
                    const [clientNom, secteurNom, _, service, missionSlotStr] =
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
                          semaine={semaine}
                          nbEnRecherche={nbEnRecherche}
                          commandeIdsLigne={commandeIdsLigne}
                          semaineDate={lundiSemaine.toISOString()}
                          commandes={toutesCommandes}
                          clientId={ligneClientId}
                          onOpenClientEdit={onOpenClientEdit}
                          onOpenCommandeEdit={(commande) => {
                            setCommandeToEdit(commande)
                            setOpenEdit(true)
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
