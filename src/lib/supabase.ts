// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

const SUPABASE_URL = "https://jnfmuvtpdmwjemgoford.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuZm11dnRwZG13amVtZ29mb3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5Njg4NDMsImV4cCI6MjA2MDU0NDg0M30.dgnRH3Ydj0khfGppt-qx5e4Kl34-3-DR8YqsiTbdF0g"

// Dédoublonnage en dev/HMR : on réutilise la même instance globale
declare global {
  // eslint-disable-next-line no-var
  var __ADAPTEL_SUPABASE__: SupabaseClient<Database> | undefined
}

const storageKey = "adaptel-auth" // clé unique pour éviter les collisions entre instances

export const supabase: SupabaseClient<Database> =
  globalThis.__ADAPTEL_SUPABASE__ ??
  createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      // laisse à true si tu utilises des redirections OAuth/magic-link
      detectSessionInUrl: true,
      storageKey,
    },
  })

if (!globalThis.__ADAPTEL_SUPABASE__) {
  globalThis.__ADAPTEL_SUPABASE__ = supabase
}
