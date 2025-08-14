import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useClientsBySecteur } from "@/hooks/useClientsBySecteur"
import { usePostesTypesByClient } from "@/hooks/usePostesTypesByClient"
import { useEffect, useState } from "react"
import { format, addWeeks, startOfWeek, addDays } from "date-fns"
import { fr } from "date-fns/locale"
import { supabase } from "@/lib/supabase"
import CommandeFormGauche from "./CommandeFormGauche"
import CommandeFormDroite from "./CommandeFormDroite"
import type { PosteType } from "@/types/types-front"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export default function NouvelleCommandeDialog({
  open,
  onOpenChange,
  onRefreshDone,
  commande, // <- nouvelle prop
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefreshDone: () => void;
  commande?: any; // ou ton vrai type si tu veux, mais "any" ne casse rien pour l’instant
}) {
  const navigate = useNavigate()

  const [secteur, setSecteur] = useState("")
  const [clientId, setClientId] = useState("")
  const [service, setService] = useState("")
  const [semaine, setSemaine] = useState("")
  const [commentaire, setCommentaire] = useState("")
  const [complementMotif, setComplementMotif] = useState("")
  const [motif, setMotif] = useState("Extra Usage constant")
  const [joursState, setJoursState] = useState<Record<string, boolean>>({})
  const [heuresParJour, setHeuresParJour] = useState<Record<string, any>>({})
  const [posteTypeId, setPosteTypeId] = useState("")
  const [semainesDisponibles, setSemainesDisponibles] = useState<
    { value: string; label: string; startDate: Date }[]
  >([])

  useEffect(() => {
    const semaineObj = semainesDisponibles.find(s => s.value === semaine)
    if (!semaineObj) return

    const newJoursState: Record<string, boolean> = {}
    for (let i = 0; i < 7; i++) {
      const dayKey = format(addDays(semaineObj.startDate, i), "yyyy-MM-dd")
      newJoursState[dayKey] = false
    }
    if (!commande) {
      setJoursState(newJoursState)
      setHeuresParJour({})
    }

  }, [semaine, semainesDisponibles, commande])

  const { clients } = useClientsBySecteur(secteur)
  const selectedClient = clients.find((c) => c.id === clientId)
  const services = selectedClient?.services || []

  const { postesTypes } = usePostesTypesByClient(clientId, secteur)
  const selectedPosteType = postesTypes.find((pt) => pt.id === posteTypeId)

  const semaineObj = semainesDisponibles.find((s) => s.value === semaine)
  const joursSemaine = semaineObj
    ? Array.from({ length: 7 }, (_, i) => {
        const date = addDays(semaineObj.startDate, i)
        return {
          jour: format(date, "EEEE dd MMMM", { locale: fr }),
          key: format(date, "yyyy-MM-dd"),
        }
      })
    : []

  useEffect(() => {
    const semaines: any[] = []
    const today = new Date()
    const start = addWeeks(today, -6)
    const end = addWeeks(today, 16)
    let current = startOfWeek(start, { weekStartsOn: 1 })

    while (current <= end) {
      const weekNumber = getWeekNumber(current)
      const weekStart = format(current, "dd MMM", { locale: fr })
      const weekEnd = format(addDays(current, 6), "dd MMM", { locale: fr })
      semaines.push({
        value: weekNumber.toString(),
        label: `Semaine ${weekNumber} - ${weekStart} au ${weekEnd}`,
        startDate: current,
      })
      current = addWeeks(current, 1)
    }

    setSemainesDisponibles(semaines)
    setSemaine(getWeekNumber(new Date()).toString())
  }, [])

  useEffect(() => {
    if (!open) return;
  
    // Mode création : on réinitialise comme avant
    if (!commande) {
      setSecteur("");
      setClientId("");
      setService("");
      setSemaine(getWeekNumber(new Date()).toString());
      setCommentaire("");
      setComplementMotif("");
      setMotif("Extra Usage constant");
      setJoursState({});
      setHeuresParJour({});
      setPosteTypeId("");
      return;
    }
  
    // ---- Mode édition : tout pré-remplir proprement ----
    const run = async () => {
      // 1) Pré-remplir la partie gauche (comme avant)
      const dateCmd = new Date(commande.date);
      const monday = startOfWeek(dateCmd, { weekStartsOn: 1 });
      const weekValue = getWeekNumber(dateCmd).toString();
  
      setSecteur(commande.secteur || "");
      setClientId(commande.client_id || "");
      setService(commande.service || "");
      setSemaine(weekValue);
      setCommentaire(commande.commentaire || "");
      setComplementMotif(commande.complement_motif || "")
      setMotif(commande.motif_contrat || "Extra Usage constant");
      setJoursState({ [commande.date]: true })
      setHeuresParJour({
        [commande.date]: {
          debutMatin: commande.heure_debut_matin || "",
          finMatin: commande.heure_fin_matin || "",
          debutSoir: commande.heure_debut_soir || "",
          finSoir: commande.heure_fin_soir || "",
          nbPersonnes: 1,
        }
      })
      setPosteTypeId("");
  
      // 2) Construire la semaine complète (7 jours)
      const fullWeek: Record<string, boolean> = {};
      for (let i = 0; i < 7; i++) {
        const key = format(addDays(monday, i), "yyyy-MM-dd");
        fullWeek[key] = false;
      }
  
      // 3) Charger TOUTES les commandes de la même "ligne"
      const weekStart = format(monday, "yyyy-MM-dd");
      const weekEnd = format(addDays(monday, 6), "yyyy-MM-dd");
  
      let q = supabase
        .from("commandes")
        .select("date, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir, mission_slot, service")
        .eq("client_id", commande.client_id)
        .eq("secteur", commande.secteur)
        .eq("mission_slot", commande.mission_slot ?? 0)
        .gte("date", weekStart)
        .lte("date", weekEnd);
  
      if (commande.service) {
        q = q.eq("service", commande.service);
      } else {
        q = q.is("service", null);
      }
  
      const { data, error } = await q;
      if (error) {
        console.error("❌ Chargement des jours de la ligne :", error);
        // On retombe au moins sur la journée d’origine si la requête échoue
        const key = format(dateCmd, "yyyy-MM-dd");
        setJoursState({ ...fullWeek, [key]: true });
        setHeuresParJour({
          [key]: {
            debutMatin: (commande.heure_debut_matin || "").slice(0, 5),
            finMatin: (commande.heure_fin_matin || "").slice(0, 5),
            debutSoir: (commande.heure_debut_soir || "").slice(0, 5),
            finSoir: (commande.heure_fin_soir || "").slice(0, 5),
            nbPersonnes: 1,
          },
        });
        return;
      }
  
      const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : "");
      const heures: Record<string, any> = {};
  
      (data || []).forEach((cmd) => {
        const key = format(new Date(cmd.date), "yyyy-MM-dd");
        fullWeek[key] = true;
        heures[key] = {
          debutMatin: hhmm(cmd.heure_debut_matin),
          finMatin: hhmm(cmd.heure_fin_matin),
          debutSoir: hhmm(cmd.heure_debut_soir),
          finSoir: hhmm(cmd.heure_fin_soir),
          nbPersonnes: 1, // 1 ligne = 1 personne
        };
      });
  
      // Si aucune autre journée n’est trouvée, on garde au moins la journée d’origine
      if ((data || []).length === 0) {
        const key = format(dateCmd, "yyyy-MM-dd");
        fullWeek[key] = true;
        heures[key] = {
          debutMatin: hhmm(commande.heure_debut_matin),
          finMatin: hhmm(commande.heure_fin_matin),
          debutSoir: hhmm(commande.heure_debut_soir),
          finSoir: hhmm(commande.heure_fin_soir),
          nbPersonnes: 1,
        };
      }
  
      setJoursState(fullWeek);
      setHeuresParJour(heures);
    };
  
    run();
  }, [open, commande]);

    // Effacement auto du complément si le motif redevient "Extra Usage constant"
    useEffect(() => {
      if (motif === "Extra Usage constant" && complementMotif !== "") {
        setComplementMotif("");
      }
    }, [motif, complementMotif]);
    
  const handleSave = async () => {
    if (!clientId || !secteur || !semaine) return;
  
    // 1) Récup user app
    const { data: authData } = await supabase.auth.getUser();
    const userEmail = authData?.user?.email || null;
    if (!userEmail) return;
  
    const { data: userApp, error: userError } = await supabase
      .from("utilisateurs")
      .select("id")
      .eq("email", userEmail)
      .single();
  
    if (userError || !userApp?.id) {
      console.error("❌ Utilisateur non trouvé dans table `utilisateurs` :", userError);
      return;
    }
  
    const userId = userApp.id;
  
    // 2) BRANCHE ÉDITION : si `commande` est fournie, on MET À JOUR (pas d'insert)
    if (commande) {
      // Jours de la semaine à mettre à jour = ceux marqués true (donc les jours où la ligne a une commande)
      const datesToUpdate = Object.keys(joursState).filter((d) => !!joursState[d]);
      if (datesToUpdate.length === 0) {
        toast.error("Aucune journée à mettre à jour");
        return;
      }
  
      // On met à jour toutes les commandes de la même ligne (client/secteur/slot + service d'origine)
      let q = supabase
      .from("commandes")
      .update({
        service: service || null,
        motif_contrat: motif,
        complement_motif: motif === "Extra Usage constant" ? null : (complementMotif || null),
        commentaire: commentaire || null,
      })
      .eq("client_id", clientId)
      .eq("secteur", secteur)
      .eq("mission_slot", commande.mission_slot ?? 0)
      .in("date", datesToUpdate);
    
  
      // service d'origine (peut être null)
      if (commande.service) {
        q = q.eq("service", commande.service);
      } else {
        q = q.is("service", null);
      }
  
      const { data: updatedRows, error: updErr } = await q.select("id, date");
      if (updErr) {
        console.error("❌ Erreur mise à jour de la commande :", updErr);
        toast.error("Échec de la mise à jour");
        return;
      }
  
      // Historique
      if (updatedRows && updatedRows.length > 0) {
        const historique = updatedRows.map((row) => ({
          table_cible: "commandes",
          action: "modification",
          ligne_id: row.id,
          user_id: userId,
          date_action: new Date().toISOString(),
          description: "Modification service/motif via édition de commande",
          apres: {
            service: service || null,
            motif_contrat: motif,
            complement_motif: motif === "Extra Usage constant" ? null : (complementMotif || null),
            commentaire: commentaire || null,
            date: row.date,
          },       
        }));
  
        const { error: histError } = await supabase.from("historique").insert(historique);
        if (histError) {
          console.error("❌ Erreur insertion historique (modification) :", histError);
        }
      }
  
      // Refresh + fermeture
      if (onRefreshDone) {
        await onRefreshDone();
      }
      toast.success("Commande mise à jour");
      onOpenChange(false);
      return;
    }
  
    // 3) BRANCHE CRÉATION : inchangée (on garde ton code d'origine)
    const lignes: any[] = [];
  
    const joursCommandes = Object.entries(joursState).filter(([_, active]) => active);
    const datesCommandes = joursCommandes.map(([date]) => date);
  
    const { data: commandesExistantesAll } = await supabase
      .from("commandes")
      .select("mission_slot")
      .eq("client_id", clientId)
      .eq("secteur", secteur)
      .in("date", datesCommandes);
  
    const existingSlots = (commandesExistantesAll || []).map((c) => c.mission_slot ?? 0);
    let baseSlot = existingSlots.length > 0 ? Math.max(...existingSlots) + 1 : 1;
  
    for (const [key, isActive] of joursCommandes) {
      const heure = heuresParJour[key] || {};
      const nb = heure.nbPersonnes || 1;
  
      for (let i = 0; i < nb; i++) {
        lignes.push({
          client_id: clientId,
          secteur,
          service: service || null,
          date: key,
          statut: "En recherche",
          heure_debut_matin: heure.debutMatin || null,
          heure_fin_matin: heure.finMatin || null,
          heure_debut_soir: heure.debutSoir || null,
          heure_fin_soir: heure.finSoir || null,
          motif_contrat: motif,
          complement_motif: motif === "Extra Usage constant" ? null : (complementMotif || null),
          commentaire: commentaire || null,
          created_by: userId,
          mission_slot: baseSlot + i,
        });
        
      }
    }
  
    if (lignes.length === 0) return;
  
    const { data, error } = await supabase
      .from("commandes")
      .insert(lignes)
      .select("id, date, heure_debut_matin, heure_fin_matin, heure_debut_soir, heure_fin_soir");
  
    if (error) {
      console.error("❌ Erreur insertion commandes :", error);
      return;
    }
  
    if (data && data.length > 0) {
      const historique = data.map((cmd) => ({
        table_cible: "commandes",
        action: "creation",
        ligne_id: cmd.id,
        user_id: userId,
        date_action: new Date().toISOString(),
        description: "Création de commande via NouvelleCommandeDialog",
        apres: {
          date: cmd.date,
          heure_debut_matin: cmd.heure_debut_matin,
          heure_fin_matin: cmd.heure_fin_matin,
          heure_debut_soir: cmd.heure_debut_soir,
          heure_fin_soir: cmd.heure_fin_soir,
        },
      }));
  
      const { error: histError } = await supabase.from("historique").insert(historique);
      if (histError) {
        console.error("❌ Erreur insertion historique :", histError);
      }
    }
  
    if (onRefreshDone) {
      await onRefreshDone();
    }
    toast.success("Commandes créées");
    onOpenChange(false);
  };
 

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle commande</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6 mt-4">
        <CommandeFormGauche
  secteur={secteur}
  setSecteur={setSecteur}
  clientId={clientId}
  setClientId={setClientId}
  service={service}
  setService={setService}
  semaine={semaine}
  setSemaine={setSemaine}
  motif={motif}
  setMotif={setMotif}
  commentaire={commentaire}
  setCommentaire={setCommentaire}
  complementMotif={complementMotif}
  setComplementMotif={setComplementMotif}
  clients={clients}
  services={services}
  semainesDisponibles={semainesDisponibles}
  posteTypeId={posteTypeId}
  setPosteTypeId={setPosteTypeId}
  postesTypes={postesTypes}
  setHeuresParJour={setHeuresParJour}
  setJoursState={setJoursState}
/>

    <div className={commande ? "relative opacity-60" : ""}>
            {commande && (
              <div
                className="absolute inset-0 z-[5] pointer-events-auto"
                aria-hidden="true"
              />
            )}
          <CommandeFormDroite
            joursSemaine={joursSemaine}
            joursState={joursState}
            setJoursState={setJoursState}
            heuresParJour={heuresParJour}
            setHeuresParJour={setHeuresParJour}
            selectedPosteType={selectedPosteType}
            secteur={secteur}
            handleSave={handleSave}
          />
        </div>
        </div>
        {commande && (
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave}>Valider</Button>
          </div>
        )}

      </DialogContent>
    </Dialog>
  )
}

function getWeekNumber(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1)
  const diff =
    (+date -
      +start +
      (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000) /
    86400000
  return Math.floor((diff + start.getDay() + 6) / 7)
}