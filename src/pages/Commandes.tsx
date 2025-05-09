import { useEffect, useState } from "react";
import MainLayout from "@/components/main-layout";
import { SectionFixeCommandes } from "@/components/commandes/section-fixe-commandes";
import { PlanningClientTable } from "@/components/commandes/PlanningClientTable";
import NouvelleCommandeDialog from "@/components/commandes/NouvelleCommandeDialog";
import { supabase } from "@/lib/supabase";
import { addDays, format, startOfWeek, getWeek } from "date-fns";
import { JourPlanning, CommandeWithCandidat } from "@/types/types-front";

export default function Commandes() {
  const [planning, setPlanning] = useState<Record<string, JourPlanning[]>>({});
  const [filteredPlanning, setFilteredPlanning] = useState<Record<string, JourPlanning[]>>({});
  const [selectedSecteurs, setSelectedSecteurs] = useState(["Étages"]);
  const [semaineEnCours, setSemaineEnCours] = useState(true);
  const [semaine, setSemaine] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedSemaine, setSelectedSemaine] = useState("Toutes");
  const [semaineDates, setSemaineDates] = useState<Date[]>([]);
  const [client, setClient] = useState("");
  const [search, setSearch] = useState("");
  const [toutAfficher, setToutAfficher] = useState(false);
  const [enRecherche, setEnRecherche] = useState(false);
  const [stats, setStats] = useState({ demandées: 0, validées: 0, enRecherche: 0, nonPourvue: 0 });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    const baseDate = new Date(semaine || new Date());
    const dates = Array.from({ length: 7 }, (_, i) =>
      addDays(startOfWeek(baseDate, { weekStartsOn: 1 }), i)
    );
    setSemaineDates(dates);
  }, [semaine]);

  useEffect(() => {
    const fetchPlanning = async () => {
      const lundi = startOfWeek(new Date(), { weekStartsOn: 1 });
      const semaineCourante = getWeek(lundi, { weekStartsOn: 1 }).toString();

      const { data, error } = await supabase
        .from("commandes")
        .select(`
          id, date, statut, secteur, service, client_id,
          heure_debut_matin, heure_fin_matin,
          heure_debut_soir, heure_fin_soir,
          commentaire,
          created_at,
          candidats (id, nom, prenom),
          clients (nom)
        `)
        .gte("date", lundi.toISOString().slice(0, 10));

      if (error || !data) {
        console.error("Erreur Supabase :", error);
        return;
      }

      const map: Record<string, JourPlanning[]> = {};
      for (const item of data as any[]) {
        const nomClient = item.clients?.nom || item.client_id || "Client inconnu";
        if (!map[nomClient]) map[nomClient] = [];

        const jour: JourPlanning = {
          date: item.date,
          secteur: item.secteur,
          service: item.service,
          commandes: [
            {
              id: item.id,
              date: item.date,
              statut: item.statut,
              secteur: item.secteur,
              service: item.service,
              client_id: item.client_id,
              candidat_id: item.candidats ? item.candidats.id : null,
              heure_debut_matin: item.heure_debut_matin,
              heure_fin_matin: item.heure_fin_matin,
              heure_debut_soir: item.heure_debut_soir,
              heure_fin_soir: item.heure_fin_soir,
              commentaire: item.commentaire,
              created_at: item.created_at,
              candidat: item.candidats
                ? { nom: item.candidats.nom, prenom: item.candidats.prenom }
                : null,
            } as CommandeWithCandidat,
          ],
        };

        map[nomClient].push(jour);
      }

      setPlanning(map);
      setSelectedSemaine(semaineCourante);
    };

    fetchPlanning();
  }, [refreshTrigger]);

  useEffect(() => {
    const semaineActuelle = getWeek(new Date(), { weekStartsOn: 1 });

    const matchSearchTerm = (val: string) => {
      return search
        .trim()
        .toLowerCase()
        .split(" ")
        .every((term) => val.toLowerCase().includes(term));
    };

    const newFiltered: typeof planning = {};

    if (search.trim()) {
      Object.entries(planning).forEach(([clientNom, jours]) => {
        const joursMatch = jours.filter((j) => {
          const dateStr = format(new Date(j.date), "dd/MM/yyyy");
          const semaineStr = getWeek(new Date(j.date), { weekStartsOn: 1 }).toString();

          return (
            matchSearchTerm(clientNom) ||
            matchSearchTerm(j.secteur) ||
            (j.service && matchSearchTerm(j.service)) ||
            matchSearchTerm(semaineStr) ||
            matchSearchTerm(dateStr) ||
            j.commandes.some((cmd) =>
              [cmd.candidat?.nom, cmd.candidat?.prenom, cmd.statut]
                .filter(Boolean)
                .some((val) => (val ? matchSearchTerm(val) : false))
            )
          );
        });
        if (joursMatch.length > 0) {
          newFiltered[clientNom] = joursMatch;
        }
      });
      setFilteredPlanning(newFiltered);
      return;
    }

    if (toutAfficher) {
      const allVisible = Object.entries(planning).reduce((acc, [clientNom, jours]) => {
        const semaineActuelleInt = getWeek(new Date(), { weekStartsOn: 1 });
        const joursFuturs = jours.filter(
          (j) => getWeek(new Date(j.date), { weekStartsOn: 1 }) >= semaineActuelleInt
        );

        const matchClient = client ? clientNom === client : true;

        const joursFiltres = joursFuturs.filter((j) =>
          !enRecherche || j.commandes.some((cmd) => cmd.statut === "En recherche")
        );

        if (joursFiltres.length > 0 && matchClient) {
          acc[clientNom] = joursFiltres;
        }

        return acc;
      }, {} as Record<string, JourPlanning[]>);

      setFilteredPlanning(allVisible);
    } else {
      Object.entries(planning).forEach(([clientNom, jours]) => {
        const joursFiltres = jours.filter((j) => {
          const semaineDuJour = getWeek(new Date(j.date), { weekStartsOn: 1 });
          const matchSecteur = selectedSecteurs.includes(j.secteur);
          const matchClient = client ? clientNom === client : true;
          const matchRecherche = enRecherche
            ? j.commandes.some((cmd) => cmd.statut === "En recherche")
            : true;
          const matchSemaine =
            selectedSemaine === "Toutes" || selectedSemaine === semaineDuJour.toString();
          return matchSecteur && matchClient && matchRecherche && matchSemaine;
        });
        if (joursFiltres.length > 0) {
          newFiltered[clientNom] = joursFiltres;
        }
      });

      setFilteredPlanning(newFiltered);
    }

    let d = 0,
      v = 0,
      r = 0,
      np = 0;

    Object.values(toutAfficher ? planning : newFiltered).forEach((jours) =>
      jours.forEach((j) =>
        j.commandes.forEach((cmd) => {
          if (cmd.statut !== "Annule Client" && cmd.statut !== "Annule ADA") {
            d++;
            if (cmd.statut === "Validé") v++;
            if (cmd.statut === "En recherche") r++;
            if (cmd.statut === "Non pourvue") np++;
          }
        })
      )
    );

    setStats({
      demandées: d,
      validées: v,
      enRecherche: r,
      nonPourvue: np,
    });
  }, [planning, selectedSecteurs, selectedSemaine, client, search, enRecherche, toutAfficher]);

  const resetFiltres = () => {
    setSelectedSecteurs(["Étages"]);
    setClient("");
    setSearch("");
    setEnRecherche(false);
    setToutAfficher(false);
    setSemaineEnCours(true);
    setSemaine(format(new Date(), "yyyy-MM-dd"));
    const current = getWeek(new Date(), { weekStartsOn: 1 }).toString();
    setSelectedSemaine(current);
  };

  const taux = stats.demandées > 0 ? Math.round((stats.validées / stats.demandées) * 100) : 0;

  const semainesDisponibles = Array.from(
    new Set(
      Object.values(planning)
        .flat()
        .map((j) => getWeek(new Date(j.date), { weekStartsOn: 1 }).toString())
    )
  ).sort((a, b) => parseInt(a) - parseInt(b));

  const clientsDisponibles = Object.keys(planning);

  // ✅ AJOUT ICI — fermeture du dialog après refresh effectif
  const onRefreshDone = () => {
    setRefreshTrigger((x) => x + 1);
    setOpenDialog(false);
  };

  return (
    <MainLayout>
      <SectionFixeCommandes
        selectedSecteurs={selectedSecteurs}
        setSelectedSecteurs={setSelectedSecteurs}
        stats={stats}
        taux={taux}
        semaine={semaine}
        setSemaine={setSemaine}
        selectedSemaine={selectedSemaine}
        setSelectedSemaine={setSelectedSemaine}
        client={client}
        setClient={setClient}
        search={search}
        setSearch={setSearch}
        toutAfficher={toutAfficher}
        setToutAfficher={setToutAfficher}
        enRecherche={enRecherche}
        setEnRecherche={setEnRecherche}
        semaineEnCours={semaineEnCours}
        setSemaineEnCours={setSemaineEnCours}
        resetFiltres={resetFiltres}
        semainesDisponibles={semainesDisponibles}
        clientsDisponibles={clientsDisponibles}
      />

      <PlanningClientTable
        planning={filteredPlanning}
        selectedSecteurs={selectedSecteurs}
        selectedSemaine={selectedSemaine}
        onRefresh={onRefreshDone}
      />

      <NouvelleCommandeDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
      />
    </MainLayout>
  );
}
