import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClientForm, formSchema } from "./client-form"
import { ClientContactsTab } from "./ClientContactsTab"
import { ClientPostesTypesTab } from "./ClientPostesTypesTab"
import { ClientSuiviTab } from "./ClientSuiviTab"
import { ClientIncidentsTab } from "./client-incident"
import { useToast } from "@/hooks/use-toast"
import type { z } from "zod"
import type { Client } from "@/types/types-front"

type ClientFormTabsProps = {
  initialData?: z.infer<typeof formSchema> & { id?: string }
  onSubmit: (data: z.infer<typeof formSchema>) => void
  onCancel: () => void
}

export function ClientFormTabs({
  initialData,
  onSubmit,
  onCancel,
}: ClientFormTabsProps) {
  const [activeTab, setActiveTab] = useState("infos")
  const [secteurs, setSecteurs] = useState<string[]>([])
  const [services, setServices] = useState<string[]>([])
  const [isSaved, setIsSaved] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (initialData) {
      setSecteurs(initialData.secteurs || [])
      setServices(initialData.services || [])
      setIsSaved(!!initialData.id) // si on a un id, le client est déjà enregistré
    } else {
      setIsSaved(false)
    }
  }, [initialData])

  const handleTabChange = (newTab: string) => {
    if (!isSaved && newTab !== "infos") {
      toast({
        title: "Enregistrement requis",
        description: "Veuillez enregistrer les informations du client avant de changer d’onglet.",
        variant: "destructive",
      })
      return
    }
    setActiveTab(newTab)
  }

  const handleSubmit = (data: z.infer<typeof formSchema>) => {
    onSubmit(data)
    setIsSaved(true)
  }

  return (
    <div className="flex flex-col h-[600px]">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid grid-cols-4 sm:grid-cols-8 w-full mb-2 border bg-muted text-muted-foreground rounded-lg">
          <TabsTrigger value="infos">📝 Informations</TabsTrigger>
          <TabsTrigger value="contacts">📇 Contacts</TabsTrigger>
          <TabsTrigger value="postes">🧩 Postes</TabsTrigger>
          <TabsTrigger value="missions">📆 Missions</TabsTrigger>
          <TabsTrigger value="interdits">🚫 Suivi</TabsTrigger>
          <TabsTrigger value="incidents">⚠️ Incidents</TabsTrigger>
          <TabsTrigger value="historique">📜 Historique</TabsTrigger>
          <TabsTrigger value="stats">📊 Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="flex-1 overflow-y-auto pr-2">
          <ClientForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={onCancel}
            onSecteursChange={setSecteurs}
            onServicesChange={setServices}
          />
          {/* BOUTONS ANNULER & ENREGISTRER UNIQUEMENT */}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
              type="button"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="client-form"
              className="px-4 py-2 rounded bg-[#840404] text-white hover:bg-[#750303]"
            >
              Enregistrer
            </button>
          </div>
        </TabsContent>

        <TabsContent
          value="contacts"
          className="flex-1 overflow-y-auto px-2 text-sm text-muted-foreground"
        >
          {initialData?.id ? (
            <ClientContactsTab
              clientId={initialData.id}
              selectedServices={services}
            />
          ) : secteurs.length > 0 ? (
            <ClientContactsTab clientId={"temp"} selectedServices={services} />
          ) : (
            <p className="text-sm italic text-muted-foreground mt-4">
              Enregistrez les informations du client avant d’ajouter des contacts.
            </p>
          )}
        </TabsContent>

        <TabsContent
          value="postes"
          className="flex-1 overflow-y-auto px-2 text-sm text-muted-foreground"
        >
          {initialData?.id || secteurs.length > 0 ? (
            <ClientPostesTypesTab
              client={{
                ...(initialData || {}),
                secteurs,
                postes_bases_actifs: [],
              } as Client}
            />
          ) : (
            <p className="text-sm italic text-muted-foreground mt-4">
              Enregistrez les informations du client avant de gérer les postes.
            </p>
          )}
        </TabsContent>

        <TabsContent
          value="missions"
          className="px-4 text-sm text-muted-foreground"
        >
          <p className="italic">À venir</p>
        </TabsContent>

        <TabsContent
          value="interdits"
          className="flex-1 overflow-y-auto px-2 text-sm text-muted-foreground"
        >
          {initialData?.id ? (
            <ClientSuiviTab
              clientId={initialData.id}
              secteurs={secteurs}
              services={services}
            />
          ) : (
            <p className="text-sm italic text-muted-foreground mt-4">
              Enregistrez les informations du client pour voir ou gérer les priorités/interdictions.
            </p>
          )}
        </TabsContent>

        <TabsContent
          value="incidents"
          className="flex-1 overflow-y-auto px-4 text-sm text-muted-foreground"
        >
          {initialData?.id ? (
            <ClientIncidentsTab clientId={initialData.id} />
          ) : (
            <p className="text-sm italic text-muted-foreground mt-4">
              Enregistrez les informations du client pour consulter les incidents.
            </p>
          )}
        </TabsContent>

        <TabsContent value="historique" className="px-4 text-sm text-muted-foreground">
          <p className="italic">À venir</p>
        </TabsContent>

        <TabsContent value="stats" className="px-4 text-sm text-muted-foreground">
          <p className="italic">À venir</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
