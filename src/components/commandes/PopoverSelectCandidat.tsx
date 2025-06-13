import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Candidat } from "@/types/types-front"
import { Button } from "@/components/ui/button"

interface PopoverSelectCandidatProps {
  open: boolean
  onOpenChange: (val: boolean) => void
  onCandidatSelected: (candidatId: string) => void
}

export default function PopoverSelectCandidat({
  open,
  onOpenChange,
  onCandidatSelected,
}: PopoverSelectCandidatProps) {
  const [candidats, setCandidats] = useState<Candidat[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open) return
    const fetchCandidats = async () => {
      const { data, error } = await supabase
        .from("candidats")
        .select("*")
        .eq("actif", true)
        .order("nom", { ascending: true })
      if (!error && data) setCandidats(data)
    }
    fetchCandidats()
  }, [open])

  const filtered = candidats.filter((c) =>
    `${c.nom} ${c.prenom}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choisir un candidat</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Rechercher un candidat..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
        />

        <ScrollArea className="max-h-96">
          <div className="space-y-2">
            {filtered.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                className="w-full justify-start text-left"
                onClick={() => {
                  onOpenChange(false)
                  onCandidatSelected(c.id) // C’est ça qui déclenche FicheMemoCandidat
                }}
              >
                {c.nom} {c.prenom}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
