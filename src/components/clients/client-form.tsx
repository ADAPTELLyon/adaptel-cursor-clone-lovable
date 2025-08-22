import * as z from "zod"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MultiSelect } from "@/components/ui/multi-select"

export const formSchema = z.object({
  nom: z.string().min(2, { message: "Le nom doit contenir au moins 2 caractères" }),
  secteurs: z.array(z.string()).min(1, { message: "Sélectionnez au moins un secteur" }),
  services: z.array(z.string()).optional(),
  groupe: z.string().optional(),
  adresse: z.string().optional(),
  code_postal: z.string().optional(),
  ville: z.string().optional(),
  telephone: z.string().optional(),
  commentaire: z.string().optional(),
  actif: z.boolean().default(true),
})

const secteurs = [
  { value: "etages", label: "Étages", icon: "🛏" },
  { value: "cuisine", label: "Cuisine", icon: "👨‍🍳" },
  { value: "salle", label: "Salle", icon: "🍴" },
  { value: "plonge", label: "Plonge", icon: "🍷" },
  { value: "reception", label: "Réception", icon: "🛎" },
]

type ClientFormProps = {
  initialData?: z.infer<typeof formSchema>
  onSubmit: (data: z.infer<typeof formSchema>) => void
  onCancel: () => void
  onSecteursChange?: (secteurs: string[]) => void
  onServicesChange?: (services: string[]) => void
}

export function ClientForm({
  initialData,
  onSubmit,
  onCancel,
  onSecteursChange,
  onServicesChange,
}: ClientFormProps) {
  const isCreate = !initialData

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nom: "",
      secteurs: [],
      services: [],
      groupe: "",
      adresse: "",
      code_postal: "",
      ville: "",
      telephone: "",
      commentaire: "",
      actif: true,
    },
  })

  useEffect(() => {
    if (initialData) {
      form.reset({
        nom: initialData.nom || "",
        secteurs: initialData.secteurs || [],
        services: initialData.services || [],
        groupe: initialData.groupe || "",
        adresse: initialData.adresse || "",
        code_postal: initialData.code_postal || "",
        ville: initialData.ville || "",
        telephone: initialData.telephone || "",
        commentaire: initialData.commentaire || "",
        actif: initialData.actif ?? true,
      })
    } else {
      form.reset({
        nom: "",
        secteurs: [],
        services: [],
        groupe: "",
        adresse: "",
        code_postal: "",
        ville: "",
        telephone: "",
        commentaire: "",
        actif: true,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialData)])

  const { data: services = [] } = useQuery({
    queryKey: ["parametrages", "service"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parametrages")
        .select("valeur")
        .eq("categorie", "service")
        .order("valeur")
      return error ? [] : (data || []).map((i) => i.valeur).filter((v) => !!v)
    },
  })

  const { data: groupes = [] } = useQuery({
    queryKey: ["parametrages", "groupe"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parametrages")
        .select("valeur")
        .eq("categorie", "groupe")
        .order("valeur")
      return error ? [] : (data || []).map((i) => i.valeur).filter((v) => !!v)
    },
  })

  // ————————————————
  // Détection de doublon (création uniquement) sur le NOM client
  // ————————————————
  const [dupCount, setDupCount] = useState(0)
  const [checkingDup, setCheckingDup] = useState(false)
  const debounceRef = useRef<number | null>(null)

  const nomValue = form.watch("nom")
  const normalizedNom = useMemo(() => (nomValue || "").trim(), [nomValue])

  useEffect(() => {
    if (!isCreate) {
      setDupCount(0)
      return
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current)

    if (!normalizedNom) {
      setDupCount(0)
      return
    }

    debounceRef.current = window.setTimeout(async () => {
      setCheckingDup(true)
      try {
        // correspondance insensible à la casse, exacte (via ILIKE)
        const { data, error } = await supabase
          .from("clients")
          .select("id, nom")
          .ilike("nom", normalizedNom) // exact string mais case-insensitive
          .limit(5)

        if (error) {
          setDupCount(0)
        } else {
          setDupCount((data || []).length)
        }
      } finally {
        setCheckingDup(false)
      }
    }, 250) as unknown as number

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [isCreate, normalizedNom])

  return (
    <Form {...form}>
      <form
        id="client-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 px-2 overflow-x-hidden scrollbar-none"
      >
        <h3 className="text-lg font-semibold mb-2">🏢 Informations générales</h3>
        <FormField
          control={form.control}
          name="nom"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom du client</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
              {isCreate && normalizedNom && dupCount > 0 && (
                <div className="mt-2 text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-2 py-1">
                  ⚠️ {dupCount === 1
                    ? "Un client avec ce nom existe déjà."
                    : `${dupCount} clients avec ce nom existent déjà.`}
                  {" "}Vous pouvez continuer si c’est volontaire.
                </div>
              )}
              {isCreate && checkingDup && normalizedNom && (
                <div className="mt-2 text-xs text-muted-foreground">Vérification des doublons…</div>
              )}
            </FormItem>
          )}
        />

        <h3 className="text-lg font-semibold mb-2">🏷 Secteurs</h3>
        <FormField
          control={form.control}
          name="secteurs"
          render={({ field }) => (
            <FormItem>
              <div className="flex gap-2 flex-wrap">
                {secteurs.map((secteur) => (
                  <Button
                    key={secteur.value}
                    type="button"
                    variant={field.value.includes(secteur.value) ? "default" : "outline"}
                    onClick={() => {
                      const newValue = field.value.includes(secteur.value)
                        ? field.value.filter((v: string) => v !== secteur.value)
                        : [...field.value, secteur.value]
                      field.onChange(newValue)
                      onSecteursChange?.(newValue)
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

        <h3 className="text-lg font-semibold mb-2">🛎 Services & Groupe</h3>
        <FormField control={form.control} name="services" render={({ field }) => (
          <FormItem>
            <FormLabel>Services</FormLabel>
            <MultiSelect
              options={services}
              selected={field.value || []}
              onChange={(values) => {
                field.onChange(values)
                onServicesChange?.(values)
              }}
              placeholder="Sélectionner un ou plusieurs services"
            />
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="groupe" render={({ field }) => (
          <FormItem>
            <FormLabel>Groupe</FormLabel>
            {groupes.length > 0 && (
              <Select
                value={field.value || ""}
                onValueChange={(val) => field.onChange(val)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un groupe" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {groupes.map((groupe) => (
                    <SelectItem key={groupe} value={groupe}>
                      {groupe}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FormMessage />
          </FormItem>
        )} />

        <h3 className="text-lg font-semibold mb-2">📍 Adresse</h3>
        <div className="grid grid-cols-3 gap-4">
          <FormField control={form.control} name="adresse" render={({ field }) => (
            <FormItem className="col-span-3">
              <FormLabel>Adresse</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="code_postal" render={({ field }) => (
            <FormItem>
              <FormLabel>Code postal</FormLabel>
              <FormControl><Input {...field} inputMode="numeric" maxLength={5} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="ville" render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>Ville</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <h3 className="text-lg font-semibold mb-2">📞 Téléphone</h3>
        <FormField control={form.control} name="telephone" render={({ field }) => (
          <FormItem>
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
        )} />

        <h3 className="text-lg font-semibold mb-2">📝 Commentaire</h3>
        <FormField control={form.control} name="commentaire" render={({ field }) => (
          <FormItem>
            <FormControl>
              <textarea
                {...field}
                placeholder="Ajouter un commentaire sur le client"
                className="w-full rounded border p-2 text-sm resize-none h-24"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <h3 className="text-lg font-semibold mb-2">⚙️ Actif</h3>
        <FormField control={form.control} name="actif" render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-4">
            <FormLabel className="text-base">Client actif</FormLabel>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>
    </Form>
  )
}
