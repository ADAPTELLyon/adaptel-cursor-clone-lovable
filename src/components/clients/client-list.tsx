
import { useState } from "react"
import { Edit } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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
  secteurs: string[]
  groupe?: string
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
          <TableHead>Groupe</TableHead>
          <TableHead>Actif</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.id}>
            <TableCell className="font-medium">
              {client.nom}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {client.secteurs.map((secteur) => (
                  <Badge key={secteur} variant="outline">
                    {secteurIcons[secteur]} {secteur}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>{client.groupe || "-"}</TableCell>
            <TableCell>
              <Switch
                checked={client.actif}
                onCheckedChange={(checked) => onToggleActive(client.id, checked)}
              />
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
