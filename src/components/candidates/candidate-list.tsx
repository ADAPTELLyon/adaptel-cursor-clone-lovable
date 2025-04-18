
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

type Candidate = {
  id: string
  nom: string
  prenom: string
  secteurs: string[]
  actif: boolean
}

type CandidateListProps = {
  candidates: Candidate[]
  onEdit: (id: string) => void
  onToggleActive: (id: string, active: boolean) => void
}

export function CandidateList({ candidates, onEdit, onToggleActive }: CandidateListProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Secteurs</TableHead>
          <TableHead>Actif</TableHead>
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidates.map((candidate) => (
          <TableRow key={candidate.id}>
            <TableCell className="font-medium">
              {candidate.nom} {candidate.prenom}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {candidate.secteurs.map((secteur) => (
                  <Badge key={secteur} variant="outline">
                    {secteurIcons[secteur]} {secteur}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>
              <Switch
                checked={candidate.actif}
                onCheckedChange={(checked) => onToggleActive(candidate.id, checked)}
              />
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(candidate.id)}
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
