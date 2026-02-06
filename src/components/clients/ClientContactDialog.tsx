import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MultiSelect } from "@/components/ui/multi-select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export interface ContactFormState {
  nom: string
  prénom: string
  fonction: string
  email: string
  telephone: string
  actif: boolean
  services: string[]
  secteurs: string[]
}

interface ClientContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  form: ContactFormState
  setForm: React.Dispatch<React.SetStateAction<ContactFormState>>
  secteurOptions: string[]
  serviceOptions: string[]
  onSave: () => Promise<void>
  onDelete?: () => Promise<void> | void
  isEditing: boolean
}

const normalizePhone = (val: string) => {
  const cleaned = (val || "").replace(/\D/g, "").slice(0, 10)
  return cleaned.replace(/(\d{2})(?=\d)/g, "$1 ").trim()
}

// ✅ Autoriser les popovers Radix (MultiSelect) même si le Dialog bloque les interactions outside
const isRadixPopover = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  if (!el) return false

  // PopoverContent est portaled -> wrapper Radix
  return (
    !!el.closest?.("[data-radix-popper-content-wrapper]") ||
    !!el.closest?.("[data-radix-popover-content]") ||
    !!el.closest?.("[data-radix-popover-trigger]") ||
    !!el.closest?.("[data-radix-popper-anchor]")
  )
}

export function ClientContactDialog({
  open,
  onOpenChange,
  title,
  form,
  setForm,
  secteurOptions,
  serviceOptions,
  onSave,
  onDelete,
  isEditing,
}: ClientContactDialogProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false)

  React.useEffect(() => {
    if (!open) setConfirmDeleteOpen(false)
  }, [open])

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          // ✅ Autorise fermeture via croix et via "Annuler"
          onOpenChange(v)
        }}
        modal={false}
      >
        <DialogContent
          className="sm:max-w-[720px] w-full max-h-[85vh] flex flex-col z-[999] overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          // ✅ empêche fermeture accidentelle au clic dehors, MAIS laisse passer les popovers (MultiSelect)
          onInteractOutside={(e) => {
            if (isRadixPopover(e.target)) return
            e.preventDefault()
          }}
          // ✅ ESC désactivé (et cohérent)
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-5 py-2">
              {/* Identité */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-[#840404]" />
                    <div className="text-sm font-semibold text-gray-900">Identité</div>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-nom" className="text-sm font-medium">
                        Nom *
                      </Label>
                      <Input
                        id="contact-nom"
                        value={form.nom}
                        onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contact-prenom" className="text-sm font-medium">
                        Prénom
                      </Label>
                      <Input
                        id="contact-prenom"
                        value={form.prénom}
                        onChange={(e) => setForm((p) => ({ ...p, prénom: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-fonction" className="text-sm font-medium">
                      Fonction
                    </Label>
                    <Input
                      id="contact-fonction"
                      value={form.fonction}
                      onChange={(e) => setForm((p) => ({ ...p, fonction: e.target.value }))}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              {/* Coordonnées */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-[#840404]" />
                    <div className="text-sm font-semibold text-gray-900">Coordonnées</div>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* ✅ Email + large, téléphone + petit */}
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 sm:col-span-8 space-y-2">
                      <Label htmlFor="contact-email" className="text-sm font-medium">
                        Email
                      </Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                        className="h-9"
                      />
                    </div>

                    <div className="col-span-12 sm:col-span-4 space-y-2">
                      <Label htmlFor="contact-telephone" className="text-sm font-medium">
                        Téléphone
                      </Label>
                      <Input
                        id="contact-telephone"
                        value={form.telephone}
                        onChange={(e) => setForm((p) => ({ ...p, telephone: normalizePhone(e.target.value) }))}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Affectations */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-[#840404]" />
                    <div className="text-sm font-semibold text-gray-900">Affectations</div>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Secteurs associés</Label>
                    <MultiSelect
                      options={secteurOptions || []}
                      selected={form.secteurs}
                      onChange={(values) => setForm((p) => ({ ...p, secteurs: values }))}
                      placeholder={secteurOptions?.length ? "Sélectionner un ou plusieurs secteurs" : "Aucun secteur disponible"}
                    />
                    <div className="min-h-[34px] mt-2 flex flex-wrap gap-1.5">
                      {form.secteurs.map((s) => (
                        <Badge
                          key={`edit-sec-${s}`}
                          variant="outline"
                          className="rounded-md bg-blue-50 text-blue-700 border-blue-200 text-xs px-2.5 py-1"
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Services associés</Label>
                    <MultiSelect
                      options={serviceOptions || []}
                      selected={form.services}
                      onChange={(values) => setForm((p) => ({ ...p, services: values }))}
                      placeholder={serviceOptions?.length ? "Sélectionner un ou plusieurs services" : "Aucun service disponible"}
                    />
                    <div className="min-h-[34px] mt-2 flex flex-wrap gap-1.5">
                      {form.services.map((s) => (
                        <Badge
                          key={`edit-srv-${s}`}
                          variant="outline"
                          className="rounded-md bg-gray-100 text-gray-700 border-gray-300 text-xs px-2.5 py-1"
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Statut */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-5 rounded-full bg-[#840404]" />
                    <div className="text-sm font-semibold text-gray-900">Statut</div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 bg-white">
                    <div className="text-sm font-semibold text-gray-900">Contact actif</div>
                    <Switch
                      checked={form.actif}
                      onCheckedChange={(checked) => setForm((p) => ({ ...p, actif: checked }))}
                      className="data-[state=checked]:bg-[#840404]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between border-t pt-4">
            <div>
              {isEditing && onDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Supprimer le contact
                </Button>
              ) : null}
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="button" onClick={onSave} className="bg-[#840404] hover:bg-[#6a0303] min-w-[110px]">
                {isEditing ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setConfirmDeleteOpen(false)
                await onDelete?.()
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
