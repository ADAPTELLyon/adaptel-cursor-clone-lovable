import { useState } from "react";
import MainLayout from "@/components/main-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statutColors, secteursColors } from "@/lib/colors";
import { useStatsDashboard } from "@/hooks/useStatsDashboard";
import { useStatsDashboardMonth } from "@/hooks/useStatsDashboardMonth";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
  LabelList,
} from "recharts";
import {
  BarChart2,
  Users,
  Activity,
  PieChart as PieIcon,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { format, getWeek } from "date-fns";
import { fr } from "date-fns/locale";

export default function BackOffice() {
  const [viewMode, setViewMode] = useState<"semaine" | "mois">("semaine");

  const today = new Date();
  const currentWeekNumber = getWeekNumber(today);
  const currentMonthName = format(today, "LLLL", { locale: fr });

// Semaine sélectionnée + toutes les semaines de l'année courante (1 → 52/53)
const [selectedWeek, setSelectedWeek] = useState<number>(currentWeekNumber);

// nombre de semaines ISO dans l'année courante : on utilise la semaine du 28 déc (ISO)
const weeksInYear = getWeek(new Date(new Date().getFullYear(), 11, 28), { weekStartsOn: 1 });
const weeksOptions = Array.from({ length: weeksInYear }, (_, i) => i + 1);

// --- Options pour le mode "mois"
const monthsOptions = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1, // 1..12
  label: format(new Date(2000, i, 1), "LLLL", { locale: fr }), // nom du mois en français
}));

// Quelques années récentes pour l’UI (on branchera sur les années “avec données” après)
const yearsOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).reverse();


// --- Affichage "mois" : mois/année sélectionnés (affichage uniquement pour l'instant)
const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1); // 1..12
const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

// Nom du mois sélectionné (ex: "novembre")
const selectedMonthName = format(
  new Date(selectedYear, selectedMonth - 1, 1),
  "LLLL",
  { locale: fr }
);

const statsSemaine = useStatsDashboard(selectedWeek);
const statsMois = useStatsDashboardMonth(selectedMonth, selectedYear);
const stats = viewMode === "semaine" ? statsSemaine : statsMois;


  const missionsTotal =
    viewMode === "semaine" ? stats.missionsSemaine ?? 0 : stats.missionsMois ?? 0;
  const missionsTotalN1 =
    viewMode === "semaine" ? stats.missionsSemaineN1 ?? 0 : stats.missionsMoisN1 ?? 0;
  const ecart = missionsTotal - missionsTotalN1;
  const position =
    viewMode === "semaine" ? stats.positionSemaine ?? 0 : stats.positionMois ?? 0;

  const statsTop = [
    {
      label: "Demandées",
      value: stats.statsByStatus["Demandées"] ?? 0,
      color: statutColors["Demandées"]?.bg ?? "#8ea9db",
      icon: <Clock className="w-5 h-5" />,
    },
    {
      label: "Validées",
      value: stats.statsByStatus["Validé"] ?? 0,
      color: statutColors["Validé"]?.bg ?? "#a9d08e",
      icon: <CheckCircle className="w-5 h-5" />,
    },
    {
      label: "En recherche",
      value: stats.statsByStatus["En recherche"] ?? 0,
      color: statutColors["En recherche"]?.bg ?? "#fdba74",
      icon: <Activity className="w-5 h-5" />,
    },
    {
      label: "Non pourvue",
      value: stats.statsByStatus["Non pourvue"] ?? 0,
      color: statutColors["Non pourvue"]?.bg ?? "#ef5350",
      icon: <AlertCircle className="w-5 h-5" />,
    },
  ];

  const statsBottom = [
    {
      label: "Annule Client",
      value: stats.statsByStatus["Annule Client"] ?? 0,
      color: statutColors["Annule Client"]?.bg ?? "#fef3c7",
    },
    {
      label: "Annule Int",
      value: stats.statsByStatus["Annule Int"] ?? 0,
      color: statutColors["Annule Int"]?.bg ?? "#fef3c7",
    },
    {
      label: "Annule ADA",
      value: stats.statsByStatus["Annule ADA"] ?? 0,
      color: statutColors["Annule ADA"]?.bg ?? "#d4d4d8",
    },
    {
      label: "Absence",
      value: stats.statsByStatus["Absence"] ?? 0,
      color: statutColors["Absence"]?.bg ?? "#f87171",
    },
  ];

  const repartitionSecteursData = stats.repartitionSecteurs.map((s) => ({
    name: s.secteur.charAt(0).toUpperCase() + s.secteur.slice(1),
    value: s.missions,
    missionsN1: s.missionsN1,
    color: secteursColors[s.secteur.charAt(0).toUpperCase() + s.secteur.slice(1)]?.bg ?? "#ccc",
  }));

  return (
    <MainLayout>
      <div className="p-6 space-y-6 bg-gray-50">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 mb-4">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-8 h-8 text-[#840404]" />
            <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
            <span className="text-3xl font-bold text-gray-700 ml-4">
  • {viewMode === "semaine"
      ? `Semaine ${selectedWeek}`
      : `Mois de ${selectedMonthName} ${selectedYear}`}
</span>
          </div>
          <div className="flex gap-2 items-center">
  <button
    onClick={() => setViewMode("semaine")}
    className={`px-4 py-2 rounded ${
      viewMode === "semaine"
        ? "bg-[#840404] text-white"
        : "bg-gray-100 text-black hover:bg-gray-200"
    }`}
  >
    Semaine
  </button>
  <button
    onClick={() => setViewMode("mois")}
    className={`px-4 py-2 rounded ${
      viewMode === "mois"
        ? "bg-[#840404] text-white"
        : "bg-gray-100 text-black hover:bg-gray-200"
    }`}
  >
    Mois
  </button>

  {/* Sélecteur SEMAINE (visible en mode semaine) */}
  {viewMode === "semaine" && (
    <select
      value={selectedWeek}
      onChange={(e) => setSelectedWeek(Number(e.target.value))}
      className="ml-2 px-3 py-2 border rounded bg-white text-sm shadow-sm"
    >
      {weeksOptions.map((w) => (
        <option key={w} value={w}>
          Semaine {w}
        </option>
      ))}
    </select>
  )}

  {/* Sélecteurs MOIS + ANNÉE (visibles en mode mois) */}
  {viewMode === "mois" && (
    <>
      <select
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(Number(e.target.value))}
        className="ml-2 px-3 py-2 border rounded bg-white text-sm shadow-sm"
      >
        {monthsOptions.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
          </option>
        ))}
      </select>

      <select
        value={selectedYear}
        onChange={(e) => setSelectedYear(Number(e.target.value))}
        className="px-3 py-2 border rounded bg-white text-sm shadow-sm"
      >
        {yearsOptions.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </>
  )}
</div>

          <div className="bg-gray-200 text-gray-800 rounded px-4 py-2 text-base font-semibold shadow border">
            Position : {position}
          </div>
        </div>

        {/* STATS TOP */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsTop.map((stat) => (
            <div
              key={stat.label}
              className="flex justify-between items-center p-4 rounded shadow bg-white border"
              style={{ borderLeft: `10px solid ${stat.color}` }}
            >
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="text-3xl font-bold mt-2">{stat.value}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: `${stat.color}20` }}>
                {stat.icon}
              </div>
            </div>
          ))}
        </div>

        {/* COMPARATIF + REPARTITION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <Card className="lg:col-span-2 shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#840404]" />
                Comparatif secteurs
              </CardTitle>
            </CardHeader>
            <CardContent>
            <ResponsiveContainer width="100%" height={300}>
  <BarChart
    data={repartitionSecteursData}
    margin={{ top: 24, right: 16, left: 0, bottom: 0 }}
  >
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis domain={[0, 'dataMax + 2']} allowDecimals={false} />
    <Tooltip />
    <Legend />
    <Bar dataKey="missionsN1" name={viewMode === "semaine" ? "Semaine N-1" : "Mois N-1"} fill="#9ca3af" />
    <Bar
      dataKey="value"
      name={
        viewMode === "semaine"
          ? `Semaine ${selectedWeek}`
          : `Mois de ${selectedMonthName} ${selectedYear}`
      }
      fill="#840404"
    />
  </BarChart>
</ResponsiveContainer>

            </CardContent>
          </Card>

          {/* camembert */}
          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-[#840404]" />
                Répartition par secteur
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={repartitionSecteursData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {repartitionSecteursData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#000" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* COMPARATIF */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="flex flex-col p-4 bg-white rounded shadow border-l-8 border-[#840404]">
            <p className="text-sm font-medium text-gray-500">
              Total missions {viewMode}
            </p>
            <p className="text-3xl font-bold mt-2">{missionsTotal}</p>
          </div>
          <div className="flex flex-col p-4 bg-white rounded shadow border-l-8 border-gray-400">
            <p className="text-sm font-medium text-gray-500">
              Total {viewMode} N-1
            </p>
            <p className="text-3xl font-bold mt-2">{missionsTotalN1}</p>
          </div>
          <div
            className="flex flex-col p-4 bg-white rounded shadow border-l-8"
            style={{ borderColor: ecart >= 0 ? "#22c55e" : "#ef4444" }}
          >
            <p className="text-sm font-medium text-gray-500">Écart</p>
            <p className="text-3xl font-bold mt-2">{ecart >= 0 ? `+${ecart}` : ecart}</p>
          </div>
        </div>

        {/* SYNTHÈSE + TOP CLIENTS + ANNULATIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#840404]" />
                Synthèse
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between p-3 bg-green-50 rounded-lg">
                <p className="text-green-800 font-medium">Missions validées</p>
                <span className="font-bold text-green-900">{missionsTotal}</span>
              </div>
              <div className="flex justify-between p-3 bg-red-50 rounded-lg">
                <p className="text-red-800 font-medium">Non pourvues</p>
                <span className="font-bold text-red-900">{stats.statsByStatus["Non pourvue"] ?? 0}</span>
              </div>
              <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
                <p className="text-blue-800 font-medium">Temps traitement</p>
                <span className="font-bold text-blue-900">{stats.tempsTraitementMoyen}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#840404]" />
                Top 5 clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.topClients.map((client) => (
                  <div key={client.name} className="flex items-center justify-between">
                    <span className="font-medium">{client.name}</span>
                    <Badge variant="default">{client.missions} missions</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#840404]" />
                Annulations & absences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {statsBottom.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex flex-col items-center p-3 rounded-lg bg-gray-50 shadow border"
                    style={{ borderLeft: `8px solid ${stat.color}` }}
                  >
                    <span className="text-sm text-gray-500">{stat.label}</span>
                    <span className="text-2xl font-bold mt-1 text-black">{stat.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MISSIONS VALIDÉES PAR JOUR */}
        <Card className="shadow-sm border-0 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#840404]" />
              Missions validées par jour (comparatif)
            </CardTitle>
          </CardHeader>
          <CardContent>
          <ResponsiveContainer width="100%" height={300}>
  <BarChart
    data={stats.missionsByDay}
    margin={{ top: 28, right: 16, left: 0, bottom: 0 }}
  >
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="day" />
    <YAxis domain={[0, 'dataMax + 2']} allowDecimals={false} />
    <Tooltip />
    <Legend />
    <Bar
      dataKey="missionsN1"
      name={viewMode === "semaine" ? "Semaine N-1" : "Mois N-1"}
      fill="#9ca3af"
    >
      <LabelList dataKey="missionsN1" position="top" style={{ fill: "#555", fontSize: 12 }} />
    </Bar>
    <Bar
      dataKey="missions"
      name={
        viewMode === "semaine"
          ? `Semaine ${selectedWeek}`
          : `Mois ${selectedMonthName} ${selectedYear}`
      }
      fill="#840404"
    >
      <LabelList dataKey="missions" position="top" style={{ fill: "#111", fontWeight: "bold" }} />
    </Bar>
  </BarChart>
</ResponsiveContainer>

          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function getWeekNumber(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = (+date - +start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000) / 86400000;
  return Math.floor((diff + start.getDay() + 6) / 7);
}
