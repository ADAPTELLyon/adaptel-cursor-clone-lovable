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
    secteurs?: string[] | null;      // ✅ ajouté car utilisé dans les hooks
    services?: string[] | null;      // ✅ ajouté car utilisé dans NouvelleCommandeDialog
};

// === TABLE: commandes ===
export type Commande = {
    id: string;
    date: string;
    secteur: string;
    service?: string | null;
    statut: string;
    client_id: string;
    candidat_id?: string | null;
    heure_debut_matin?: string | null;
    heure_fin_matin?: string | null;
    heure_debut_soir?: string | null;
    heure_fin_soir?: string | null;
    created_at: string;
};

// === TABLE: contacts_clients ===
export type ContactClient = {
    id: string;
    client_id: string;
    nom: string;
    prenom: string;
    telephone: string;
    email: string;
    poste?: string | null;
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
    temps_pause?: string | null; // ✅ devient un champ 'time' (HH:MM:SS) nullable
    created_at: string;
    poste_base?: PosteBase | null;       // ✅ pour faciliter les jointures dans le front
};

// === TYPE: Commande + Candidat (pour les jointures) ===
export type CommandeWithCandidat = Commande & {
    candidat?: Pick<Candidat, 'nom' | 'prenom'> | null;
};

// === TYPE: Commande + Candidat + Client (pour tes gros fetchs) ===
export type CommandeFull = Commande & {
    candidat?: Pick<Candidat, 'nom' | 'prenom'> | null;
    client?: Pick<Client, 'nom'> | null;
};

// === TYPE: JourPlanning (structure de tes plannings) ===
export type JourPlanning = {
    date: string;
    secteur: string;
    service?: string | null;
    commandes: CommandeWithCandidat[]; 
};
