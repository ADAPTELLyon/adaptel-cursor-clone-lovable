import { Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { secteursList } from "@/lib/secteurs"

const normalize = (str: string) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

const secteursMap = secteursList.reduce((acc, s) => {
  const key = normalize(s.value)
  acc[key] = s
  return acc
}, {} as Record<string, { value: string; label: string; icon: React.ComponentType<{ className?: string }> }>)

const secteurOrder = secteursList.map((s) => normalize(s.value))

type Client = {
  id: string
  nom: string
  secteurs?: string[]
  services?: string[]
  actif: boolean
}

type ClientListProps = {
  clients: Client[]
  onEdit: (id: string) => void
  onToggleActive: (id: string, active: boolean) => void
}

export function ClientList({ clients, onEdit, onToggleActive }: ClientListProps) {
  const clientsBySecteur = clients.reduce((acc, client) => {
    const premierSecteur = client.secteurs?.[0]
    if (!premierSecteur) return acc
    const key = normalize(premierSecteur)
    if (!acc[key]) acc[key] = []
    acc[key].push(client)
    return acc
  }, {} as Record<string, Client[]>)

  for (const key in clientsBySecteur) {
    clientsBySecteur[key].sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
  }

  return (
    <div className="space-y-10">
      {secteurOrder.map((secteurKey) => {
        const clientsDuSecteur = clientsBySecteur[secteurKey] || []
        if (clientsDuSecteur.length === 0) return null

        const secteur = secteursMap[secteurKey]
        const Icon = secteur.icon

        return (
          <div key={secteurKey} className="space-y-4">
            <div className="flex items-center justify-between bg-[#840404] text-white px-4 py-2 rounded-md">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Icon className="w-5 h-5" />
                <span>{secteur.label}</span>
              </div>
              <Badge variant="secondary" className="bg-white text-[#840404]">
                {clientsDuSecteur.length} {clientsDuSecteur.length > 1 ? "clients" : "client"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {clientsDuSecteur.map((client) => (
                <Card key={client.id} className="flex flex-col justify-between h-full border border-gray-200">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">{client.nom}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Statut :</span>
                      <Badge
                        className={`ml-2 ${
                          client.actif
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {client.actif ? "Actif" : "Inactif"}
                      </Badge>
                    </div>

                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Secteurs :</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {client.secteurs && client.secteurs.length > 0 ? (
                          client.secteurs.map((secteur) => {
                            const key = normalize(secteur)
                            const s = secteursMap[key]
                            const SIcon = s?.icon
                            return (
                              <Badge key={secteur} variant="outline" className="capitalize">
                                {SIcon && <SIcon className="h-3 w-3 mr-1" />}
                                {s?.label || secteur}
                              </Badge>
                            )
                          })
                        ) : (
                          <span className="text-sm text-muted-foreground">Aucun</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Services :</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {client.services && client.services.length > 0 ? (
                          client.services.map((srv) => (
                            <Badge key={srv} variant="secondary">
                              {srv}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Aucun</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(client.id)}
                        className="gap-1"
                      >
                        <Edit className="h-4 w-4" />
                        Modifier
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
