import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { User, AlertTriangle } from "lucide-react"

export function ClientIncidentsTab({ clientId }: { clientId: string }) {
  const [incidents, setIncidents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (clientId) {
      const fetchIncidents = async () => {
        try {
          const { data, error } = await (supabase as any)
            .from("incidents")
            .select(`*, candidats (nom, prenom)`)
            .eq("client_id", clientId)
            .order("date_incident", { ascending: false })
          if (!error) setIncidents(data || [])
        } finally {
          setLoading(false)
        }
      }
      fetchIncidents()
    }
  }, [clientId])

  if (loading) return <div className="p-6 text-sm text-gray-500">Chargement...</div>

  return (
    <div className="p-6 space-y-4">
      <h3 className="text-lg font-bold text-gray-900">Historique des incidents</h3>
      <div className="grid gap-4">
        {incidents.length === 0 ? (
          <p className="text-gray-500 italic text-sm text-center py-8">Aucun incident répertorié.</p>
        ) : (
          incidents.map((incident) => (
            <Card key={incident.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between">
                  <CardTitle className="text-base text-[#840404]">{incident.type_incident}</CardTitle>
                  {incident.mise_en_interdiction && <Badge variant="destructive">Interdiction</Badge>}
                </div>
                <p className="text-sm font-medium">Candidat : {incident.candidats?.prenom} {incident.candidats?.nom}</p>
              </CardHeader>
              <CardContent className="text-sm text-gray-600">{incident.description}</CardContent>
              <CardFooter className="text-xs text-gray-400 border-t pt-2">
                Le {format(new Date(incident.date_incident), "dd/MM/yyyy", { locale: fr })}
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}