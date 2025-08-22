import * as z from "zod"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { supabase } from "@/lib/supabase"
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

export const formSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  prenom: z.string().min(1, "Le prénom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z
    .string()
    .regex(/^(\d{2} ){4}\d{2}$/, "Téléphone invalide")
    .optional()
    .or(z.literal("")),
  vehicule: z.boolean().default(false),
  actif: z.boolean().default(true),
  prioritaire: z.boolean().default(false),
  commentaire: z.string().optional(),
  secteurs: z.array(z.string()),
  adresse: z.string().optional(),
  code_postal: z.string().optional(),
  ville: z.string().optional(),
  date_naissance: z.string().optional(),
})

export const secteurOptions = [
  { value: "etages", label: "Etages", icon: "🛏" },
  { value: "cuisine", label: "Cuisine", icon: "👨‍🍳" },
  { value: "salle", label: "Salle", icon: "🍴" },
  { value: "plonge", label: "Plonge", icon: "🍷" },
  { value: "reception", label: "Réception", icon: "🛎" },
]

type CandidateFormProps = {
  initialData?: z.infer<typeof formSchema>
  onSubmit: (data: z.infer<typeof formSchema>) => void
  onCancel: () => void
}

export function CandidateForm({
  initialData,
  onSubmit,
  onCancel,
}: CandidateFormProps) {
  const isCreate = !initialData

  const formattedInitialData = initialData
    ? {
        nom: initialData.nom || "",
        prenom: initialData.prenom || "",
        email: initialData.email || "",
        telephone: initialData.telephone || "",
        vehicule: initialData.vehicule ?? false,
        actif: initialData.actif ?? true,
        prioritaire: initialData.prioritaire ?? false,
        commentaire: initialData.commentaire || "",
        secteurs: initialData.secteurs || [],
        adresse: initialData.adresse || "",
        code_postal: initialData.code_postal || "",
        ville: initialData.ville || "",
        date_naissance: initialData.date_naissance
          ? formatDateString(initialData.date_naissance)
          : "",
      }
    : {
        nom: "",
        prenom: "",
        email: "",
        telephone: "",
        vehicule: false,
        actif: true,
        prioritaire: false,
        commentaire: "",
        secteurs: [],
        adresse: "",
        code_postal: "",
        ville: "",
        date_naissance: "",
      }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: formattedInitialData,
  })

  // —————————————————————
  // Détection de doublons (seulement en création)
  // —————————————————————
  const [duplicateCount, setDuplicateCount] = useState<number>(0)
  const [checkingDup, setCheckingDup] = useState(false)
  const debounceRef = useRef<number | null>(null)

  const nom = form.watch("nom")
  const prenom = form.watch("prenom")

  const normalized = useMemo(() => {
    const n = (nom || "").trim()
    const p = (prenom || "").trim()
    return { n, p }
  }, [nom, prenom])

  useEffect(() => {
    if (!isCreate) {
      // en édition/consultation : jamais d’alerte ni de requêtes
      setDuplicateCount(0)
      return
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current)

    if (!normalized.n || !normalized.p) {
      setDuplicateCount(0)
      return
    }

    debounceRef.current = window.setTimeout(async () => {
      setCheckingDup(true)
      try {
        const { data, error } = await supabase
          .from("candidats")
          .select("id, nom, prenom")
          .ilike("nom", normalized.n)     // égalité insensible à la casse
          .ilike("prenom", normalized.p)  // idem
          .limit(5)

        if (error) {
          setDuplicateCount(0)
        } else {
          setDuplicateCount((data || []).length)
        }
      } finally {
        setCheckingDup(false)
      }
    }, 250) as unknown as number

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [isCreate, normalized.n, normalized.p])

  // —————————————————————
  // Confirmation shadcn au submit en cas de doublon (création)
  // —————————————————————
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pendingRef = useRef<z.infer<typeof formSchema> | null>(null)

  const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
    if (isCreate && duplicateCount > 0) {
      pendingRef.current = data
      setConfirmOpen(true)
      return
    }
    onSubmit(data)
  }

  const confirmContinue = () => {
    const data = pendingRef.current
    setConfirmOpen(false)
    if (data) onSubmit(data)
    pendingRef.current = null
  }

  const confirmCancel = () => {
    setConfirmOpen(false)
    pendingRef.current = null
    // demandé : si l’utilisateur refuse, on ferme la fiche de création
    onCancel()
  }

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className="space-y-6 px-2 overflow-x-hidden scrollbar-none"
        >
          <h3 className="text-lg font-semibold mb-2">🧍 Identité</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="nom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                  {isCreate && normalized.n && normalized.p && duplicateCount > 0 && (
                    <div className="mt-2 text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-2 py-1">
                      ⚠️ {duplicateCount === 1
                        ? "Un candidat avec ce NOM + prénom existe déjà."
                        : `${duplicateCount} candidats avec ce NOM + prénom existent déjà.`}
                      {" "}Vous pouvez continuer si c’est bien un homonyme (ex. ajouter “.” pour distinguer).
                    </div>
                  )}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prenom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prénom</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                  {isCreate && checkingDup && normalized.n && normalized.p && (
                    <div className="mt-2 text-xs text-muted-foreground">Vérification des doublons…</div>
                  )}
                </FormItem>
              )}
            />
          </div>

          <h3 className="text-lg font-semibold mb-2">📞 Contact</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telephone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      maxLength={14}
                      placeholder="06 00 00 00 00"
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10)
                        const formatted = cleaned.replace(/(\d{2})(?=\d)/g, "$1 ").trim()
                        field.onChange(formatted)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <h3 className="text-lg font-semibold mb-2">🏠 Adresse</h3>
          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="adresse"
              render={({ field }) => (
                <FormItem className="col-span-3">
                  <FormLabel>Adresse</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="code_postal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code postal</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={5}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 5)
                        field.onChange(val)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ville"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Ville</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <h3 className="text-lg font-semibold mb-2">🎂 Date de naissance</h3>
          <FormField
            control={form.control}
            name="date_naissance"
            render={({ field }) => (
              <FormItem className="w-1/2">
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="jj/mm/aaaa"
                    inputMode="numeric"
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 8)
                      const formatted = raw.replace(/(\d{2})(\d{2})(\d{0,4})/, (_, d, m, y) =>
                        [d, m, y].filter(Boolean).join("/")
                      )
                      field.onChange(formatted)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <h3 className="text-lg font-semibold mb-2">📝 Commentaire</h3>
          <FormField
            control={form.control}
            name="commentaire"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    placeholder="Ajouter des remarques ou informations importantes ici"
                    className="resize-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <h3 className="text-lg font-semibold mb-2">🏷 Secteurs</h3>
          <FormField
            control={form.control}
            name="secteurs"
            render={({ field }) => (
              <FormItem>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  {secteurOptions.map((secteur) => (
                    <Button
                      key={secteur.value}
                      type="button"
                      variant={field.value.includes(secteur.value) ? "default" : "outline"}
                      onClick={() => {
                        const newValue = field.value.includes(secteur.value)
                          ? field.value.filter((v: string) => v !== secteur.value)
                          : [...field.value, secteur.value]
                        field.onChange(newValue)
                      }}
                    >
                      <span className="mr-2">{secteur.icon}</span>
                      {secteur.label}
                    </Button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <h3 className="text-lg font-semibold mb-2">⚙️ Options</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="vehicule"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <FormLabel className="text-base">Véhicule</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="actif"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <FormLabel className="text-base">Actif</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Form>

      {/* Confirmation doublon (création uniquement) */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Doublon potentiel détecté</AlertDialogTitle>
            <AlertDialogDescription>
              Un ou plusieurs candidats avec le même <strong>NOM + prénom</strong> existent déjà.
              Voulez‑vous continuer la création malgré tout ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={confirmCancel}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmContinue}>Continuer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function formatDateString(dateStr: string): string {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ""
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  } catch {
    return ""
  }
}
