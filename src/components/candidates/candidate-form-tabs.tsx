import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CandidateForm, formSchema } from "@/components/candidates/candidate-form"
import type { z } from "zod"

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
    <div className="flex flex-col h-[600px]">
      <Tabs defaultValue="informations" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid grid-cols-3 w-full mb-4 border bg-muted text-muted-foreground rounded-lg">
          <TabsTrigger value="informations">📝 Informations</TabsTrigger>
          <TabsTrigger value="priorities">🚫 Priorités</TabsTrigger>
          <TabsTrigger value="history">📜 Historique</TabsTrigger>
        </TabsList>

        <TabsContent
          value="informations"
          className="flex-1 overflow-y-auto pr-2"
        >
          <CandidateForm
            initialData={initialData}
            onSubmit={onSubmit}
            onCancel={onCancel}
          />
        </TabsContent>

        <TabsContent
          value="priorities"
          className="flex-1 overflow-y-auto px-4 text-sm text-muted-foreground"
        >
          (Contenu à venir)
        </TabsContent>

        <TabsContent
          value="history"
          className="flex-1 overflow-y-auto px-4 text-sm text-muted-foreground"
        >
          (Contenu à venir)
        </TabsContent>
      </Tabs>
    </div>
  )
}
