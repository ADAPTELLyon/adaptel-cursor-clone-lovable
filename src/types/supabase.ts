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
          commentaire: string | null
          created_at: string
          email: string | null
          id: string
          nom: string
          prenom: string
          prioritaire: boolean | null
          secteurs: string[] | null
          telephone: string | null
          updated_at: string
          vehicule: boolean | null
        }
        Insert: {
          actif?: boolean | null
          commentaire?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom: string
          prenom: string
          prioritaire?: boolean | null
          secteurs?: string[] | null
          telephone?: string | null
          updated_at?: string
          vehicule?: boolean | null
        }
        Update: {
          actif?: boolean | null
          commentaire?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nom?: string
          prenom?: string
          prioritaire?: boolean | null
          secteurs?: string[] | null
          telephone?: string | null
          updated_at?: string
          vehicule?: boolean | null
        }
        Relationships: []
      }
      candidats_logs: {
        Row: {
          candidat_id: string
          created_at: string
          created_by: string | null
          details: string | null
          id: string
          type_action: string | null
        }
        Insert: {
          candidat_id: string
          created_at?: string
          created_by?: string | null
          details?: string | null
          id?: string
          type_action?: string | null
        }
        Update: {
          candidat_id?: string
          created_at?: string
          created_by?: string | null
          details?: string | null
          id?: string
          type_action?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidats_logs_candidat_id_fkey1"
            columns: ["candidat_id"]
            isOneToOne: false
            referencedRelation: "candidats_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidats_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "utilisateurs"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          actif: boolean | null
          adresse: string | null
          created_at: string | null
          email: string | null
          groupe_client: string | null
          id: string
          nom: string
          secteur: string | null
          service: string | null
          telephone: string | null
          updated_at: string | null
          ville: string | null
        }
        Insert: {
          actif?: boolean | null
          adresse?: string | null
          created_at?: string | null
          email?: string | null
          groupe_client?: string | null
          id?: string
          nom: string
          secteur?: string | null
          service?: string | null
          telephone?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Update: {
          actif?: boolean | null
          adresse?: string | null
          created_at?: string | null
          email?: string | null
          groupe_client?: string | null
          id?: string
          nom?: string
          secteur?: string | null
          service?: string | null
          telephone?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Relationships: []
      }
      commande_jours: {
        Row: {
          candidat: string | null
          commande_id: string | null
          couleur_fond: string | null
          couleur_texte: string | null
          created_at: string
          creneaux: string[] | null
          id: string
          jour_date: string
          jour_semaine: number
          statut: string | null
          updated_at: string
        }
        Insert: {
          candidat?: string | null
          commande_id?: string | null
          couleur_fond?: string | null
          couleur_texte?: string | null
          created_at?: string
          creneaux?: string[] | null
          id?: string
          jour_date: string
          jour_semaine: number
          statut?: string | null
          updated_at?: string
        }
        Update: {
          candidat?: string | null
          commande_id?: string | null
          couleur_fond?: string | null
          couleur_texte?: string | null
          created_at?: string
          creneaux?: string[] | null
          id?: string
          jour_date?: string
          jour_semaine?: number
          statut?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commande_jours_commande_id_fkey"
            columns: ["commande_id"]
            isOneToOne: false
            referencedRelation: "commandes"
            referencedColumns: ["id"]
          },
        ]
      }
      commandes: {
        Row: {
          annee: number
          client_id: string | null
          client_nom: string
          created_at: string
          id: string
          secteur: string | null
          semaine: number
          statut: string
          updated_at: string
        }
        Insert: {
          annee: number
          client_id?: string | null
          client_nom: string
          created_at?: string
          id?: string
          secteur?: string | null
          semaine: number
          statut: string
          updated_at?: string
        }
        Update: {
          annee?: number
          client_id?: string | null
          client_nom?: string
          created_at?: string
          id?: string
          secteur?: string | null
          semaine?: number
          statut?: string
          updated_at?: string
        }
        Relationships: [
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
          client_id: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          fonction: string | null
          id: string
          nom: string | null
          portable: string | null
          prenom: string | null
          telephone: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          fonction?: string | null
          id?: string
          nom?: string | null
          portable?: string | null
          prenom?: string | null
          telephone?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          fonction?: string | null
          id?: string
          nom?: string | null
          portable?: string | null
          prenom?: string | null
          telephone?: string | null
          updated_at?: string | null
          updated_by?: string | null
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
      parametrages: {
        Row: {
          categorie: string | null
          created_at: string | null
          description: string | null
          id: string
          updated_at: string | null
          valeur: string | null
        }
        Insert: {
          categorie?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
          valeur?: string | null
        }
        Update: {
          categorie?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          updated_at?: string | null
          valeur?: string | null
        }
        Relationships: []
      }
      utilisateurs: {
        Row: {
          actif: boolean | null
          created_at: string | null
          email: string | null
          id: string
          nom: string | null
          prenom: string | null
          updated_at: string | null
        }
        Insert: {
          actif?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          nom?: string | null
          prenom?: string | null
          updated_at?: string | null
        }
        Update: {
          actif?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          nom?: string | null
          prenom?: string | null
          updated_at?: string | null
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
