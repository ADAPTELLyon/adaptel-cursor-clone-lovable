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
  postes_bases_actifs?: string[]; // ✅ requis pour postes
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
  nom: string; // ✅ requis par Supabase
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

// === Planning client
export type CommandeWithCandidat = Commande & {
  candidat?: Pick<Candidat, "nom" | "prenom"> | null;
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
};

// === TABLE: interdictions_priorites ===
export type InterdictionPriorite = {
  id: string;
  candidat_id: string;
  client_id: string;
  secteur: string;
  service?: string | null;
  type: "interdiction" | "priorite";
  commentaire?: string | null;
  created_at?: string;
  created_by?: string | null;
  candidat?: Pick<Candidat, "id" | "nom" | "prenom">;
};
