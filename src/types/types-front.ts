// === TABLE: candidats ===
export type Candidat = {
  id: string;
  nom: string;
  prenom: string;
  actif: boolean;
  adresse: string;
  code_postal: string;
  ville: string;
  email: string;
  telephone?: string | null;
  date_naissance?: string | null;
  commentaire?: string | null;
  prioritaire: boolean;
  created_at: string;
  secteurs?: string[];
  vehicule?: boolean;
};

// === TABLE: disponibilites ===
export type CandidatDispo = {
  id: string;
  date: string;
  secteur: string;
  statut: "Dispo" | "Non Dispo" | "Non Renseigné";
  service?: string | null;
  matin: boolean;
  soir: boolean;
  nuit: boolean;
  candidat_id: string;
  commentaire?: string | null;
  created_at: string;
  updated_at?: string | null;
  creneaux?: string[];
};

export type CandidatDispoWithNom = CandidatDispo & {
  candidat?: Pick<Candidat, "nom" | "prenom">;
};

// === TYPE: JourPlanning pour planning candidats ===
export type JourPlanningCandidat = {
  date: string;
  secteur: string;
  service?: string | null;
  disponibilite?: CandidatDispoWithNom;
  commande?: CommandeFull;
};

// === TABLE: clients ===
export type Client = {
  id: string;
  nom: string;
  actif: boolean;
  adresse: string;
  code_postal: string;
  ville: string;
  email: string;
  telephone?: string | null;
  created_at: string;
  secteurs?: string[] | null;
  services?: string[] | null;
  postes_bases_actifs?: string[];
};

// === TABLE: commandes ===
export type StatutCommande =
  | "En recherche"
  | "Validé"
  | "Annule Int"
  | "Annule Client"
  | "Annule ADA"
  | "Absence"
  | "Non pourvue";

export type Commande = {
  id: string;
  date: string;
  secteur: string;
  service?: string | null;
  statut: StatutCommande;
  client_id: string;
  candidat_id?: string | null;
  heure_debut_matin?: string | null;
  heure_fin_matin?: string | null;
  heure_debut_soir?: string | null;
  heure_fin_soir?: string | null;
  commentaire?: string | null;
  created_at: string;
  mission_slot: number; // ✅ Obligatoire maintenant
};

// === Planning client
export type CommandeWithCandidat = Commande & {
  candidat?: Pick<Candidat, "nom" | "prenom"> | null;
  client?: Pick<Client, "nom"> | null; // ✅ ajouté pour PlanningClientTable
};

export type CommandeFull = Commande & {
  candidat?: Pick<Candidat, "nom" | "prenom"> | null;
  client?: Pick<Client, "nom"> | null;
};

export type JourPlanning = {
  date: string;
  secteur: string;
  service?: string | null;
  commandes: CommandeWithCandidat[];
  mission_slot?: number | null; // ✅ déjà présent
};

// === TABLE: planification ===
export type Planification = {
  id: string;
  commande_id: string;
  candidat_id: string;
  date: string;
  heure_arrivee?: string | null;
  heure_depart?: string | null;
  created_at: string;
};

// === TABLE: postes_bases ===
export type PosteBase = {
  id: string;
  secteur: string;
  nom: string;
  actif: boolean;
  created_at: string;
};

// === TABLE: postes_types_clients ===
export type PosteType = {
  id: string;
  client_id: string;
  poste_base_id: string;
  nom: string;
  heure_debut_matin?: string | null;
  heure_fin_matin?: string | null;
  heure_debut_soir?: string | null;
  heure_fin_soir?: string | null;
  temps_pause_minutes?: string;
  repas_fournis?: boolean;
  created_at: string;
  poste_base?: PosteBase | null;
};

export type PosteTypeInsert = {
  client_id: string;
  poste_base_id: string;
  nom: string;
  heure_debut_matin?: string | null;
  heure_fin_matin?: string | null;
  heure_debut_soir?: string | null;
  heure_fin_soir?: string | null;
  repas_fournis?: boolean;
  temps_pause_minutes?: string;
};

// === TABLE: parametrages ===
export type Parametrage = {
  id: string;
  valeur: string;
  description?: string;
  categorie: string;
  created_at?: string;
  updated_at?: string;
};

// === TABLE: historique ===
export type Historique = {
  id: string;
  table_cible: string;
  ligne_id: string;
  action: string;
  description: string;
  date_action: string;
  user_id: string;
  avant?: any;
  apres?: any;
  created_at: string;
  user?: {
    prenom: string;
  };
};

// === TABLE: incidents ===
export type Incident = {
  id: string;
  client_id: string;
  candidat_id: string;
  type_incident: string;
  description?: string;
  date_incident: string;
  heure_incident: string;
  mise_en_interdiction: boolean;
  created_at: string;
};

// === TABLE: interdictions_priorites ===
export type InterdictionPriorite = {
  id: string;
  client_id: string;
  candidat_id: string;
  secteur: string;
  service?: string | null;
  type: "priorite" | "interdiction";
  commentaire?: string | null;
  created_at: string;
  updated_at?: string | null;
  created_by: string;
  actif: boolean;
  candidat?: {
    id: string;
    nom: string;
    prenom: string;
  };
  user?: {
    prenom: string;
  };
};

export type InterdictionPrioriteWithClient = InterdictionPriorite & {
  client?: {
    nom: string;
  };
};

// === Planning historique
export type Planif = {
  id: string;
  date: string;
  statut: StatutCommande;
  candidat: {
    nom: string;
    prenom: string;
  };
};
