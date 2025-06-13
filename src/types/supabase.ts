export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      candidats: {
        Row: {
          actif: boolean | null
          adresse: string | null
          code_postal: string | null
          commentaire: string | null
          created_at: string | null
          date_naissance: string | null
          email: string | null
          id: string
          nom: string
          prenom: string
          prioritaire: boolean | null
          secteurs: string[] | null
          telephone: string | null
          updated_at: string | null
          vehicule: boolean | null
          ville: string | null
        }
        Insert: {
          actif?: boolean | null
          adresse?: string | null
          code_postal?: string | null
          commentaire?: string | null
          created_at?: string | null
          date_naissance?: string | null
          email?: string | null
          id?: string
          nom: string
          prenom: string
          prioritaire?: boolean | null
          secteurs?: string[] | null
          telephone?: string | null
          updated_at?: string | null
          vehicule?: boolean | null
          ville?: string | null
        }
        Update: {
          actif?: boolean | null
          adresse?: string | null
          code_postal?: string | null
          commentaire?: string | null
          created_at?: string | null
          date_naissance?: string | null
          email?: string | null
          id?: string
          nom?: string
          prenom?: string
          prioritaire?: boolean | null
          secteurs?: string[] | null
          telephone?: string | null
          updated_at?: string | null
          vehicule?: boolean | null
          ville?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          actif: boolean | null
          adresse: string | null
          code_postal: string | null
          created_at: string | null
          created_by: string | null
          groupe: string | null
          id: string
          nom: string
          postes_bases_actifs: string[] | null
          secteurs: string[] | null
          services: string[] | null
          telephone: string | null
          updated_at: string | null
          ville: string | null
        }
        Insert: {
          actif?: boolean | null
          adresse?: string | null
          code_postal?: string | null
          created_at?: string | null
          created_by?: string | null
          groupe?: string | null
          id?: string
          nom: string
          postes_bases_actifs?: string[] | null
          secteurs?: string[] | null
          services?: string[] | null
          telephone?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Update: {
          actif?: boolean | null
          adresse?: string | null
          code_postal?: string | null
          created_at?: string | null
          created_by?: string | null
          groupe?: string | null
          id?: string
          nom?: string
          postes_bases_actifs?: string[] | null
          secteurs?: string[] | null
          services?: string[] | null
          telephone?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Relationships: []
      }
      commandes: {
        Row: {
          candidat_id: string | null
          client_id: string | null
          commentaire: string | null
          complement_motif: string | null
          created_at: string | null
          created_by: string | null
          date: string
          heure_debut_matin: string | null
          heure_debut_nuit: string | null
          heure_debut_soir: string | null
          heure_fin_matin: string | null
          heure_fin_nuit: string | null
          heure_fin_soir: string | null
          id: string
          mission_slot: number
          motif_contrat: string | null
          secteur: string
          service: string | null
          statut: string
          updated_at: string | null
        }
        Insert: {
          candidat_id?: string | null
          client_id?: string | null
          commentaire?: string | null
          complement_motif?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          heure_debut_matin?: string | null
          heure_debut_nuit?: string | null
          heure_debut_soir?: string | null
          heure_fin_matin?: string | null
          heure_fin_nuit?: string | null
          heure_fin_soir?: string | null
          id?: string
          mission_slot?: number
          motif_contrat?: string | null
          secteur: string
          service?: string | null
          statut: string
          updated_at?: string | null
        }
        Update: {
          candidat_id?: string | null
          client_id?: string | null
          commentaire?: string | null
          complement_motif?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          heure_debut_matin?: string | null
          heure_debut_nuit?: string | null
          heure_debut_soir?: string | null
          heure_fin_matin?: string | null
          heure_fin_nuit?: string | null
          heure_fin_soir?: string | null
          id?: string
          mission_slot?: number
          motif_contrat?: string | null
          secteur?: string
          service?: string | null
          statut?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commandes_candidat_id_fkey"
            columns: ["candidat_id"]
            isOneToOne: false
            referencedRelation: "candidats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts_clients: {
        Row: {
          actif: boolean
          client_id: string
          created_at: string
          created_by: string | null
          email: string | null
          fonction: string | null
          id: string
          nom: string
          prénom: string | null
          secteur: string | null
          services: string[] | null
          telephone: string | null
        }
        Insert: {
          actif?: boolean
          client_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          fonction?: string | null
          id?: string
          nom: string
          prénom?: string | null
          secteur?: string | null
          services?: string[] | null
          telephone?: string | null
        }
        Update: {
          actif?: boolean
          client_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          fonction?: string | null
          id?: string
          nom?: string
          prénom?: string | null
          secteur?: string | null
          services?: string[] | null
          telephone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      disponibilites: {
        Row: {
          candidat_id: string
          commentaire: string | null
          created_at: string | null
          date: string
          dispo_matin: boolean | null
          dispo_nuit: boolean | null
          dispo_soir: boolean | null
          id: string
          secteur: string
          service: string | null
          statut: string | null
          updated_at: string | null
        }
        Insert: {
          candidat_id: string
          commentaire?: string | null
          created_at?: string | null
          date: string
          dispo_matin?: boolean | null
          dispo_nuit?: boolean | null
          dispo_soir?: boolean | null
          id?: string
          secteur: string
          service?: string | null
          statut?: string | null
          updated_at?: string | null
        }
        Update: {
          candidat_id?: string
          commentaire?: string | null
          created_at?: string | null
          date?: string
          dispo_matin?: boolean | null
          dispo_nuit?: boolean | null
          dispo_soir?: boolean | null
          id?: string
          secteur?: string
          service?: string | null
          statut?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_disponibilites_candidat"
            columns: ["candidat_id"]
            isOneToOne: false
            referencedRelation: "candidats"
            referencedColumns: ["id"]
          },
        ]
      }
      donnees: {
        Row: {
          annee: string
          candidat_id: string | null
          client_id: string | null
          created_at: string | null
          date: string
          id: string
          mois: string
          nombre: number
          poste: string | null
          secteur: string
          semaine: string
          service: string | null
          statut: string
          updated_at: string | null
        }
        Insert: {
          annee: string
          candidat_id?: string | null
          client_id?: string | null
          created_at?: string | null
          date: string
          id?: string
          mois: string
          nombre?: number
          poste?: string | null
          secteur: string
          semaine: string
          service?: string | null
          statut: string
          updated_at?: string | null
        }
        Update: {
          annee?: string
          candidat_id?: string | null
          client_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          mois?: string
          nombre?: number
          poste?: string | null
          secteur?: string
          semaine?: string
          service?: string | null
          statut?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donnees_candidat_id_fkey"
            columns: ["candidat_id"]
            isOneToOne: false
            referencedRelation: "candidats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donnees_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      historique: {
        Row: {
          action: string
          apres: Json | null
          avant: Json | null
          created_at: string | null
          date_action: string
          description: string
          id: string
          ligne_id: string
          table_cible: string
          user_id: string
        }
        Insert: {
          action: string
          apres?: Json | null
          avant?: Json | null
          created_at?: string | null
          date_action?: string
          description: string
          id?: string
          ligne_id: string
          table_cible: string
          user_id: string
        }
        Update: {
          action?: string
          apres?: Json | null
          avant?: Json | null
          created_at?: string | null
          date_action?: string
          description?: string
          id?: string
          ligne_id?: string
          table_cible?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historique_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          candidat_id: string
          client_id: string
          created_at: string | null
          created_by: string | null
          date_incident: string
          description: string | null
          heure_incident: string | null
          id: string
          mise_en_interdiction: boolean | null
          type_incident: string
        }
        Insert: {
          candidat_id: string
          client_id: string
          created_at?: string | null
          created_by?: string | null
          date_incident: string
          description?: string | null
          heure_incident?: string | null
          id?: string
          mise_en_interdiction?: boolean | null
          type_incident: string
        }
        Update: {
          candidat_id?: string
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          date_incident?: string
          description?: string | null
          heure_incident?: string | null
          id?: string
          mise_en_interdiction?: boolean | null
          type_incident?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_candidat_incident"
            columns: ["candidat_id"]
            isOneToOne: false
            referencedRelation: "candidats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_client_incident"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      interdictions_priorites: {
        Row: {
          actif: boolean
          candidat_id: string
          client_id: string
          commentaire: string | null
          created_at: string | null
          created_by: string | null
          id: string
          secteur: string
          service: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          actif?: boolean
          candidat_id: string
          client_id: string
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          secteur: string
          service?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          actif?: boolean
          candidat_id?: string
          client_id?: string
          commentaire?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          secteur?: string
          service?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_candidat"
            columns: ["candidat_id"]
            isOneToOne: false
            referencedRelation: "candidats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interdictions_priorites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      parametrages: {
        Row: {
          categorie: string
          created_at: string
          description: string | null
          id: string
          updated_at: string
          valeur: string
        }
        Insert: {
          categorie: string
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          valeur: string
        }
        Update: {
          categorie?: string
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          valeur?: string
        }
        Relationships: []
      }
      planification: {
        Row: {
          candidat_id: string
          commande_id: string
          created_at: string | null
          date: string
          heure_debut_matin: string | null
          heure_debut_nuit: string | null
          heure_debut_soir: string | null
          heure_fin_matin: string | null
          heure_fin_nuit: string | null
          heure_fin_soir: string | null
          id: string
          secteur: string
          statut: string
          updated_at: string | null
        }
        Insert: {
          candidat_id: string
          commande_id: string
          created_at?: string | null
          date: string
          heure_debut_matin?: string | null
          heure_debut_nuit?: string | null
          heure_debut_soir?: string | null
          heure_fin_matin?: string | null
          heure_fin_nuit?: string | null
          heure_fin_soir?: string | null
          id?: string
          secteur: string
          statut: string
          updated_at?: string | null
        }
        Update: {
          candidat_id?: string
          commande_id?: string
          created_at?: string | null
          date?: string
          heure_debut_matin?: string | null
          heure_debut_nuit?: string | null
          heure_debut_soir?: string | null
          heure_fin_matin?: string | null
          heure_fin_nuit?: string | null
          heure_fin_soir?: string | null
          id?: string
          secteur?: string
          statut?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_candidat"
            columns: ["candidat_id"]
            isOneToOne: false
            referencedRelation: "candidats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_commande"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      postes_bases: {
        Row: {
          created_at: string | null
          id: string
          nom: string
          secteur: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nom: string
          secteur: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nom?: string
          secteur?: string
        }
        Relationships: []
      }
      postes_bases_clients: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          poste_base_id: string
          tenue_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          poste_base_id: string
          tenue_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          poste_base_id?: string
          tenue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "postes_bases_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postes_bases_clients_poste_base_id_fkey"
            columns: ["poste_base_id"]
            isOneToOne: false
            referencedRelation: "postes_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "postes_bases_clients_tenue_id_fkey"
            columns: ["tenue_id"]
            isOneToOne: false
            referencedRelation: "parametrages"
            referencedColumns: ["id"]
          },
        ]
      }
      postes_types_clients: {
        Row: {
          client_id: string
          created_at: string | null
          heure_debut_matin: string | null
          heure_debut_nuit: string | null
          heure_debut_soir: string | null
          heure_fin_matin: string | null
          heure_fin_nuit: string | null
          heure_fin_soir: string | null
          id: string
          nom: string
          poste_base_id: string
          repas_fournis: boolean | null
          temps_pause_minutes: string | null
          tenue_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          heure_debut_matin?: string | null
          heure_debut_nuit?: string | null
          heure_debut_soir?: string | null
          heure_fin_matin?: string | null
          heure_fin_nuit?: string | null
          heure_fin_soir?: string | null
          id?: string
          nom: string
          poste_base_id: string
          repas_fournis?: boolean | null
          temps_pause_minutes?: string | null
          tenue_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          heure_debut_matin?: string | null
          heure_debut_nuit?: string | null
          heure_debut_soir?: string | null
          heure_fin_matin?: string | null
          heure_fin_nuit?: string | null
          heure_fin_soir?: string | null
          id?: string
          nom?: string
          poste_base_id?: string
          repas_fournis?: boolean | null
          temps_pause_minutes?: string | null
          tenue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_poste_base"
            columns: ["poste_base_id"]
            isOneToOne: false
            referencedRelation: "postes_bases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tenue"
            columns: ["tenue_id"]
            isOneToOne: false
            referencedRelation: "parametrages"
            referencedColumns: ["id"]
          },
        ]
      }
      utilisateurs: {
        Row: {
          actif: boolean
          created_at: string
          email: string
          id: string
          nom: string
          prenom: string
          updated_at: string
        }
        Insert: {
          actif?: boolean
          created_at?: string
          email: string
          id?: string
          nom: string
          prenom: string
          updated_at?: string
        }
        Update: {
          actif?: boolean
          created_at?: string
          email?: string
          id?: string
          nom?: string
          prenom?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
