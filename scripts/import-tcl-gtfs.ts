import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "scripts", ".env.local") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "❌ Il manque SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans scripts/.env.local"
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const GTFS_PATH = path.resolve(process.cwd(), "data", "gtfs_tcl");

function readCsv(file: string) {
  const filePath = path.join(GTFS_PATH, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`❌ Fichier introuvable: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as Array<Record<string, string>>;
}

type StopInsert = {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  location_type: number | null;
  parent_station: string | null;
  wheelchair_boarding: number | null;
};

type StopRouteInsert = {
  stop_id: string;
  route_id: string;
  route_short_name: string | null;
  route_long_name: string | null;
  route_type: number | null;
};

async function main() {
  console.log("=== Import GTFS TCL → Supabase ===");
  console.log("📂 Dossier GTFS :", GTFS_PATH);

  // 1) stops.txt -> tcl_stops
  console.log("1/4 Import stops.txt ...");
  const stops = readCsv("stops.txt");

  const stopRows: StopInsert[] = stops
    .filter((s) => s.stop_id && s.stop_name && s.stop_lat && s.stop_lon)
    .map((s) => ({
      stop_id: s.stop_id,
      stop_name: s.stop_name,
      stop_lat: Number(s.stop_lat),
      stop_lon: Number(s.stop_lon),
      location_type: s.location_type ? Number(s.location_type) : null,
      parent_station: s.parent_station || null,
      wheelchair_boarding: s.wheelchair_boarding
        ? Number(s.wheelchair_boarding)
        : null,
    }));

  const { error: stopsErr } = await supabase
    .from("tcl_stops")
    .upsert(stopRows, { onConflict: "stop_id" });

  if (stopsErr) throw new Error(`❌ Import stops: ${stopsErr.message}`);
  console.log(`✅ Arrêts importés: ${stopRows.length}`);

  // 2) routes.txt
  console.log("2/4 Lecture routes.txt ...");
  const routes = readCsv("routes.txt");
  const routeMap = new Map<
    string,
    { short: string | null; long: string | null; type: number | null }
  >();

  for (const r of routes) {
    const route_id = r.route_id;
    if (!route_id) continue;
    routeMap.set(route_id, {
      short: r.route_short_name || null,
      long: r.route_long_name || null,
      type: r.route_type ? Number(r.route_type) : null,
    });
  }

  // 3) trips.txt (trip_id -> route_id)
  console.log("3/4 Lecture trips.txt ...");
  const trips = readCsv("trips.txt");
  const tripRouteMap = new Map<string, string>();

  for (const t of trips) {
    const trip_id = t.trip_id;
    const route_id = t.route_id;
    if (trip_id && route_id) tripRouteMap.set(trip_id, route_id);
  }

  // 4) stop_times.txt (stop_id -> set(route_id))
  console.log("4/4 Lecture stop_times.txt ...");
  const stopTimes = readCsv("stop_times.txt");

  const stopRouteSet = new Map<string, Set<string>>();
  let ignored = 0;

  for (const st of stopTimes) {
    const trip_id = st.trip_id;
    const stop_id = st.stop_id;
    if (!trip_id || !stop_id) {
      ignored++;
      continue;
    }

    const route_id = tripRouteMap.get(trip_id);
    if (!route_id) {
      ignored++;
      continue;
    }

    if (!stopRouteSet.has(stop_id)) stopRouteSet.set(stop_id, new Set());
    stopRouteSet.get(stop_id)!.add(route_id);
  }

  console.log(
    `ℹ️ stop_times: ${stopTimes.length} / ignorés: ${ignored} / stops indexés: ${stopRouteSet.size}`
  );

  const stopRoutes: StopRouteInsert[] = [];

  for (const [stop_id, routeSet] of stopRouteSet.entries()) {
    for (const route_id of routeSet.values()) {
      const info = routeMap.get(route_id);
      stopRoutes.push({
        stop_id,
        route_id,
        route_short_name: info?.short ?? null,
        route_long_name: info?.long ?? null,
        route_type: info?.type ?? null,
      });
    }
  }

  const { error: stopRoutesErr } = await supabase
    .from("tcl_stop_routes")
    .upsert(stopRoutes, { onConflict: "stop_id,route_id" });

  if (stopRoutesErr) throw new Error(`❌ Import stop_routes: ${stopRoutesErr.message}`);
  console.log(`✅ Relations stop↔route importées: ${stopRoutes.length}`);

  console.log("✅ Import terminé.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
