import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CandidateForm, formSchema } from "@/components/candidates/candidate-form"
import { CandidatSuiviTab } from "./CandidatSuiviTab"
import { CandidatIncidentsTab } from "./candidate-incident" // ✅ Ajout
import type { z } from "zod"

type CandidateFormTabsProps = {
  initialData?: z.infer<typeof formSchema> & { id?: string }
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
        <TabsList className="grid grid-cols-4 w-full mb-4 border bg-muted text-muted-foreground rounded-lg">
          <TabsTrigger value="informations">📝 Informations</TabsTrigger>
          <TabsTrigger value="priorities">🚫 Suivi</TabsTrigger>
          <TabsTrigger value="history">📜 Historique</TabsTrigger>
          <TabsTrigger value="incidents">⚠️ Incidents</TabsTrigger>
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
          {initialData?.id && initialData.secteurs ? (
            <CandidatSuiviTab
              candidatId={initialData.id}
              secteurs={initialData.secteurs}
            />
          ) : (
            <p className="italic text-sm text-muted-foreground">
              Enregistrez d'abord les informations du candidat pour gérer les priorités et interdictions.
            </p>
          )}
        </TabsContent>

        <TabsContent
          value="history"
          className="flex-1 overflow-y-auto px-4 text-sm text-muted-foreground"
        >
          (Contenu à venir)
        </TabsContent>

        <TabsContent
          value="incidents"
          className="flex-1 overflow-y-auto px-4 text-sm text-muted-foreground"
        >
          {initialData?.id ? (
            <CandidatIncidentsTab candidatId={initialData.id} />
          ) : (
            <p className="italic text-sm text-muted-foreground">
              Enregistrez d'abord le candidat pour consulter ses incidents.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
