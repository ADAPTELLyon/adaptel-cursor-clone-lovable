import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { statutColors, indicateurColors } from "@/lib/colors";
import { BarChart2, ThumbsUp, AlertCircle, TrendingUp, Bed, ChefHat, GlassWater, Droplet, Bell } from "lucide-react";

// données de test
const fakeData = [
  {
    semaine: 25,
    jours: [10, 15, 8, 12, 14, 7, 5],
    secteurs: [22, 16, 14, 8, 12],
    statuts: [65, 20, 10, 5],
    total: 100,
    totalN1: 95,
    ecart: 5
  },
  {
    semaine: 26,
    jours: [8, 12, 7, 11, 10, 6, 4],
    secteurs: [18, 15, 12, 5, 9],
    statuts: [55, 25, 15, 5],
    total: 80,
    totalN1: 85,
    ecart: -5
  }
];

const secteursIcons = [Bed, ChefHat, GlassWater, Droplet, Bell];

export default function WeeklyReporting() {
  const [annee, setAnnee] = useState(2025);

  const bestWeek = fakeData.reduce((max, week) => week.total > max.total ? week : max, fakeData[0]);
  const bestSectorIdx = bestWeek.secteurs.indexOf(Math.max(...bestWeek.secteurs));
  const bestSector = ["Étages","Cuisine","Salle","Plonge","Réception"][bestSectorIdx];

  return (
    <div className="p-6 space-y-6">

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="flex justify-between items-center p-4 border-l-4 border-[#840404] shadow-sm">
          <div>
            <p className="text-xs text-gray-500">Meilleure semaine</p>
            <p className="text-2xl font-bold">{bestWeek.semaine}</p>
          </div>
          <BarChart2 className="w-6 h-6 text-[#840404]" />
        </Card>
        <Card className="flex justify-between items-center p-4 border-l-4 border-[#840404] shadow-sm">
          <div>
            <p className="text-xs text-gray-500">Meilleur secteur</p>
            <p className="text-xl font-bold">{bestSector}</p>
          </div>
          <ThumbsUp className="w-6 h-6 text-[#840404]" />
        </Card>
        <Card className="flex justify-between items-center p-4 border-l-4 border-[#ef5350] shadow-sm">
          <div>
            <p className="text-xs text-gray-500">Non pourvue</p>
            <p className="text-2xl font-bold text-[#ef5350]">{bestWeek.statuts[3]}%</p>
          </div>
          <AlertCircle className="w-6 h-6 text-[#ef5350]" />
        </Card>
        <Card className="flex justify-between items-center p-4 border-l-4 border-[#a9d08e] shadow-sm">
          <div>
            <p className="text-xs text-gray-500">Évolution N-1</p>
            <p className={`text-2xl font-bold ${bestWeek.ecart >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {bestWeek.ecart >= 0 ? "+" : ""}{bestWeek.ecart}%
            </p>
          </div>
          <TrendingUp className={`w-6 h-6 ${bestWeek.ecart >= 0 ? 'text-green-600' : 'text-red-600'}`} />
        </Card>
      </div>

      {/* Sélecteur année */}
      <div className="w-40 mt-4">
        <Select value={annee.toString()} onValueChange={(v) => setAnnee(Number(v))}>
          <SelectTrigger>
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2024">2024</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tableau */}
      <Card className="overflow-x-auto shadow-sm border mt-6">
        <table className="min-w-full text-xs bg-gray-50 border-separate border-spacing-0">
          <thead className="bg-gray-200 text-center">
            <tr>
              <th className="border-r-4 border-white p-2">Semaine</th>
              {/* jours */}
              {["Lun.","Mar.","Mer.","Jeu.","Ven.","Sam.","Dim."].map((day) => (
                <th key={day} className="border-r-2 border-white p-2 w-[60px]">{day}</th>
              ))}
              {/* secteurs icônes */}
              {secteursIcons.map((Icon, i) => (
                <th key={i} className="border-r-2 border-white p-2 w-[80px]">
                  <Icon className="w-4 h-4 mx-auto" />
                </th>
              ))}
              {/* statuts */}
              {["Demandées","Validées","En recherche","Non pourvue"].map((status) => (
                <th key={status} className="border-r-2 border-white p-2 w-[100px]">
                  {status}
                </th>
              ))}
              {/* totaux */}
              <th className="p-2 w-[120px]">Total</th>
              <th className="p-2 w-[120px]">Total N-1</th>
              <th className="p-2 w-[80px]">Écart</th>
            </tr>
          </thead>
          <tbody>
            {fakeData.map((week) => (
              <tr
                key={week.semaine}
                className="text-center border-b-4 border-white"
              >
                {/* semaine */}
                <td className="font-bold bg-gray-200 border-r-4 border-white w-[70px]">
                  {week.semaine}
                </td>

                {/* jours */}
                {week.jours.map((n, i) => (
                  <td key={i} className="p-1 w-[60px]">
                    <span className={`block rounded p-1 ${
                      n === Math.max(...week.jours)
                        ? `bg-[${statutColors["Validé"].bg}] text-[${statutColors["Validé"].text}] font-bold`
                        : "bg-gray-100"
                    }`}>
                      {n}
                    </span>
                  </td>
                ))}

                {/* secteurs */}
                {week.secteurs.map((n, i) => (
                  <td key={i} className="p-1 w-[80px]">
                    <span className={`block rounded p-1 ${
                      n === Math.max(...week.secteurs)
                        ? `bg-[${statutColors["Validé"].bg}] text-[${statutColors["Validé"].text}] font-bold`
                        : "bg-gray-100"
                    }`}>
                      {n}
                    </span>
                  </td>
                ))}

                {/* statuts */}
                {week.statuts.map((n, i) => {
                  const label = ["Demandées","Validées","En recherche","Non pourvue"][i];
                  const color = indicateurColors[label] ?? "#e5e7eb";
                  return (
                    <td key={i} className="p-1 w-[100px]">
                      <span
                        className="block rounded p-1 text-xs font-bold"
                        style={{
                          backgroundColor: color,
                          color: "#000",
                        }}
                      >
                        {n}
                      </span>
                    </td>
                  )
                })}

                {/* totaux */}
                <td className="font-bold bg-gray-100 w-[120px] border-l-4 border-white">{week.total}</td>
                <td className="font-bold bg-gray-100 w-[120px]">{week.totalN1}</td>
                <td
                  className={`font-bold w-[80px] ${
                    week.ecart >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {week.ecart >= 0 ? "▲" : "▼"} {week.ecart}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
