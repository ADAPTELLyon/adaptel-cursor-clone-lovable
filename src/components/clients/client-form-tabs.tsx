import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClientForm } from "./client-form"
import { ClientContactsTab } from "./ClientContactsTab"
import { z } from "zod"
import { formSchema } from "./client-form"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { MultiSelect } from "@/components/ui/multi-select"

type ClientFormTabsProps = {
  initialData?: z.infer<typeof formSchema> & { id?: string }
  onSubmit: (data: z.infer<typeof formSchema>) => void
  onCancel: () => void
  selectedServices: string[]
}

function ClientFormTabs({
  initialData,
  onSubmit,
  onCancel,
  selectedServices,
}: ClientFormTabsProps) {
  const [activeTab, setActiveTab] = useState("infos")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="infos">Informations</TabsTrigger>
        <TabsTrigger value="contacts">Contacts</TabsTrigger>
        <TabsTrigger value="missions">Missions</TabsTrigger>
        <TabsTrigger value="interdits">Interdits</TabsTrigger>
        <TabsTrigger value="historique">Historique</TabsTrigger>
        <TabsTrigger value="stats">Stats</TabsTrigger>
      </TabsList>

      <TabsContent value="infos">
        <ClientForm
          initialData={initialData}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </TabsContent>

      <TabsContent value="contacts">
        {initialData?.id ? (
          <ClientContactsTab
            clientId={initialData.id}
            selectedServices={initialData.services ?? []}
          />
        ) : (
          <p className="text-sm italic text-muted-foreground">
            Enregistrez les informations du client avant d’ajouter des contacts.
          </p>
        )}
      </TabsContent>

      <TabsContent value="missions">
        <p className="text-sm italic text-muted-foreground">À venir</p>
      </TabsContent>

      <TabsContent value="interdits">
        <p className="text-sm italic text-muted-foreground">À venir</p>
      </TabsContent>

      <TabsContent value="historique">
        <p className="text-sm italic text-muted-foreground">À venir</p>
      </TabsContent>

      <TabsContent value="stats">
        <p className="text-sm italic text-muted-foreground">À venir</p>
      </TabsContent>
    </Tabs>
  )
}

export { ClientFormTabs }
