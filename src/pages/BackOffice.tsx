import MainLayout from "@/components/main-layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { statutColors, secteursColors } from "@/lib/colors"
import { useStatsDashboard } from "@/hooks/useStatsDashboard"
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
} from "recharts"
import {
  BarChart2,
  Users,
  Activity,
  PieChart as PieIcon,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react"

export default function BackOffice() {
  const today = new Date()
  const currentWeekNumber = getWeekNumber(today)

  const {
    statsByStatus,
    missionsSemaine,
    missionsSemaineN1,
    missionsByDay,
    repartitionSecteurs,
    positionSemaine,
    topClients,
    tempsTraitementMoyen,
    isLoading,
  } = useStatsDashboard()

  const ecartSemaine = missionsSemaine - missionsSemaineN1

  const statsTop = [
    {
      label: "Demandées",
      value: statsByStatus["Demandées"] ?? 0,
      color: statutColors["Demandées"]?.bg ?? "#8ea9db",
      icon: <Clock className="w-5 h-5" />,
    },
    {
      label: "Validées",
      value: statsByStatus["Validé"] ?? 0,
      color: statutColors["Validé"]?.bg ?? "#a9d08e",
      icon: <CheckCircle className="w-5 h-5" />,
    },
    {
      label: "En recherche",
      value: statsByStatus["En recherche"] ?? 0,
      color: statutColors["En recherche"]?.bg ?? "#fdba74",
      icon: <Activity className="w-5 h-5" />,
    },
    {
      label: "Non pourvue",
      value: statsByStatus["Non pourvue"] ?? 0,
      color: statutColors["Non pourvue"]?.bg ?? "#ef5350",
      icon: <AlertCircle className="w-5 h-5" />,
    },
  ]

  const statsBottom = [
    {
      label: "Annule Client",
      value: statsByStatus["Annule Client"] ?? 0,
      color: statutColors["Annule Client"]?.bg ?? "#fef3c7",
    },
    {
      label: "Annule Int",
      value: statsByStatus["Annule Int"] ?? 0,
      color: statutColors["Annule Int"]?.bg ?? "#fef3c7",
    },
    {
      label: "Annule ADA",
      value: statsByStatus["Annule ADA"] ?? 0,
      color: statutColors["Annule ADA"]?.bg ?? "#d4d4d8",
    },
    {
      label: "Absence",
      value: statsByStatus["Absence"] ?? 0,
      color: statutColors["Absence"]?.bg ?? "#f87171",
    },
  ]

  const repartitionSecteursData = repartitionSecteurs.map((s) => ({
    name: s.secteur.charAt(0).toUpperCase() + s.secteur.slice(1),
    value: s.missions,
    missionsN1: s.missionsN1,
    color: secteursColors[s.secteur.charAt(0).toUpperCase() + s.secteur.slice(1)]?.bg ?? "#ccc",
  }))

  return (
    <MainLayout>
      <div className="p-6 space-y-6 bg-gray-50">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 mb-4">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-8 h-8 text-[#840404]" />
            <h1 className="text-3xl font-bold text-gray-900">Tableau de bord</h1>
            <span className="text-3xl font-bold text-gray-700 ml-4">• Semaine {currentWeekNumber}</span>
          </div>
          <div className="bg-gray-200 text-gray-800 rounded px-4 py-2 text-base font-semibold shadow border">
            Position : {positionSemaine}
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
          {/* comparatif */}
          <Card className="lg:col-span-2 shadow-sm border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#840404]" />
                Comparatif secteurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={repartitionSecteursData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="missionsN1" name="Semaine N-1" fill="#9ca3af" />
                  <Bar dataKey="value" name={`Semaine ${currentWeekNumber}`} fill="#840404" />
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

        {/* COMPARATIF SEMAINE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="flex flex-col p-4 bg-white rounded shadow border-l-8 border-[#840404]">
            <p className="text-sm font-medium text-gray-500">Total missions semaine en cours</p>
            <p className="text-3xl font-bold mt-2">{missionsSemaine}</p>
          </div>
          <div className="flex flex-col p-4 bg-white rounded shadow border-l-8 border-gray-400">
            <p className="text-sm font-medium text-gray-500">Total missions semaine N-1</p>
            <p className="text-3xl font-bold mt-2">{missionsSemaineN1}</p>
          </div>
          <div
            className="flex flex-col p-4 bg-white rounded shadow border-l-8"
            style={{ borderColor: ecartSemaine >= 0 ? "#22c55e" : "#ef4444" }}
          >
            <p className="text-sm font-medium text-gray-500">Écart</p>
            <p className="text-3xl font-bold mt-2">{ecartSemaine >= 0 ? `+${ecartSemaine}` : ecartSemaine}</p>
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
                <span className="font-bold text-green-900">{missionsSemaine}</span>
              </div>
              <div className="flex justify-between p-3 bg-red-50 rounded-lg">
                <p className="text-red-800 font-medium">Non pourvues</p>
                <span className="font-bold text-red-900">{statsByStatus["Non pourvue"] ?? 0}</span>
              </div>
              <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
                <p className="text-blue-800 font-medium">Temps traitement</p>
                <span className="font-bold text-blue-900">{tempsTraitementMoyen}</span>
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
                {topClients.map((client) => (
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
              <BarChart data={missionsByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="missionsN1" name="Semaine N-1" fill="#9ca3af">
                  <LabelList dataKey="missionsN1" position="top" style={{ fill: "#555", fontSize: 12 }} />
                </Bar>
                <Bar dataKey="missions" name={`Semaine ${currentWeekNumber}`} fill="#840404">
                  <LabelList dataKey="missions" position="top" style={{ fill: "#111", fontWeight: "bold" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}

function getWeekNumber(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1)
  const diff = (+date - +start + (start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000) / 86400000
  return Math.floor((diff + start.getDay() + 6) / 7)
}
