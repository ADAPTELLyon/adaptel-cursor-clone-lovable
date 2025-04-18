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
          secteurs: string[] | null
          service: string | null
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
          secteurs?: string[] | null
          service?: string | null
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
          secteurs?: string[] | null
          service?: string | null
          telephone?: string | null
          updated_at?: string | null
          ville?: string | null
        }
        Relationships: []
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
