import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { ClientForm, formSchema } from "./client-form"
import { ClientContactsTab } from "./ClientContactsTab"
import { ClientPostesTypesTab } from "./ClientPostesTypesTab"
import { ClientSuiviTab } from "./ClientSuiviTab"
import { ClientIncidentsTab } from "./client-incident"
import type { z } from "zod"
import type { Client } from "@/types/types-front"

type ClientFormTabsProps = {
  initialData?: z.infer<typeof formSchema> & { id?: string }

  onSaveInfos: (data: z.infer<typeof formSchema>) => Promise<string | null>

  setHasUnsavedChanges: (dirty: boolean) => void

  registerSaveCurrent: (fn: () => Promise<boolean>) => void

  // remonte le nom pour le bandeau global
  onHeaderNameChange?: (name: string) => void
}

export function ClientFormTabs({
  initialData,
  onSaveInfos,
  setHasUnsavedChanges,
  registerSaveCurrent,
  onHeaderNameChange,
}: ClientFormTabsProps) {
  const [activeTab, setActiveTab] = useState("infos")

  // dirty uniquement pour infos
  const [infosDirty, setInfosDirty] = useState(false)

  // save infos fourni par ClientForm
  const [saveInfos, setSaveInfos] = useState<null | (() => Promise<boolean>)>(null)

  // id client (important après création)
  const [clientId, setClientId] = useState<string | undefined>(initialData?.id)

  const [secteurs, setSecteurs] = useState<string[]>(initialData?.secteurs || [])
  const [services, setServices] = useState<string[]>(initialData?.services || [])

  // nom client (pour bandeau)
  const [clientNom, setClientNom] = useState<string>(initialData?.nom || "")

  // popup changement onglet si dirty
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  useEffect(() => {
    setClientId(initialData?.id)
    setSecteurs(initialData?.secteurs || [])
    setServices(initialData?.services || [])
    setClientNom(initialData?.nom || "")
    setActiveTab("infos")
    setInfosDirty(false)
    setHasUnsavedChanges(false)
    onHeaderNameChange?.(initialData?.nom || "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData])

  // Footer "Enregistrer" : enregistre ce qui doit l'être
  useEffect(() => {
    registerSaveCurrent(async () => {
      if (activeTab === "infos") {
        if (!saveInfos) return false
        const ok = await saveInfos()
        if (ok) {
          setInfosDirty(false)
          setHasUnsavedChanges(false)
        }
        return ok
      }

      // Les autres onglets ont leurs actions directes (insert/update) dans leurs composants
      return true
    })
  }, [activeTab, saveInfos, registerSaveCurrent, setHasUnsavedChanges])

  const requestTabChange = (newTab: string) => {
    if (newTab === activeTab) return

    // si on quitte infos avec modifs non enregistrées => popup
    if (activeTab === "infos" && infosDirty) {
      setPendingTab(newTab)
      setShowConfirm(true)
      return
    }

    setActiveTab(newTab)
  }

  const confirmSaveAndContinue = async () => {
    if (!saveInfos) return
    const ok = await saveInfos()
    if (!ok) return

    setInfosDirty(false)
    setHasUnsavedChanges(false)

    setShowConfirm(false)
    if (pendingTab) setActiveTab(pendingTab)
    setPendingTab(null)
  }

  const confirmDiscardAndContinue = () => {
    setInfosDirty(false)
    setHasUnsavedChanges(false)

    setShowConfirm(false)
    if (pendingTab) setActiveTab(pendingTab)
    setPendingTab(null)
  }

  const effectiveClientId = clientId || initialData?.id

  return (
    <>
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifications non enregistrées</AlertDialogTitle>
            <AlertDialogDescription>
              Vous avez des modifications non enregistrées. Voulez-vous les enregistrer avant de changer d'onglet ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={confirmDiscardAndContinue}>Ignorer</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSaveAndContinue}>Enregistrer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col h-full">
        <Tabs value={activeTab} onValueChange={requestTabChange} className="flex-1 flex flex-col overflow-hidden">
          {/* Onglets avec taille identique et design moderne */}
          <TabsList className="w-full flex bg-transparent p-0 mb-6 border-b border-gray-200">
            {[
              { id: "infos", label: "Informations" },
              { id: "contacts", label: "Contacts" },
              { id: "postes", label: "Postes" },
              { id: "missions", label: "Missions" },
              { id: "interdits", label: "Suivi" },
              { id: "incidents", label: "Incidents" },
              { id: "historique", label: "Historique" },
              { id: "stats", label: "Stats" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex-1 min-w-0 rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 data-[state=active]:border-[#840404] data-[state=active]:text-[#840404] data-[state=active]:font-semibold transition-colors"
              >
                <span className="truncate">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="infos" className="h-full overflow-y-auto pr-2">
              <ClientForm
                initialData={initialData}
                onSave={async (values) => {
                  const id = await onSaveInfos(values)
                  if (id) setClientId(id)
                  return !!id
                }}
                onDirtyChange={(dirty) => {
                  setInfosDirty(dirty)
                  setHasUnsavedChanges(dirty)
                }}
                registerSave={(fn) => setSaveInfos(() => fn)}
                onSecteursChange={setSecteurs}
                onServicesChange={setServices}
              />
            </TabsContent>

            <TabsContent value="contacts" className="h-full overflow-y-auto px-2 text-sm text-muted-foreground">
              {effectiveClientId ? (
                <ClientContactsTab
                  clientId={effectiveClientId}
                  selectedServices={services}
                  secteurs={secteurs} // ✅ FIX : secteurs du client transmis au popup
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="rounded-full bg-gray-100 p-3 mb-3">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Enregistrez d'abord l'onglet Informations</p>
                  <p className="text-xs text-gray-500 mt-1">pour créer le client et accéder aux contacts.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="postes" className="h-full overflow-y-auto px-2 text-sm text-muted-foreground">
              {effectiveClientId || secteurs.length > 0 ? (
                <ClientPostesTypesTab
                  client={{
                    ...(initialData || {}),
                    id: effectiveClientId,
                    secteurs,
                    postes_bases_actifs: [],
                  } as Client}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="rounded-full bg-gray-100 p-3 mb-3">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Enregistrez d'abord l'onglet Informations</p>
                  <p className="text-xs text-gray-500 mt-1">pour créer le client et gérer les postes.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="missions" className="h-full overflow-y-auto px-4 text-sm text-muted-foreground">
              <div className="py-12 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                  <span className="text-gray-400 text-lg">🚧</span>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Fonctionnalité à venir</h3>
                <p className="text-xs text-gray-500">La gestion des missions sera bientôt disponible.</p>
              </div>
            </TabsContent>

            <TabsContent value="interdits" className="h-full overflow-y-auto px-2 text-sm text-muted-foreground">
              {effectiveClientId ? (
                <ClientSuiviTab clientId={effectiveClientId} secteurs={secteurs} services={services} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="rounded-full bg-gray-100 p-3 mb-3">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Enregistrez d'abord l'onglet Informations</p>
                  <p className="text-xs text-gray-500 mt-1">pour créer le client et accéder au suivi.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="incidents" className="h-full overflow-y-auto px-4 text-sm text-muted-foreground">
              {effectiveClientId ? (
                <ClientIncidentsTab clientId={effectiveClientId} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="rounded-full bg-gray-100 p-3 mb-3">
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Enregistrez d'abord l'onglet Informations</p>
                  <p className="text-xs text-gray-500 mt-1">pour créer le client et gérer les incidents.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="historique" className="h-full overflow-y-auto px-4 text-sm text-muted-foreground">
              <div className="py-12 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                  <span className="text-gray-400 text-lg">📊</span>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Fonctionnalité à venir</h3>
                <p className="text-xs text-gray-500">L'historique complet sera bientôt disponible.</p>
              </div>
            </TabsContent>

            <TabsContent value="stats" className="h-full overflow-y-auto px-4 text-sm text-muted-foreground">
              <div className="py-12 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                  <span className="text-gray-400 text-lg">📈</span>
                </div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Fonctionnalité à venir</h3>
                <p className="text-xs text-gray-500">Les statistiques détaillées seront bientôt disponibles.</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </>
  )
}
