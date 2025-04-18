
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
      <TabsList className="grid w-full grid-cols-6">
        <TabsTrigger value="informations">Informations</TabsTrigger>
        <TabsTrigger value="contacts">Contacts</TabsTrigger>
        <TabsTrigger value="missions">Infos missions</TabsTrigger>
        <TabsTrigger value="priorites">Priorités/Interdictions</TabsTrigger>
        <TabsTrigger value="historique">Historique</TabsTrigger>
        <TabsTrigger value="statistiques">Statistiques</TabsTrigger>
      </TabsList>
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
