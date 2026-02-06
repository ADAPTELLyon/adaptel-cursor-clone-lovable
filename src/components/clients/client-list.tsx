import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { secteursList } from "@/lib/secteurs"
import { statutBorders } from "@/lib/colors"

type Client = {
  id: string
  nom: string
  actif: boolean
  secteurs?: string[]
}

type Props = {
  clients: Client[]
  onEdit: (id: string) => void
  onToggleActive: (id: string, active: boolean) => void
}

const normalize = (v: string) =>
  (v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

function getPrimarySecteur(client: Client): string | null {
  const s = (client.secteurs || []).filter(Boolean)
  if (!s.length) return null
  return s[0]
}

function sortByNom(a: Client, b: Client) {
  return (a.nom || "").localeCompare(b.nom || "", "fr", { sensitivity: "base" })
}

function SectionHeader({
  Icon,
  title,
  count,
}: {
  Icon: any
  title: string
  count: number
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-[#840404]">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-5 w-5 text-white shrink-0" />
        <div className="font-bold text-white text-base sm:text-lg truncate">
          {title}
        </div>
      </div>

      <span className="inline-flex items-center px-3 py-1 text-xs font-semibold border border-white/25 bg-white/15 rounded-md text-white shrink-0">
        Clients : {count}
      </span>
    </div>
  )
}

export function ClientList({ clients, onEdit, onToggleActive }: Props) {
  const VALIDATED_GREEN = statutBorders["Validé"] || "#166534"

  // Grouping: chaque client va dans son 1er secteur uniquement (pas de doublon)
  const bySector: Record<string, Client[]> = {}
  secteursList.forEach((s) => (bySector[s.value] = []))
  const sansSecteur: Client[] = []

  clients.forEach((c) => {
    const primary = getPrimarySecteur(c)
    if (!primary) {
      sansSecteur.push(c)
      return
    }

    // on matche par label/value (Étages, Cuisine...)
    const found = secteursList.find((s) => normalize(s.value) === normalize(primary))
    if (found) bySector[found.value].push(c)
    else sansSecteur.push(c)
  })

  secteursList.forEach((s) => bySector[s.value].sort(sortByNom))
  sansSecteur.sort(sortByNom)

  const renderCards = (list: Client[]) => {
    if (!list.length) {
      return <div className="px-4 py-6 text-sm text-gray-500 italic bg-white">Aucun client</div>
    }

    return (
      <div className="p-4 bg-white">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {list.map((client) => {
            const isActive = !!client.actif

            return (
              <div
                key={client.id}
                className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-4 flex flex-col gap-3">
                  {/* Nom sur 2 lignes fixes + pastille */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div
                        className="text-[14px] font-semibold text-gray-900 leading-snug line-clamp-2"
                        style={{ minHeight: "2.6em" }}
                        title={client.nom || ""}
                      >
                        {client.nom || "Client sans nom"}
                      </div>
                    </div>

                    <div className="shrink-0 pt-1">
                      <span
                        className="inline-block rounded-full border"
                        style={{
                          width: 12,
                          height: 12,
                          backgroundColor: isActive ? VALIDATED_GREEN : "#9ca3af",
                          borderColor: isActive ? VALIDATED_GREEN : "#9ca3af",
                        }}
                        title={isActive ? "Actif" : "Inactif"}
                      />
                    </div>
                  </div>

                  {/* Switch */}
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="text-xs font-medium text-gray-600">{isActive ? "Actif" : "Inactif"}</div>
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) => onToggleActive(client.id, checked)}
                      className="data-[state=checked]:bg-[#840404]"
                    />
                  </div>

                  {/* Ouvrir (outline marque) */}
                  <Button
                    onClick={() => onEdit(client.id)}
                    variant="outline"
                    className="w-full border-[#840404] text-[#840404] hover:bg-[#840404]/10"
                  >
                    Ouvrir
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="divide-y bg-white">
      {secteursList.map((s) => (
        <div key={s.value} className="bg-white">
          <div className="border-b border-gray-200">
            <SectionHeader Icon={s.icon} title={s.label} count={bySector[s.value].length} />
          </div>
          {renderCards(bySector[s.value])}
        </div>
      ))}

      <div className="bg-white">
        <div className="border-b border-gray-200">
          <SectionHeader Icon={() => null} title={"Sans secteur"} count={sansSecteur.length} />
        </div>
        {renderCards(sansSecteur)}
      </div>
    </div>
  )
}
