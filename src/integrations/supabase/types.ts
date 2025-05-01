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
        Insert: { /* inchangé */ }
        Update: { /* inchangé */ }
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
        Insert: { /* inchangé */ }
        Update: { /* inchangé */ }
        Relationships: []
      }
      parametrages: {
        Row: { /* inchangé */ }
        Insert: { /* inchangé */ }
        Update: { /* inchangé */ }
        Relationships: []
      }
      utilisateurs: {
        Row: { /* inchangé */ }
        Insert: { /* inchangé */ }
        Update: { /* inchangé */ }
        Relationships: []
      }
      // ✅ AJOUT ici : définition de la table commandes
      commandes: {
        Row: {
          id: string
          client_id: string | null
          secteur: string
          service: string | null
          date: string
          statut: string
          candidat_id: string | null
          created_at: string | null
          created_by: string | null
          updated_at: string | null
          heure_debut_matin: string | null
          heure_fin_matin: string | null
          heure_debut_soir: string | null
          heure_fin_soir: string | null
          heure_debut_nuit: string | null
          heure_fin_nuit: string | null
        }
        Insert: {
          id?: string
          client_id?: string | null
          secteur: string
          service?: string | null
          date: string
          statut: string
          candidat_id?: string | null
          created_at?: string | null
          created_by?: string | null
          updated_at?: string | null
          heure_debut_matin?: string | null
          heure_fin_matin?: string | null
          heure_debut_soir?: string | null
          heure_fin_soir?: string | null
          heure_debut_nuit?: string | null
          heure_fin_nuit?: string | null
        }
        Update: {
          id?: string
          client_id?: string | null
          secteur?: string
          service?: string | null
          date?: string
          statut?: string
          candidat_id?: string | null
          created_at?: string | null
          created_by?: string | null
          updated_at?: string | null
          heure_debut_matin?: string | null
          heure_fin_matin?: string | null
          heure_debut_soir?: string | null
          heure_fin_soir?: string | null
          heure_debut_nuit?: string | null
          heure_fin_nuit?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
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

// ✅ Ton type Commande pour le FRONT (inchangé)
export type Commande = {
  id: string
  date: string
  client_id: string
  statut: string
  secteur: string
  service: string
  heure_debut_matin?: string | null
  heure_fin_matin?: string | null
  heure_debut_soir?: string | null
  heure_fin_soir?: string | null
  heure_debut_nuit?: string | null
  heure_fin_nuit?: string | null
  clients?: { nom: string } | undefined
  candidats?: { nom: string; prenom: string } | undefined
}
