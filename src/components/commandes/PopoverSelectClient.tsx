import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"

interface PopoverSelectClientProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientSelected: (id: string) => void
}

type ClientLight = { id: string; nom: string }

export default function PopoverSelectClient({
  open,
  onOpenChange,
  onClientSelected,
}: PopoverSelectClientProps) {
  const [search, setSearch] = useState("")
  const [clients, setClients] = useState<ClientLight[]>([])

  useEffect(() => {
    if (!open) return
    const fetch = async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, nom")
        .ilike("nom", `%${search}%`)
        .order("nom")
      if (error) {
        console.error(error)
        return
      }
      setClients(data || [])
    }
    fetch()
  }, [search, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rechercher un client</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Rechercher un client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="max-h-[300px] overflow-y-auto space-y-1 mt-2">
          {clients.map((client) => (
            <Button
              key={client.id}
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                onClientSelected(client.id)
              }}
            >
              {client.nom}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
