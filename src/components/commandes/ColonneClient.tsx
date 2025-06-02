import { Pencil } from "lucide-react"
import { secteursList } from "@/lib/secteurs"

export default function ColonnePlanning({ clientNom, secteur, service, semaineTexte }: {
  clientNom: string
  secteur: string
  service?: string
  semaineTexte: string
}) {
  const secteurInfo = secteursList.find((s) => s.value === secteur)

  return (
    <div className="p-4 border-r space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-semibold">{clientNom}</span>
        <div className="h-6 w-6 rounded-full bg-[#840404] flex items-center justify-center cursor-pointer">
          <Pencil className="h-3 w-3 text-white" />
        </div>
      </div>
      <div className="flex items-start gap-2 flex-wrap text-sm">
        {secteurInfo && (
          <div className="text-[13px] px-2 py-1 rounded bg-gray-100 text-gray-800 flex items-center gap-1">
            <secteurInfo.icon className="h-3 w-3" /> {secteurInfo.label}
          </div>
        )}
        {service && (
          <div className="text-[13px] px-2 py-1 rounded bg-gray-100 text-gray-800 italic">
            {service}
          </div>
        )}
      </div>
      <div className="text-[13px] text-gray-500">{semaineTexte}</div>
    </div>
  )
}
