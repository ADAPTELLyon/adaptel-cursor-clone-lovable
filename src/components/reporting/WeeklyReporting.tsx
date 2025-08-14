import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { statutColors, indicateurColors } from "@/lib/colors";
import {
  BarChart2,
  ThumbsUp,
  AlertCircle,
  TrendingUp,
  Bed,
  ChefHat,
  GlassWater,
  Droplet,
  Bell,
} from "lucide-react";
import {
  startOfYear,
  endOfYear,
  getISOWeek,
  getISOWeeksInYear,
} from "date-fns";

// ===== borne de bascule archives → live =====
const SWITCH_WEEK = { year: 2025, week: 33 } as const;

const DAYS: readonly ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"] =
  ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"];
const SECTEURS: readonly ["étages","cuisine","salle","plonge","réception"] =
  ["étages","cuisine","salle","plonge","réception"];
const SECTEUR_ICONS = [Bed, ChefHat, GlassWater, Droplet, Bell];

function norm(s?: string | null) {
  return (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
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

async function loadYear(year: number): Promise<WeekRow[]> {
  const weeksInYear = getISOWeeksInYear(new Date(year, 0, 4));

  // archives (année affichée)
  const [{ data: daysRows }, { data: secteursRows }, { data: statRows }] = await Promise.all([
    supabase
      .from("donnees_jour_semaine")
      .select("annee,semaine,jour,total_valides")
      .eq("annee", year),
    supabase
      .from("donnees_secteur_semaine")
      .select("annee,semaine,secteur,total_valides")
      .eq("annee", year),
    supabase
      .from("donnees_statut_semaine")
      .select("annee,semaine,statut,total")
      .eq("annee", year),
  ]);

// N-1 validé par semaine (ne PAS filtrer côté SQL : on agrège côté code)
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

  // maps archives
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

  // live (année affichée)
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(new Date(year, 11, 31));
  const { data: cmds } = await supabase
    .from("commandes")
    .select("id, statut, secteur, date")
    .gte("date", start.toISOString())
    .lte("date", end.toISOString());

  const liveByWeek = new Map<
    number,
    {
      days: Record<string, number>;
      secteurs: Record<string, number>;
      stat: { demandees: number; valide: number; en_recherche: number; non_pourvue: number };
    }
  >();

  (cmds ?? []).forEach((c: any) => {
    const d = new Date(c.date);
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

    if (st === "Validé") {
      const day = norm(d.toLocaleDateString("fr-FR", { weekday: "long" }));
      ref.days[day] = (ref.days[day] ?? 0) + 1;
      const sec = canonSecteur(c.secteur);
      if (sec) ref.secteurs[sec] = (ref.secteurs[sec] ?? 0) + 1;
      ref.stat.valide += 1;
      ref.stat.demandees += 1;
    } else if (st === "En recherche") {
      ref.stat.en_recherche += 1;
      ref.stat.demandees += 1;
    } else if (st === "Non pourvue") {
      ref.stat.non_pourvue += 1;
      ref.stat.demandees += 1;
    }
  });

  // construit toutes les semaines
  const rows: WeekRow[] = [];
  for (let w = 1; w <= weeksInYear; w++) {
    const legacy = isLegacyWeek(year, w);

    const joursObj = legacy ? arcDays.get(w) ?? {} : liveByWeek.get(w)?.days ?? {};
    const secteursObj = legacy ? arcSecteurs.get(w) ?? {} : liveByWeek.get(w)?.secteurs ?? {};
    const sObj = legacy
      ? arcStat.get(w) ?? { demandees: 0, valide: 0, en_recherche: 0, non_pourvue: 0 }
      : liveByWeek.get(w)?.stat ?? { demandees: 0, valide: 0, en_recherche: 0, non_pourvue: 0 };

    const jours = DAYS.map((d) => joursObj[d] ?? 0);
    const secteurs = SECTEURS.map((s) => secteursObj[s] ?? 0);

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
    return () => {
      mounted = false;
    };
  }, [annee]);

  const {
    bestWeek,
    bestSectorName,
    nonPourvuePct,
    evolutionPct,
    totalsRow,
    yearOptions,
  } = useMemo(() => {
    // meilleure semaine (plus de validés)
    let bestWeek = 1;
    let bestVal = -1;
    rows.forEach((r) => {
      if (r.total > bestVal) {
        bestVal = r.total;
        bestWeek = r.semaine;
      }
    });

    // meilleur secteur (somme annuelle)
    const sectorSums = [0, 0, 0, 0, 0];
    rows.forEach((r) => r.secteurs.forEach((v, i) => (sectorSums[i] += v)));
    const bestSectorIdx = sectorSums.indexOf(Math.max(...sectorSums));
    const bestSectorName = ["Étages", "Cuisine", "Salle", "Plonge", "Réception"][bestSectorIdx] ?? "—";

    // % Non pourvue = sum(non_pourvue) / sum(demandées) en ignorant les semaines avec demandées=0
    let sumNP = 0;
    let sumDem = 0;
    rows.forEach((r) => {
      if (r.demandees > 0) {
        sumNP += r.non_pourvue;
        sumDem += r.demandees;
      }
    });
    const nonPourvuePct = sumDem > 0 ? Math.round((100 * sumNP) / sumDem) : 0;

// Évolution N-1 : moyenne des % par semaine, uniquement si les 2 valeurs existent
let accPct = 0;
let cnt = 0;
rows.forEach((r) => {
  if (r.total > 0 && r.totalN1 > 0) {
    accPct += ((r.total - r.totalN1) / r.totalN1) * 100;
    cnt++;
  }
});
const evolutionPct = cnt > 0 ? Math.round(accPct / cnt) : 0;

    // Totaux (ligne finale)
    const totalsRow = {
      jours: DAYS.map((_, i) => rows.reduce((a, r) => a + (r.jours[i] || 0), 0)),
      secteurs: SECTEURS.map((_, i) => rows.reduce((a, r) => a + (r.secteurs[i] || 0), 0)),
      demandees: rows.reduce((a, r) => a + r.demandees, 0),
      valide: rows.reduce((a, r) => a + r.valide, 0),
      en_recherche: rows.reduce((a, r) => a + r.en_recherche, 0),
      non_pourvue: rows.reduce((a, r) => a + r.non_pourvue, 0),
      total: rows.reduce((a, r) => a + r.total, 0),
      totalN1: rows.reduce((a, r) => a + r.totalN1, 0),
      ecartPct: rows.reduce((a, r) => a + (r.totalN1 > 0 ? ((r.total - r.totalN1) / r.totalN1) : 0), 0),
    };

    const yearOptions = Array.from(new Set([2024, 2025, annee])).sort((a, b) => a - b);

    return { bestWeek, bestSectorName, nonPourvuePct, evolutionPct, totalsRow, yearOptions };
  }, [rows, annee]);

  // styles (étiquettes comme ta base) + séparateurs
  const cellTag =
    "inline-flex items-center justify-center min-w-[42px] h-7 px-2 rounded text-[11px] font-semibold";
  const cellTagGray = "bg-gray-100";
  const cellTagHL = "ring-2 ring-green-400 bg-white"; // highlight max
  const groupSepThin = "border-r-2 border-white";
  const groupSepThick = "border-r-4 border-gray-300";
  const tdBase = "p-1 align-middle";

  // helpers
  const colorForStatus = (label: string) =>
    (indicateurColors as any)?.[label] ??
    (statutColors as any)?.[label]?.bg ??
    "#e5e7eb";

  const pctText = (cur: number, prev: number) => {
    if (!prev || prev === 0) return "";
    const p = Math.round(((cur - prev) / prev) * 100);
    const arrow = p > 0 ? "▲" : p < 0 ? "▼" : "＝";
    return `${arrow} ${p > 0 ? "+" : ""}${p}%`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="flex justify-between items-center p-4 border-l-4 border-[#840404] shadow-sm">
          <div>
            <p className="text-xs text-gray-500">Meilleure semaine</p>
            <p className="text-2xl font-bold">{bestWeek}</p>
          </div>
          <BarChart2 className="w-6 h-6 text-[#840404]" />
        </Card>

        <Card className="flex justify-between items-center p-4 border-l-4 border-[#840404] shadow-sm">
          <div>
            <p className="text-xs text-gray-500">Meilleur secteur</p>
            <p className="text-xl font-bold">{bestSectorName}</p>
          </div>
          <ThumbsUp className="w-6 h-6 text-[#840404]" />
        </Card>

        <Card className="flex justify-between items-center p-4 border-l-4 border-[#ef5350] shadow-sm">
          <div>
            <p className="text-xs text-gray-500">% Non pourvue</p>
            <p className="text-2xl font-bold text-[#ef5350]">{nonPourvuePct}%</p>
          </div>
          <AlertCircle className="w-6 h-6 text-[#ef5350]" />
        </Card>

        <Card className="flex justify-between items-center p-4 border-l-4 border-[#a9d08e] shadow-sm">
          <div>
            <p className="text-xs text-gray-500">Évolution N-1</p>
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
          <SelectTrigger>
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* TABLEAU */}
      <Card className="shadow-sm border">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs bg-gray-50 border-separate border-spacing-0">
            <thead className="bg-gray-200 text-center">
              <tr>
                <th className={`p-2 ${groupSepThin}`}>Semaine</th>

                {/* Jours */}
                {DAYS.map((d, i) => {
                  const isLastDay = i === DAYS.length - 1;
                  return (
                    <th
                      key={d}
                      className={`p-2 w-[56px] ${isLastDay ? groupSepThick : groupSepThin}`}
                    >
                      {d.slice(0,3).charAt(0).toUpperCase() + d.slice(1,3)}
                    </th>
                  );
                })}

                {/* Secteurs — icônes uniquement, même largeur */}
                {SECTEURS.map((_, i) => {
                  const Icon = SECTEUR_ICONS[i];
                  const isLastSect = i === SECTEURS.length - 1;
                  return (
                    <th
                      key={i}
                      className={`p-2 w-[64px] ${isLastSect ? groupSepThick : groupSepThin}`}
                    >
                      <div className="flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                    </th>
                  );
                })}

                {/* Statuts : largeurs suffisantes pour libellé complet */}
                {[
                  { label: "Demandées", w: "w-[110px]" },
                  { label: "Validé", w: "w-[100px]" },
                  { label: "En recherche", w: "w-[120px]" },
                  { label: "Non pourvue", w: "w-[120px]" },
                ].map((s, i, arr) => {
                  const isLastStatus = i === arr.length - 1;
                  return (
                    <th
                      key={s.label}
                      className={`p-2 ${s.w} ${isLastStatus ? groupSepThick : groupSepThin}`}
                    >
                      {s.label}
                    </th>
                  );
                })}

                {/* Totaux (section) */}
                <th className={`p-2 w-[90px] ${groupSepThin}`}>Total</th>
                <th className={`p-2 w-[100px] ${groupSepThin}`}>Total N-1</th>
                <th className="p-2 w-[90px]">Écart</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                rows.map((w) => {
                  const maxDay = Math.max(...w.jours);
                  const maxSec = Math.max(...w.secteurs);

                  return (
                    <tr key={w.semaine} className="text-center border-b-4 border-white">
                      {/* Semaine */}
                      <td className={`font-bold bg-gray-200 p-2 ${groupSepThin}`}>{w.semaine}</td>

                      {/* Jours */}
                      {w.jours.map((n, i) => {
                        const isMax = maxDay > 0 && n === maxDay;
                        const isLastDay = i === DAYS.length - 1;
                        return (
                          <td key={`j-${i}`} className={`${tdBase} ${isLastDay ? groupSepThick : groupSepThin}`}>
                            <span className={`${cellTag} ${isMax ? cellTagHL : cellTagGray}`}>
                              {n > 0 ? n : ""}
                            </span>
                          </td>
                        );
                      })}

                      {/* Secteurs */}
                      {w.secteurs.map((n, i) => {
                        const isMax = maxSec > 0 && n === maxSec;
                        const isLastSect = i === SECTEURS.length - 1;
                        return (
                          <td key={`s-${i}`} className={`${tdBase} ${isLastSect ? groupSepThick : groupSepThin}`}>
                            <span className={`${cellTag} ${isMax ? cellTagHL : cellTagGray}`}>
                              {n > 0 ? n : ""}
                            </span>
                          </td>
                        );
                      })}

                      {/* Statuts (étiquettes colorées) */}
                      {[
                        { label: "Demandées", value: w.demandees },
                        { label: "Validé", value: w.valide },
                        { label: "En recherche", value: w.en_recherche },
                        { label: "Non pourvue", value: w.non_pourvue },
                      ].map(({ label, value }, i, arr) => {
                        const showZero = label === "En recherche";
                        const isLastStatus = i === arr.length - 1;
                        const bg = colorForStatus(label);
                        return (
                          <td key={`st-${label}`} className={`${tdBase} ${isLastStatus ? groupSepThick : groupSepThin}`}>
                            <span className={cellTag} style={{ backgroundColor: bg, color: "#000" }}>
                              {value > 0 ? value : showZero ? 0 : ""}
                            </span>
                          </td>
                        );
                      })}

                      {/* Totaux */}
                      <td className={`${tdBase} ${groupSepThin}`}>
                        <span className={`${cellTag} bg-gray-200 font-bold`}>{w.total}</span>
                      </td>
                      <td className={`${tdBase} ${groupSepThin}`}>
                        <span className={`${cellTag} bg-gray-200 font-bold`}>{w.totalN1}</span>
                      </td>
                      <td className={tdBase}>
                        <span
                          className={`${cellTag} font-bold`}
                          style={{
                            backgroundColor:
                              w.totalN1 > 0
                                ? (w.total - w.totalN1) >= 0
                                  ? "#dcfce7"
                                  : "#fee2e2"
                                : "#f3f4f6",
                          }}
                        >
                          {pctText(w.total, w.totalN1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}

              {/* LIGNE TOTAUX */}
              {!loading && (
                <tr className="text-center">
                  <td className={`font-extrabold bg-gray-300 p-2 ${groupSepThin}`}>Totaux</td>

                  {/* Totaux jours */}
                  {totalsRow.jours.map((n, i) => {
                    const isLastDay = i === DAYS.length - 1;
                    return (
                      <td key={`tj-${i}`} className={`${tdBase} ${isLastDay ? groupSepThick : groupSepThin}`}>
                        <span className={`${cellTag} bg-gray-200 font-bold`}>{n}</span>
                      </td>
                    );
                  })}

                  {/* Totaux secteurs */}
                  {totalsRow.secteurs.map((n, i) => {
                    const isLastSect = i === SECTEURS.length - 1;
                    return (
                      <td key={`ts-${i}`} className={`${tdBase} ${isLastSect ? groupSepThick : groupSepThin}`}>
                        <span className={`${cellTag} bg-gray-200 font-bold`}>{n}</span>
                      </td>
                    );
                  })}

                  {/* Totaux statuts */}
                  {[
                    { k: "demandees", label: "Demandées" },
                    { k: "valide", label: "Validé" },
                    { k: "en_recherche", label: "En recherche" },
                    { k: "non_pourvue", label: "Non pourvue" },
                  ].map(({ k, label }, i, arr) => {
                    const val = (totalsRow as any)[k];
                    const isLastStatus = i === arr.length - 1;
                    const bg = colorForStatus(label);
                    return (
                      <td key={`tst-${k}`} className={`${tdBase} ${isLastStatus ? groupSepThick : groupSepThin}`}>
                        <span className={cellTag} style={{ backgroundColor: bg, color: "#000" }}>
                          {val}
                        </span>
                      </td>
                    );
                  })}

                  {/* Totaux globaux */}
                  <td className={`${tdBase} ${groupSepThin}`}>
                    <span className={`${cellTag} bg-gray-300 font-extrabold`}>{totalsRow.total}</span>
                  </td>
                  <td className={`${tdBase} ${groupSepThin}`}>
                    <span className={`${cellTag} bg-gray-300 font-extrabold`}>{totalsRow.totalN1}</span>
                  </td>
                  <td className={tdBase}>
                    <span
                      className={`${cellTag} font-extrabold`}
                      style={{
                        backgroundColor:
                          totalsRow.totalN1 > 0
                            ? (totalsRow.total - totalsRow.totalN1) >= 0
                              ? "#bbf7d0"
                              : "#fecaca"
                            : "#e5e7eb",
                      }}
                    >
                      {pctText(totalsRow.total, totalsRow.totalN1)}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="p-6 text-center text-sm text-gray-500">Chargement des données…</div>
        )}
      </Card>
    </div>
  );
}
