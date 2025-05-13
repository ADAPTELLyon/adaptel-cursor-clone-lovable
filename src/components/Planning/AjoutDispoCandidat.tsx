import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { secteursList } from "@/lib/secteurs"
import { Candidat } from "@/types/types-front"
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns"
import { fr } from "date-fns/locale"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AjoutDispoCandidatProps {
  open: boolean
  onClose: () => void
}

type StatutJour = "vide" | "dispo" | "nonDispo"

export default function AjoutDispoCandidat({ open, onClose }: AjoutDispoCandidatProps) {
  const [secteur, setSecteur] = useState("")
  const [search, setSearch] = useState("")
  const [candidat, setCandidat] = useState<Candidat | null>(null)
  const [dateCourante, setDateCourante] = useState(new Date())
  const [commentaire, setCommentaire] = useState("")
  const [statutsParDate, setStatutsParDate] = useState<Record<string, StatutJour>>({})

  const candidatsFictifs: Candidat[] = [
    { id: "1", nom: "Dupont", prenom: "Marie", actif: true, adresse: "", code_postal: "", ville: "", email: "", created_at: "", prioritaire: false },
    { id: "2", nom: "Durand", prenom: "Luc", actif: true, adresse: "", code_postal: "", ville: "", email: "", created_at: "", prioritaire: false },
    { id: "3", nom: "Martin", prenom: "Camille", actif: true, adresse: "", code_postal: "", ville: "", email: "", created_at: "", prioritaire: false },
  ]

  const joursDuMois = eachDayOfInterval({
    start: startOfMonth(dateCourante),
    end: endOfMonth(dateCourante),
  })

  const handleClickJour = (dateStr: string) => {
    const current = statutsParDate[dateStr] || "vide"
    const suivant: StatutJour = current === "vide" ? "dispo" : current === "dispo" ? "nonDispo" : "vide"
    setStatutsParDate((prev) => ({ ...prev, [dateStr]: suivant }))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Saisir disponibilités</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6">

          {/* Secteurs */}
          <div className="flex flex-wrap gap-2">
            {secteursList.map(({ label, icon: Icon }) => (
              <Button
                key={label}
                variant={secteur === label ? "default" : "outline"}
                className={secteur === label ? "bg-[#840404] text-white" : ""}
                onClick={() => {
                  setSecteur(label)
                  setCandidat(null)
                }}
              >
                <Icon className="h-4 w-4 mr-1" />
                {label}
              </Button>
            ))}
          </div>

          {/* Candidats filtrés */}
          {secteur && (
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Rechercher un candidat..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <ScrollArea className="h-32 border rounded p-2">
                <div className="flex flex-wrap gap-2">
                  {candidatsFictifs
                    .filter((c) =>
                      `${c.nom} ${c.prenom}`.toLowerCase().includes(search.toLowerCase())
                    )
                    .sort((a, b) => a.nom.localeCompare(b.nom))
                    .map((c) => (
                      <Button
                        key={c.id}
                        variant={candidat?.id === c.id ? "default" : "outline"}
                        className={candidat?.id === c.id ? "bg-[#840404] text-white" : ""}
                        onClick={() => setCandidat(c)}
                      >
                        {c.nom} {c.prenom}
                      </Button>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Calendrier */}
          {candidat && (
            <>
              <div className="flex justify-between items-center">
                <Button variant="ghost" onClick={() => setDateCourante(subMonths(dateCourante, 1))}>
                  ← Mois précédent
                </Button>
                <div className="text-lg font-semibold">
                  {format(dateCourante, "MMMM yyyy", { locale: fr })}
                </div>
                <Button variant="ghost" onClick={() => setDateCourante(addMonths(dateCourante, 1))}>
                  Mois suivant →
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((j) => (
                  <div key={j} className="font-medium">{j}</div>
                ))}
                {joursDuMois.map((date) => {
                  const d = format(date, "yyyy-MM-dd")
                  const statut = statutsParDate[d] || "vide"
                  const bg =
                    statut === "dispo"
                      ? "bg-blue-400"
                      : statut === "nonDispo"
                      ? "bg-gray-500"
                      : "bg-gray-200"
                  return (
                    <div
                      key={d}
                      className={`h-10 rounded cursor-pointer flex items-center justify-center text-white ${bg}`}
                      onClick={() => handleClickJour(d)}
                    >
                      {format(date, "d")}
                    </div>
                  )
                })}
              </div>

              {/* Commentaire */}
              <div className="flex flex-col gap-1 pt-2">
                <label className="text-sm">Commentaire</label>
                <Input
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Ajouter un commentaire pour ces jours (facultatif)"
                />
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={onClose}>Fermer</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
