import { Edit } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const secteurIcons: Record<string, string> = {
  etages: "🛏",
  cuisine: "👨‍🍳",
  salle: "🍴",
  plonge: "🍷",
  reception: "🛎",
}

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
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Secteurs</TableHead>
          <TableHead>Services</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="w-[80px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.id}>
            <TableCell className="font-medium">{client.nom}</TableCell>

            <TableCell>
              <div className="flex flex-wrap gap-1">
                {Array.isArray(client.secteurs) && client.secteurs.length > 0 ? (
                  client.secteurs.map((secteur) => (
                    <Badge key={secteur} variant="outline">
                      {secteurIcons[secteur.trim()] || "🏷"} {secteur.trim()}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Aucun secteur</span>
                )}
              </div>
            </TableCell>

            <TableCell>
              <div className="flex flex-wrap gap-1">
                {Array.isArray(client.services) && client.services.length > 0 ? (
                  client.services.map((srv) => (
                    <Badge key={srv} variant="secondary">{srv}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Aucun</span>
                )}
              </div>
            </TableCell>

            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleActive(client.id, !client.actif)}
              >
                {client.actif ? (
                  <Badge className="bg-green-100 text-green-800">Actif</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">Inactif</Badge>
                )}
              </Button>
            </TableCell>

            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(client.id)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
