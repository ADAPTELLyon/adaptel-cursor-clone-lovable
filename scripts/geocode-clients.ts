import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), "scripts", ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Il manque SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans scripts/.env.local");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Géocode IGN (gratuit) : data.geopf.fr
async function geocodeOne(q: string) {
  const url = `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(q)}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} sur geocodage`);
  const json: any = await res.json();

  const feat = json?.features?.[0];
  if (!feat?.geometry?.coordinates) return null;

  const [lon, lat] = feat.geometry.coordinates;
  const score = feat?.properties?.score ?? null;
  const label = feat?.properties?.label ?? null;

  return { lat, lon, score, label };
}

async function main() {
  console.log("=== Geocodage clients (lat/lon) ===");

  // On ne traite que les clients qui ont adresse/cp/ville et lat/lon NULL
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, nom, adresse, code_postal, ville")
    .is("lat", null)
    .is("lon", null)
    .not("adresse", "is", null)
    .not("code_postal", "is", null)
    .not("ville", "is", null);

  if (error) throw new Error(error.message);

  console.log(`Clients à géocoder: ${clients?.length ?? 0}`);

  if (!clients || clients.length === 0) {
    console.log("Rien à faire.");
    return;
  }

  let ok = 0;
  let fail = 0;

  for (const c of clients) {
    const q = `${c.adresse} ${c.code_postal} ${c.ville}`.trim();
    try {
      const geo = await geocodeOne(q);
      if (!geo || !geo.lat || !geo.lon) {
        fail++;
        console.log(`❌ ${c.nom} (${c.id}) : pas de résultat`);
      } else {
        const { error: upErr } = await supabase
          .from("clients")
          .update({
            lat: geo.lat,
            lon: geo.lon,
            // on peut stocker le dernier calcul plus tard, là on touche juste lat/lon
          })
          .eq("id", c.id);

        if (upErr) throw new Error(upErr.message);

        ok++;
        console.log(`✅ ${c.nom} : ${geo.label} (score ${geo.score})`);
      }
    } catch (e: any) {
      fail++;
      console.log(`❌ ${c.nom} (${c.id}) : ${e.message}`);
    }

    // Mini pause pour rester “gentil” avec l’API (évite spam)
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`Terminé. OK=${ok} / FAIL=${fail}`);
}

main().catch((e) => {
  console.error("Erreur:", e);
  process.exit(1);
});
