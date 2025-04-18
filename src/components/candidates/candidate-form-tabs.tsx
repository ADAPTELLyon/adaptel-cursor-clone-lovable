
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CandidateForm } from "@/components/candidates/candidate-form"
import type { z } from "zod"
import type { formSchema } from "@/components/candidates/candidate-form"

type CandidateFormTabsProps = {
  initialData?: z.infer<typeof formSchema>
  onSubmit: (data: z.infer<typeof formSchema>) => void
  onCancel: () => void
}

export function CandidateFormTabs({
  initialData,
  onSubmit,
  onCancel,
}: CandidateFormTabsProps) {
  return (
    <Tabs defaultValue="informations" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="informations">Informations</TabsTrigger>
        <TabsTrigger value="priorities">Priorités / Interdictions</TabsTrigger>
        <TabsTrigger value="history">Historique</TabsTrigger>
      </TabsList>
      <TabsContent value="informations">
        <CandidateForm
          initialData={initialData}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </TabsContent>
      <TabsContent value="priorities" className="py-4">
        <div className="text-center text-muted-foreground">
          Le contenu de cet onglet sera implémenté prochainement.
        </div>
      </TabsContent>
      <TabsContent value="history" className="py-4">
        <div className="text-center text-muted-foreground">
          Le contenu de cet onglet sera implémenté prochainement.
        </div>
      </TabsContent>
    </Tabs>
  )
}
