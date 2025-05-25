import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClientForm, formSchema } from "./client-form"
import { ClientContactsTab } from "./ClientContactsTab"
import { ClientPostesTypesTab } from "./ClientPostesTypesTab"
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

  useEffect(() => {
    if (initialData) {
      setSecteurs(initialData.secteurs || [])
      setServices(initialData.services || [])
    }
  }, [initialData])

  return (
    <div className="flex flex-col h-[600px]">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="grid grid-cols-4 sm:grid-cols-7 w-full mb-2 border bg-muted text-muted-foreground rounded-lg">
          <TabsTrigger value="infos">📝 Informations</TabsTrigger>
          <TabsTrigger value="contacts">📇 Contacts</TabsTrigger>
          <TabsTrigger value="postes">🧩 Postes</TabsTrigger>
          <TabsTrigger value="missions">📆 Missions</TabsTrigger>
          <TabsTrigger value="interdits">🚫 Interdits</TabsTrigger>
          <TabsTrigger value="historique">📜 Historique</TabsTrigger>
          <TabsTrigger value="stats">📊 Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="infos" className="flex-1 overflow-y-auto pr-2">
          <ClientForm
            initialData={initialData}
            onSubmit={onSubmit}
            onCancel={onCancel}
            onSecteursChange={setSecteurs}
            onServicesChange={setServices}
          />
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

        <TabsContent value="missions" className="px-4 text-sm text-muted-foreground">
          <p className="italic">À venir</p>
        </TabsContent>

        <TabsContent value="interdits" className="px-4 text-sm text-muted-foreground">
          <p className="italic">À venir</p>
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
