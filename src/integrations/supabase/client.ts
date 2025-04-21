import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const SUPABASE_URL = "https://jnfmuvtpdmwjemgoford.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuZm11dnRwZG13amVtZ29mb3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5Njg4NDMsImV4cCI6MjA2MDU0NDg0M30.dgnRH3Ydj0khfGppt-qx5e4Kl34-3-DR8YqsiTbdF0g";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
