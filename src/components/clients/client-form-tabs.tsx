
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
      <div className="overflow-x-auto pb-2">
        <TabsList className="w-full min-w-max">
          <TabsTrigger value="informations" className="min-w-[120px]">Informations</TabsTrigger>
          <TabsTrigger value="contacts" className="min-w-[120px]">Contacts</TabsTrigger>
          <TabsTrigger value="missions" className="min-w-[120px]">Infos missions</TabsTrigger>
          <TabsTrigger value="priorites" className="min-w-[120px]">Priorités/Interdictions</TabsTrigger>
          <TabsTrigger value="historique" className="min-w-[120px]">Historique</TabsTrigger>
          <TabsTrigger value="statistiques" className="min-w-[120px]">Statistiques</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="informations" className="max-h-[calc(100vh-200px)] overflow-y-auto">
        <ClientForm
          initialData={initialData}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </TabsContent>
      <TabsContent value="contacts" className="py-4">
        <div className="text-center text-muted-foreground">
          Le contenu de cet onglet sera implémenté prochainement.
        </div>
      </TabsContent>
      <TabsContent value="missions" className="py-4">
        <div className="text-center text-muted-foreground">
          Le contenu de cet onglet sera implémenté prochainement.
        </div>
      </TabsContent>
      <TabsContent value="priorites" className="py-4">
        <div className="text-center text-muted-foreground">
          Le contenu de cet onglet sera implémenté prochainement.
        </div>
      </TabsContent>
      <TabsContent value="historique" className="py-4">
        <div className="text-center text-muted-foreground">
          Le contenu de cet onglet sera implémenté prochainement.
        </div>
      </TabsContent>
      <TabsContent value="statistiques" className="py-4">
        <div className="text-center text-muted-foreground">
          Le contenu de cet onglet sera implémenté prochainement.
        </div>
      </TabsContent>
    </Tabs>
  )
}
