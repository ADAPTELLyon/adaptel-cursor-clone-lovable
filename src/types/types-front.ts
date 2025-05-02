import { Database } from "@/integrations/supabase/types";

// Types principaux liés aux tables
export type Candidat = Database['public']['Tables']['candidats']['Row'];
export type Client = Database['public']['Tables']['clients']['Row'] & {
    postes_bases_actifs?: string[] | null;
};
export type Commande = Database['public']['Tables']['commandes']['Row'];
export type ContactClient = Database['public']['Tables']['contacts_clients']['Row'];
export type Disponibilite = Database['public']['Tables']['disponibilites']['Row'];
export type Historique = Database['public']['Tables']['historique']['Row'];
export type Incident = Database['public']['Tables']['incidents']['Row'];
export type InterdictionPriorite = Database['public']['Tables']['interdictions_priorites']['Row'];
export type Parametrage = Database['public']['Tables']['parametrages']['Row'];
export type Planification = Database['public']['Tables']['planification']['Row'];
export type PosteBase = Database['public']['Tables']['postes_bases']['Row'];

// ✅ OVERRIDE ici ➔ temps_pause_minutes forcé en string | null
export type PosteType = Omit<Database['public']['Tables']['postes_types_clients']['Row'], 'temps_pause_minutes'> & {
    temps_pause_minutes: string | null;
};

export type Utilisateur = Database['public']['Tables']['utilisateurs']['Row'];

// Types INSERT (pour création)
export type CandidatInsert = Database['public']['Tables']['candidats']['Insert'];
export type ClientInsert = Database['public']['Tables']['clients']['Insert'] & {
    postes_bases_actifs?: string[] | null;
};
export type CommandeInsert = Database['public']['Tables']['commandes']['Insert'];
export type ContactClientInsert = Database['public']['Tables']['contacts_clients']['Insert'];
export type DisponibiliteInsert = Database['public']['Tables']['disponibilites']['Insert'];
export type HistoriqueInsert = Database['public']['Tables']['historique']['Insert'];
export type IncidentInsert = Database['public']['Tables']['incidents']['Insert'];
export type InterdictionPrioriteInsert = Database['public']['Tables']['interdictions_priorites']['Insert'];
export type ParametrageInsert = Database['public']['Tables']['parametrages']['Insert'];
export type PlanificationInsert = Database['public']['Tables']['planification']['Insert'];
export type PosteBaseInsert = Database['public']['Tables']['postes_bases']['Insert'];

// ✅ OVERRIDE ici aussi pour INSERT
export type PosteTypeInsert = Omit<Database['public']['Tables']['postes_types_clients']['Insert'], 'temps_pause_minutes'> & {
    temps_pause_minutes: string | null;
};

export type UtilisateurInsert = Database['public']['Tables']['utilisateurs']['Insert'];
