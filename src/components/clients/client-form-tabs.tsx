
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClientForm, formSchema } from "@/components/clients/client-form"
import type { z } from "zod"

type ClientFormTabsProps = {
  initialData?: z.infer<typeof formSchema>
  onSubmit: (data: z.infer<typeof formSchema>) => void
  onCancel: () => void
}

export function ClientFormTabs({
  initialData,
  onSubmit,
  onCancel,
}: ClientFormTabsProps) {
  return (
    <Tabs defaultValue="informations" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="informations">Informations</TabsTrigger>
        <TabsTrigger value="details">Détails supplémentaires</TabsTrigger>
        <TabsTrigger value="historique">Historique</TabsTrigger>
      </TabsList>
      <TabsContent value="informations">
        <ClientForm
          initialData={initialData}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </TabsContent>
      <TabsContent value="details" className="py-4">
        <div className="text-center text-muted-foreground">
          Le contenu de cet onglet sera implémenté prochainement.
        </div>
      </TabsContent>
      <TabsContent value="historique" className="py-4">
        <div className="text-center text-muted-foreground">
          Le contenu de cet onglet sera implémenté prochainement.
        </div>
      </TabsContent>
    </Tabs>
  )
}
