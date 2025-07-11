import * as z from "zod"
import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClientForm, formSchema } from "./client-form"
import { ClientContactsTab } from "./ClientContactsTab"
import { ClientPostesTypesTab } from "./ClientPostesTypesTab"
import { ClientSuiviTab } from "./ClientSuiviTab"
import { ClientIncidentsTab } from "./client-incident"
import type { Client } from "@/types/types-front"
import { useToast } from "@/hooks/use-toast"

type ClientFormTabsProps = {
  initialData?: z.infer<typeof formSchema> & { id?: string }
  onSubmit: (data: z.infer<typeof formSchema>) => void
  onCancel: () => void
  onClose: () => void
}

export function ClientFormTabs({
  initialData,
  onSubmit,
  onCancel,
  onClose,
}: ClientFormTabsProps) {
  const [activeTab, setActiveTab] = useState("infos")
  const [secteurs, setSecteurs] = useState<string[]>([])
  const [services, setServices] = useState<string[]>([])
  const { toast } = useToast()

  useEffect(() => {
    if (initialData) {
      setSecteurs(initialData.secteurs || [])
      setServices(initialData.services || [])
    }
  }, [initialData])

  // Vérifie si la fiche client est déjà enregistrée (présence d'id)
  const isSaved = !!initialData?.id

  // Intercepte le changement d'onglet
  function handleTabChange(newTab: string) {
    if (!isSaved && newTab !== "infos") {
      toast({
        title: "Enregistrement requis",
        description: "Merci d'enregistrer la fiche client avant de changer d’onglet.",
        variant: "destructive",
      })
      return
    }
    setActiveTab(newTab)
  }

  // Soumission formulaire déclenche le onSubmit parent
  function handleSubmitForm(data: z.infer<typeof formSchema>) {
    onSubmit(data)
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
            onSubmit={handleSubmitForm}
            onCancel={onCancel}
            onSecteursChange={setSecteurs}
            onServicesChange={setServices}
          />

          {/* Boutons Enregistrer / Annuler / Fermer */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Annuler
            </button>
            <button
              onClick={() => {
                // Le vrai submit est dans ClientForm (via onSubmit)
                // Ici on déclenche l'enregistrement via un ref ou event personnalisé
                // Mais si tu n'as pas mis ce mécanisme, tu peux remplacer ce bouton par le submit natif du formulaire
                // Pour simplifier, on suppose que l'utilisateur clique sur le bouton Enregistrer dans ClientForm
                toast({
                  title: "Veuillez utiliser le bouton Enregistrer dans le formulaire.",
                  variant: "destructive",
                })
              }}
              className="px-4 py-2 bg-[#840404] text-white rounded hover:bg-[#750303]"
            >
              Enregistrer
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-gray-100"
            >
              Fermer
            </button>
          </div>
        </TabsContent>

        <TabsContent
          value="contacts"
          className="flex-1 overflow-y-auto px-2 text-sm text-muted-foreground"
        >
          {isSaved ? (
            <ClientContactsTab
              clientId={initialData!.id}
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
          {(isSaved || secteurs.length > 0) ? (
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

        <TabsContent
          value="interdits"
          className="flex-1 overflow-y-auto px-2 text-sm text-muted-foreground"
        >
          {isSaved ? (
            <ClientSuiviTab
              clientId={initialData!.id}
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
          {isSaved ? (
            <ClientIncidentsTab clientId={initialData!.id} />
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
