// WeeklyReporting.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { statutColors, indicateurColors } from "@/lib/colors";
import {
  BarChart2, ThumbsUp, AlertCircle, TrendingUp, Bed, ChefHat, GlassWater, Droplet, Bell,
} from "lucide-react";
import {
  startOfYear, endOfYear, getISOWeek, getISOWeeksInYear, format, parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";

const SWITCH_WEEK = { year: 2025, week: 33 } as const;

const DAYS = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"] as const;
const SECTEURS = ["étages","cuisine","salle","plonge","réception"] as const;
const SECTEUR_ICONS = [Bed, ChefHat, GlassWater, Droplet, Bell];

function norm(s?: string | null) {
  return (s ?? "").toString().trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
function canonSecteur(s?: string | null) {
  const n = norm(s);
  if (n === "etages") return "étages";
  if (n === "cuisine") return "cuisine";
  if (n === "salle") return "salle";
  if (n === "plonge") return "plonge";
  if (n === "reception") return "réception";
  return "";
}
function isLegacyWeek(year: number, week: number) {
  return year < SWITCH_WEEK.year || (year === SWITCH_WEEK.year && week < SWITCH_WEEK.week);
}
function dayKeyFromDate(dateStr: string) {
  const d = parseISO(`${String(dateStr).slice(0, 10)}T12:00:00`);
  return norm(format(d, "eeee", { locale: fr }));
}

type WeekRow = {
  semaine: number;
  jours: number[];    // [lun..dim] validés
  secteurs: number[]; // [étages,cuisine,salle,plonge,réception]
  demandees: number;
  valide: number;
  en_recherche: number;
  non_pourvue: number;
  total: number;      // = valide
  totalN1: number;    // validé N-1
};

// ⬇️ NOUVEAU: pagination Supabase pour commandes (évite la limite 1000)
async function fetchAllCommandesBetween(startStr: string, endStr: string) {
  const pageSize = 1000;
  let from = 0;
  let all: any[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("commandes")
      .select("id, statut, secteur, date")
      .gte("date", startStr)
      .lte("date", endStr)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all = all.concat(data ?? []);
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function loadYear(year: number): Promise<WeekRow[]> {
  const weeksInYear = getISOWeeksInYear(new Date(year, 0, 4));

  // === ARCHIVES (année affichée) ===
  const [{ data: daysRows }, { data: secteursRows }, { data: statRows }] = await Promise.all([
    supabase.from("donnees_jour_semaine")
      .select("annee,semaine,jour,total_valides").eq("annee", year),
    supabase.from("donnees_secteur_semaine")
      .select("annee,semaine,secteur,total_valides").eq("annee", year),
    supabase.from("donnees_statut_semaine")
      .select("annee,semaine,statut,total").eq("annee", year),
  ]);

  // === N-1 (archives) ===
  const { data: n1Rows } = await supabase
    .from("donnees_statut_semaine")
    .select("annee,semaine,statut,total")
    .eq("annee", year - 1);

  const n1ValidByWeek = new Map<number, number>();
  (n1Rows ?? []).forEach((r: any) => {
    const s = norm(r?.statut);
    if (s.startsWith("valide")) {
      const w = Number(r.semaine) || 0;
      const v = Number(r.total) || 0;
      n1ValidByWeek.set(w, (n1ValidByWeek.get(w) ?? 0) + v);
    }
  });

  const arcDays = new Map<number, Record<string, number>>();
  (daysRows ?? []).forEach((r: any) => {
    const w = Number(r.semaine) || 0;
    const d = norm(r.jour);
    const v = Number(r.total_valides) || 0;
    if (!arcDays.has(w)) arcDays.set(w, {});
    const ref = arcDays.get(w)!;
    ref[d] = (ref[d] ?? 0) + v;
  });

  const arcSecteurs = new Map<number, Record<string, number>>();
  (secteursRows ?? []).forEach((r: any) => {
    const w = Number(r.semaine) || 0;
    const key = canonSecteur(r.secteur);
    const v = Number(r.total_valides) || 0;
    if (!arcSecteurs.has(w)) arcSecteurs.set(w, {});
    const ref = arcSecteurs.get(w)!;
    if (key) ref[key] = (ref[key] ?? 0) + v;
  });

  const arcStat = new Map<number, { demandees: number; valide: number; en_recherche: number; non_pourvue: number }>();
  (statRows ?? []).forEach((r: any) => {
    const w = Number(r.semaine) || 0;
    const s = norm(r.statut);
    const v = Number(r.total) || 0;
    if (!arcStat.has(w)) {
      arcStat.set(w, { demandees: 0, valide: 0, en_recherche: 0, non_pourvue: 0 });
    }
    const ref = arcStat.get(w)!;
    if (s.startsWith("valide")) ref.valide += v;
    else if (s === "en recherche") ref.en_recherche += v;
    else if (s.startsWith("non pourvue")) ref.non_pourvue += v;
    else if (s.startsWith("demande")) ref.demandees += v;
  });

  // === LIVE (année affichée) — avec pagination ===
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(new Date(year, 11, 31));
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const cmds = await fetchAllCommandesBetween(startStr, endStr);

  const liveByWeek = new Map<
    number,
    {
      days: Record<string, number>;
      secteurs: Record<string, number>;
      stat: { demandees: number; valide: number; en_recherche: number; non_pourvue: number };
    }
  >();

  (cmds ?? []).forEach((c: any) => {
    const d = parseISO(`${String(c.date).slice(0, 10)}T12:00:00`);
    const w = getISOWeek(d);
    if (!liveByWeek.has(w)) {
      liveByWeek.set(w, {
        days: {},
        secteurs: {},
        stat: { demandees: 0, valide: 0, en_recherche: 0, non_pourvue: 0 },
      });
    }
    const ref = liveByWeek.get(w)!;
    const st = (c.statut || "").trim();

    if (st === "Validé" || st === "En recherche" || st === "Non pourvue") {
      ref.stat.demandees += 1;
    }
    if (st === "Validé") {
      const day = dayKeyFromDate(String(c.date));
      ref.days[day] = (ref.days[day] ?? 0) + 1;
      const sec = canonSecteur(c.secteur);
      if (sec) ref.secteurs[sec] = (ref.secteurs[sec] ?? 0) + 1;
      ref.stat.valide += 1;
    } else if (st === "En recherche") {
      ref.stat.en_recherche += 1;
    } else if (st === "Non pourvue") {
      ref.stat.non_pourvue += 1;
    }
  });

  // === lignes du tableau ===
  const rows: WeekRow[] = [];
  for (let w = 1; w <= weeksInYear; w++) {
    const legacy = isLegacyWeek(year, w);

    const joursObj = legacy ? arcDays.get(w) ?? {} : liveByWeek.get(w)?.days ?? {};
    const secteursObj = legacy ? arcSecteurs.get(w) ?? {} : liveByWeek.get(w)?.secteurs ?? {};
    const sObjRaw = legacy
      ? arcStat.get(w) ?? { demandees: 0, valide: 0, en_recherche: 0, non_pourvue: 0 }
      : liveByWeek.get(w)?.stat ?? { demandees: 0, valide: 0, en_recherche: 0, non_pourvue: 0 };

    const sObj = { ...sObjRaw };
    if (legacy && (!sObj.demandees || sObj.demandees === 0)) {
      sObj.demandees = (sObj.valide || 0) + (sObj.en_recherche || 0) + (sObj.non_pourvue || 0);
    }

    const jours = DAYS.map((d) => (joursObj as any)[d] ?? 0);
    const secteurs = SECTEURS.map((s) => (secteursObj as any)[s] ?? 0);

    rows.push({
      semaine: w,
      jours,
      secteurs,
      demandees: sObj.demandees,
      valide: sObj.valide,
      en_recherche: sObj.en_recherche,
      non_pourvue: sObj.non_pourvue,
      total: sObj.valide,
      totalN1: n1ValidByWeek.get(w) ?? 0,
    });
  }
  return rows;
}

export default function WeeklyReporting() {
  const [annee, setAnnee] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const data = await loadYear(annee);
      if (mounted) {
        setRows(data);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [annee]);

  const { bestWeek, bestSectorName, nonPourvuePct, evolutionPct, totalsRow, yearOptions } = useMemo(() => {
    let bestWeek = 1, bestVal = -1;
    rows.forEach((r) => { if (r.total > bestVal) { bestVal = r.total; bestWeek = r.semaine; } });

    const sectorSums = [0, 0, 0, 0, 0];
    rows.forEach((r) => r.secteurs.forEach((v, i) => (sectorSums[i] += v)));
    const bestSectorIdx = sectorSums.indexOf(Math.max(...sectorSums));
    const bestSectorName = ["Étages","Cuisine","Salle","Plonge","Réception"][bestSectorIdx] ?? "—";

    let sumNP = 0, sumDem = 0;
    rows.forEach((r) => { if (r.demandees > 0) { sumNP += r.non_pourvue; sumDem += r.demandees; } });
    const nonPourvuePct = sumDem > 0 ? Math.round((100 * sumNP) / sumDem) : 0;

    let accPct = 0, cnt = 0;
    rows.forEach((r) => { if (r.total > 0 && r.totalN1 > 0) { accPct += ((r.total - r.totalN1) / r.totalN1) * 100; cnt++; } });
    const evolutionPct = cnt > 0 ? Math.round(accPct / cnt) : 0;

    const totalsRow = {
      jours: DAYS.map((_, i) => rows.reduce((a, r) => a + (r.jours[i] || 0), 0)),
      secteurs: SECTEURS.map((_, i) => rows.reduce((a, r) => a + (r.secteurs[i] || 0), 0)),
      demandees: rows.reduce((a, r) => a + r.demandees, 0),
      valide: rows.reduce((a, r) => a + r.valide, 0),
      en_recherche: rows.reduce((a, r) => a + r.en_recherche, 0),
      non_pourvue: rows.reduce((a, r) => a + r.non_pourvue, 0),
      total: rows.reduce((a, r) => a + r.total, 0),
      totalN1: rows.reduce((a, r) => a + r.totalN1, 0),
      ecartPct: rows.reduce((a, r) => a + (r.totalN1 > 0 ? (r.total - r.totalN1) / r.totalN1 : 0), 0),
    };

    const yearOptions = Array.from(new Set([2024, 2025, annee])).sort((a, b) => a - b);
    return { bestWeek, bestSectorName, nonPourvuePct, evolutionPct, totalsRow, yearOptions };
  }, [rows, annee]);

  const cellTag = "inline-flex items-center justify-center min-w-[42px] h-7 px-2 rounded text-[11px] font-semibold";
  const cellTagGray = "bg-gray-100";
  const cellTagHL = "ring-2 ring-green-400 bg-white";
  const groupSepThin = "border-r-2 border-white";
  const groupSepThick = "border-r-4 border-gray-300";
  const tdBase = "p-1 align-middle";
  const colorForStatus = (label: string) =>
    (indicateurColors as any)?.[label] ?? (statutColors as any)?.[label]?.bg ?? "#e5e7eb";

  const pctText = (cur: number, prev: number) => {
    if (!prev || prev === 0) return "";
    const p = Math.round(((cur - prev) / prev) * 100);
    const arrow = p > 0 ? "▲" : p < 0 ? "▼" : "＝";
    return `${arrow} ${p > 0 ? "+" : ""}${p}%`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="flex justify-between items-center p-4 border-l-4 border-[#840404] shadow-sm">
          <div><p className="text-xs text-gray-500">Meilleure semaine</p><p className="text-2xl font-bold">{bestWeek}</p></div>
          <BarChart2 className="w-6 h-6 text-[#840404]" />
        </Card>
        <Card className="flex justify-between items-center p-4 border-l-4 border-[#840404] shadow-sm">
          <div><p className="text-xs text-gray-500">Meilleur secteur</p><p className="text-xl font-bold">{bestSectorName}</p></div>
          <ThumbsUp className="w-6 h-6 text-[#840404]" />
        </Card>
        <Card className="flex justify-between items-center p-4 border-l-4 border-[#ef5350] shadow-sm">
          <div><p className="text-xs text-gray-500">% Non pourvue</p><p className="text-2xl font-bold text-[#ef5350]">{nonPourvuePct}%</p></div>
          <AlertCircle className="w-6 h-6 text-[#ef5350]" />
        </Card>
        <Card className="flex justify-between items-center p-4 border-l-4 border-[#a9d08e] shadow-sm">
          <div><p className="text-xs text-gray-500">Évolution N-1</p>
            <p className={`text-2xl font-bold ${evolutionPct >= 0 ? "text-green-600" : "text-red-600"}`}>
              {evolutionPct >= 0 ? "+" : ""}{evolutionPct}%
            </p>
          </div>
          <TrendingUp className={`w-6 h-6 ${evolutionPct >= 0 ? "text-green-600" : "text-red-600"}`} />
        </Card>
      </div>

      {/* Sélecteur année */}
      <div className="w-40 mt-2">
        <Select value={String(annee)} onValueChange={(v) => setAnnee(Number(v))}>
          <SelectTrigger><SelectValue placeholder="Année" /></SelectTrigger>
          <SelectContent>{[...new Set([2024, 2025, annee])].sort((a,b)=>a-b).map((y)=>
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          )}</SelectContent>
        </Select>
      </div>

      {/* Tableau */}
      <Card className="shadow-sm border">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs bg-gray-50 border-separate border-spacing-0">
            <thead className="bg-gray-200 text-center">
              <tr>
                <th className={`p-2 ${groupSepThin}`}>Semaine</th>
                {DAYS.map((d,i)=>(
                  <th key={d} className={`p-2 w-[56px] ${i===DAYS.length-1?groupSepThick:groupSepThin}`}>
                    {d.slice(0,3).charAt(0).toUpperCase()+d.slice(1,3)}
                  </th>
                ))}
                {SECTEURS.map((_,i)=>{ const Icon = SECTEUR_ICONS[i];
                  return (
                    <th key={i} className={`p-2 w-[64px] ${i===SECTEURS.length-1?groupSepThick:groupSepThin}`}>
                      <div className="flex items-center justify-center"><Icon className="w-4 h-4" /></div>
                    </th>
                  );
                })}
                {[{label:"Demandées",w:"w-[110px]"},
                  {label:"Validé",w:"w-[100px]"},
                  {label:"En recherche",w:"w-[120px]"},
                  {label:"Non pourvue",w:"w-[120px]"}].map((s,i,arr)=>(
                  <th key={s.label} className={`p-2 ${s.w} ${i===arr.length-1?groupSepThick:groupSepThin}`}>{s.label}</th>
                ))}
                <th className={`p-2 w-[90px] ${groupSepThin}`}>Total</th>
                <th className={`p-2 w-[100px] ${groupSepThin}`}>Total N-1</th>
                <th className="p-2 w-[90px]">Écart</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.map((w)=>{
                const maxDay = Math.max(...w.jours);
                const maxSec = Math.max(...w.secteurs);
                return (
                  <tr key={w.semaine} className="text-center border-b-4 border-white">
                    <td className={`font-bold bg-gray-200 p-2 ${groupSepThin}`}>{w.semaine}</td>
                    {w.jours.map((n,i)=>(
                      <td key={`j-${i}`} className={`${tdBase} ${i===DAYS.length-1?groupSepThick:groupSepThin}`}>
                        <span className={`${cellTag} ${maxDay>0&&n===maxDay?cellTagHL:cellTagGray}`}>{n>0?n:""}</span>
                      </td>
                    ))}
                    {w.secteurs.map((n,i)=>(
                      <td key={`s-${i}`} className={`${tdBase} ${i===SECTEURS.length-1?groupSepThick:groupSepThin}`}>
                        <span className={`${cellTag} ${maxSec>0&&n===maxSec?cellTagHL:cellTagGray}`}>{n>0?n:""}</span>
                      </td>
                    ))}
                    {[{label:"Demandées",value:w.demandees},
                      {label:"Validé",value:w.valide},
                      {label:"En recherche",value:w.en_recherche},
                      {label:"Non pourvue",value:w.non_pourvue}].map(({label,value},i,arr)=>(
                      <td key={`st-${label}`} className={`${tdBase} ${i===arr.length-1?groupSepThick:groupSepThin}`}>
                        <span className={cellTag} style={{ backgroundColor: (indicateurColors as any)?.[label] ?? (statutColors as any)?.[label]?.bg ?? "#e5e7eb", color: "#000" }}>
                          {value>0?value:label==="En recherche"?0:""}
                        </span>
                      </td>
                    ))}
                    <td className={`${tdBase} ${groupSepThin}`}>
                      <span className={`${cellTag} bg-gray-200 font-bold`}>{w.total}</span>
                    </td>
                    <td className={`${tdBase} ${groupSepThin}`}>
                      <span className={`${cellTag} bg-gray-200 font-bold`}>{w.totalN1}</span>
                    </td>
                    <td className={tdBase}>
                      <span className={`${cellTag} font-bold`} style={{ backgroundColor: w.totalN1>0 ? (w.total-w.totalN1)>=0 ? "#dcfce7" : "#fee2e2" : "#f3f4f6" }}>
                        {w.totalN1>0 ? (()=>{
                          const p = Math.round(((w.total - w.totalN1)/w.totalN1)*100);
                          return `${p>0?"▲":p<0?"▼":"＝"} ${p>0?"+":""}${p}%`;
                        })() : ""}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!loading && (
                <tr className="text-center">
                  <td className={`font-extrabold bg-gray-300 p-2 ${groupSepThin}`}>Totaux</td>
                  {DAYS.map((_,i)=>{
                    const n = rows.reduce((a,r)=>a+(r.jours[i]||0),0);
                    return (
                      <td key={`tj-${i}`} className={`${tdBase} ${i===DAYS.length-1?groupSepThick:groupSepThin}`}>
                        <span className={`${cellTag} bg-gray-200 font-bold`}>{n}</span>
                      </td>
                    );
                  })}
                  {SECTEURS.map((_,i)=>{
                    const n = rows.reduce((a,r)=>a+(r.secteurs[i]||0),0);
                    return (
                      <td key={`ts-${i}`} className={`${tdBase} ${i===SECTEURS.length-1?groupSepThick:groupSepThin}`}>
                        <span className={`${cellTag} bg-gray-200 font-bold`}>{n}</span>
                      </td>
                    );
                  })}
                  {[{key:"demandees",label:"Demandées"},{key:"valide",label:"Validé"},{key:"en_recherche",label:"En recherche"},{key:"non_pourvue",label:"Non pourvue"}]
                    .map(({key,label},i,arr)=>{
                      const val = rows.reduce((a,r)=>a+(r as any)[key],0);
                      return (
                        <td key={`tst-${key}`} className={`${tdBase} ${i===arr.length-1?groupSepThick:groupSepThin}`}>
                          <span className={cellTag} style={{ backgroundColor: (indicateurColors as any)?.[label] ?? (statutColors as any)?.[label]?.bg ?? "#e5e7eb", color: "#000" }}>
                            {val}
                          </span>
                        </td>
                      );
                  })}
                  <td className={`${tdBase} ${groupSepThin}`}>
                    <span className={`${cellTag} bg-gray-300 font-extrabold`}>{rows.reduce((a,r)=>a+r.total,0)}</span>
                  </td>
                  <td className={`${tdBase} ${groupSepThin}`}>
                    <span className={`${cellTag} bg-gray-300 font-extrabold`}>{rows.reduce((a,r)=>a+r.totalN1,0)}</span>
                  </td>
                  <td className={tdBase}>
                    <span className={`${cellTag} font-extrabold`} style={{
                      backgroundColor:
                        rows.reduce((a,r)=>a+r.totalN1,0) > 0
                          ? (rows.reduce((a,r)=>a+r.total,0) - rows.reduce((a,r)=>a+r.totalN1,0)) >= 0 ? "#bbf7d0" : "#fecaca"
                          : "#e5e7eb",
                    }}>
                      {(()=>{
                        const cur = rows.reduce((a,r)=>a+r.total,0);
                        const prev = rows.reduce((a,r)=>a+r.totalN1,0);
                        if (!prev) return "";
                        const p = Math.round(((cur - prev)/prev)*100);
                        return `${p>0?"▲":p<0?"▼":"＝"} ${p>0?"+":""}${p}%`;
                      })()}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && <div className="p-6 text-center text-sm text-gray-500">Chargement des données…</div>}
      </Card>
    </div>
  );
}
