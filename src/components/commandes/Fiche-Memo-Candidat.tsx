import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { User2, CalendarDays, BriefcaseBusiness, Phone } from "lucide-react"
import { supabase } from "@/lib/supabase"

export function FicheMemoCandidat({
  open,
  onOpenChange,
  candidatId,
}: {
  open: boolean
  onOpenChange: (val: boolean) => void
  candidatId: string | null
}) {
  const [candidat, setCandidat] = useState<any>(null)

  useEffect(() => {
    if (!candidatId) return

    const fetchCandidat = async () => {
      const { data, error } = await supabase
        .from("candidats")
        .select("*")
        .eq("id", candidatId)
        .single()

      if (error) {
        console.error("Erreur fetch candidat :", error)
      } else {
        setCandidat(data)
      }
    }

    fetchCandidat()
  }, [candidatId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <User2 className="w-5 h-5 text-gray-500" /> Fiche mémo candidat
          </DialogTitle>
        </DialogHeader>

        {candidat ? (
          <div className="space-y-6 py-2">
            {/* Section Identité */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-2 font-semibold text-gray-800 mb-2">
                <User2 className="w-4 h-4" /> Identité
              </div>
              <p className="text-sm text-gray-700">
                {candidat.nom} {candidat.prenom}
              </p>
            </div>

            {/* Section Informations pro */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-2 font-semibold text-gray-800 mb-2">
                <BriefcaseBusiness className="w-4 h-4" /> Infos pro
              </div>
              <p className="text-sm text-gray-700">Secteurs : {candidat.secteurs?.join(", ")}</p>
              <p className="text-sm text-gray-700">Véhicule : {candidat.vehicule ? "Oui" : "Non"}</p>
              <p className="text-sm text-gray-700">Statut : {candidat.statut}</p>
            </div>

            {/* Section Contact */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-2 font-semibold text-gray-800 mb-2">
                <Phone className="w-4 h-4" /> Contact
              </div>
              <p className="text-sm text-gray-700">Tél : {candidat.telephone}</p>
              <p className="text-sm text-gray-700">Email : {candidat.email}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
