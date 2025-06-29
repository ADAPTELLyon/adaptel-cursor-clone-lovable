import MainLayout from "@/components/main-layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { secteursList } from "@/lib/secteurs"
import { statutColors } from "@/lib/colors"
import { CheckCircle, AlertTriangle, Clock } from "lucide-react"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"

export default function BackOffice() {
  const semaineCourante = 26 // exemple
  const positionSemaine = 4
  const tempsTraitement = "1j 3h"
  const stats = [
    { label: "Demandées", value: 120, color: statutColors["En recherche"].bg },
    { label: "Validées", value: 90, color: statutColors["Validé"].bg },
    { label: "En recherche", value: 15, color: statutColors["En recherche"].bg },
    { label: "Non pourvue", value: 5, color: statutColors["Non pourvue"]?.bg ?? "#999" },
    { label: "Annule Client", value: 3, color: statutColors["Annule Client"]?.bg ?? "#999" },
    { label: "Annule Int", value: 2, color: statutColors["Annule Int"]?.bg ?? "#999" },
    { label: "Absence", value: 1, color: statutColors["Absence"]?.bg ?? "#999" },
  ]

  const compareSecteurs = [
    { secteur: "Étages", current: 30, previous: 28 },
    { secteur: "Cuisine", current: 25, previous: 30 },
    { secteur: "Salle", current: 15, previous: 14 },
    { secteur: "Plonge", current: 12, previous: 10 },
    { secteur: "Réception", current: 8, previous: 9 },
  ]

  const repartitionSecteurs = [
    { secteur: "Étages", value: 30 },
    { secteur: "Cuisine", value: 25 },
    { secteur: "Salle", value: 15 },
    { secteur: "Plonge", value: 12 },
    { secteur: "Réception", value: 8 },
  ]

  const topClients = [
    { client: "Novotel", missions: 18 },
    { client: "Ibis", missions: 15 },
    { client: "Sofitel", missions: 10 },
    { client: "Campanile", missions: 8 },
    { client: "Kyriad", missions: 6 },
  ]

  return (
    <MainLayout>
      <div className="p-4 space-y-6">
        {/* section semaine en cours */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              Semaine {semaineCourante}
            </h2>
            <Badge variant="outline" className="text-xs px-2 py-1 border-gray-300">
              {positionSemaine}ème position de l'année
            </Badge>
          </div>

          {/* cards statuts */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="relative border-l-4" style={{ borderColor: stat.color }}>
                <CardContent className="p-4 flex flex-col justify-between h-full">
                  <div className="text-sm font-medium">{stat.label}</div>
                  <div className="text-xl font-bold text-right">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* comparatif N-1 par secteur */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-800">
                Missions validées par secteur - comparatif N-1
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {compareSecteurs.map((s) => {
                const delta = s.current - s.previous
                const positif = delta >= 0
                return (
                  <div
                    key={s.secteur}
                    className="flex justify-between items-center border-b py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            secteursList.find((sec) => sec.nom === s.secteur)?.couleur ??
                            "#999",
                        }}
                      ></span>
                      <span className="text-sm">{s.secteur}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span>{s.current}</span>
                      <span className={positif ? "text-green-600" : "text-red-600"}>
                        {positif ? "▲" : "▼"} {Math.abs(delta)}
                      </span>
                      <span className="text-gray-500 text-xs">(N-1: {s.previous})</span>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* répartition camembert */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-800">
                Répartition des missions validées par secteur
              </CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={repartitionSecteurs}
                    dataKey="value"
                    nameKey="secteur"
                    outerRadius={80}
                    label={({ secteur }) => secteur}
                  >
                    {repartitionSecteurs.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          secteursList.find((sec) => sec.nom === entry.secteur)?.couleur ?? "#999"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* top 5 clients */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-800">
                Top 5 clients (missions validées)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {topClients.map((client) => (
                  <li key={client.client} className="flex justify-between items-center">
                    <span>{client.client}</span>
                    <span className="font-bold">{client.missions}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* temps de traitement */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
                Temps de traitement moyen
                <Clock className="w-4 h-4 text-gray-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-center">{tempsTraitement}</CardContent>
          </Card>
        </section>
      </div>
    </MainLayout>
  )
}
