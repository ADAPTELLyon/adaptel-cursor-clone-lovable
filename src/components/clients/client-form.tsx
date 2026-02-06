import * as z from "zod"
import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MultiSelect } from "@/components/ui/multi-select"
import { Badge } from "@/components/ui/badge"
import { secteursList } from "@/lib/secteurs"

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

type ClientFormProps = {
  initialData?: z.infer<typeof formSchema>
  onSave: (data: z.infer<typeof formSchema>) => Promise<boolean>
  onDirtyChange: (dirty: boolean) => void
  registerSave: (fn: () => Promise<boolean>) => void
  onSecteursChange?: (secteurs: string[]) => void
  onServicesChange?: (services: string[]) => void
}

const normalize = (str: string) =>
  (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

function getSecteurMeta(value: string) {
  const found = secteursList.find((s) => normalize(s.value) === normalize(value) || normalize(s.label) === normalize(value))
  return {
    label: found?.label ?? value,
    Icon: (found?.icon as any) || null,
  }
}

export function ClientForm({
  initialData,
  onSave,
  onDirtyChange,
  registerSave,
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
    mode: "onChange",
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
  }, [JSON.stringify(initialData)])

  useEffect(() => {
    onDirtyChange(form.formState.isDirty)
  }, [form.formState.isDirty, onDirtyChange])

  const savingRef = useRef(false)
  useEffect(() => {
    registerSave(async () => {
      if (savingRef.current) return false
      savingRef.current = true

      try {
        const valid = await form.trigger()
        if (!valid) return false

        const values = form.getValues()
        const ok = await onSave(values)
        if (!ok) return false

        form.reset(values)
        return true
      } finally {
        savingRef.current = false
      }
    })
  }, [registerSave, form, onSave])

  const { data: servicesOptions = [] } = useQuery({
    queryKey: ["parametrages", "service"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parametrages")
        .select("valeur")
        .eq("categorie", "service")
        .order("valeur")
      return error ? [] : (data || []).map((i: any) => i.valeur).filter((v: any) => !!v)
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
      return error ? [] : (data || []).map((i: any) => i.valeur).filter((v: any) => !!v)
    },
  })

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
        const { data, error } = await supabase
          .from("clients")
          .select("id, nom")
          .ilike("nom", normalizedNom)
          .limit(5)

        if (error) setDupCount(0)
        else setDupCount((data || []).length)
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
      <div className="space-y-6 py-4">
        {/* SECTION 1 — IDENTITÉ */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-2 h-5 bg-[#840404] rounded-sm" />
              <div className="text-sm font-semibold text-gray-800">Identité</div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Nom */}
            <FormField
              control={form.control}
              name="nom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Nom du client</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="h-10 border-gray-300 focus:border-[#840404] focus:ring-[#840404]"
                      placeholder="Entrez le nom du client"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                  {isCreate && normalizedNom && dupCount > 0 && (
                    <div className="mt-2 text-xs rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center">⚠️</div>
                      <span>
                        {dupCount === 1 ? "Un client avec ce nom existe déjà." : `${dupCount} clients avec ce nom existent déjà.`}{" "}
                        Vous pouvez continuer si c'est volontaire.
                      </span>
                    </div>
                  )}
                  {isCreate && checkingDup && normalizedNom && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                      Vérification des doublons...
                    </div>
                  )}
                </FormItem>
              )}
            />

            {/* Secteurs */}
            <FormField
              control={form.control}
              name="secteurs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Secteurs</FormLabel>
                  <div className="flex flex-wrap gap-2.5">
                    {["etages", "cuisine", "salle", "plonge", "reception"].map((value) => {
                      const labelMap: Record<string, string> = {
                        etages: "Étages",
                        cuisine: "Cuisine",
                        salle: "Salle",
                        plonge: "Plonge",
                        reception: "Réception",
                      }
                      const meta = getSecteurMeta(labelMap[value] ?? value)
                      const Icon = meta.Icon
                      const selected = field.value.includes(value)

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            const newValue = selected
                              ? field.value.filter((v: string) => v !== value)
                              : [...field.value, value]
                            field.onChange(newValue)
                            onSecteursChange?.(newValue)
                          }}
                          className={[
                            // ✅ largeur fixe identique pour les 5 (calée sur Réception)
                            "h-10 w-[160px] px-4 rounded-md border text-sm font-medium inline-flex items-center justify-center gap-2.5 transition-all duration-200",
                            selected
                              ? "bg-[#840404] text-white border-[#840404] shadow-sm"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400",
                          ].join(" ")}
                        >
                          {Icon ? <Icon className="h-4 w-4" /> : null}
                          <span className="truncate">{meta.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* Services + Groupe */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <FormField
                control={form.control}
                name="services"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Services</FormLabel>
                    <MultiSelect
                      options={servicesOptions}
                      selected={field.value || []}
                      onChange={(values) => {
                        field.onChange(values)
                        onServicesChange?.(values)
                      }}
                      placeholder="Sélectionner un ou plusieurs services"
                      className="border-gray-300 focus:border-[#840404] focus:ring-[#840404]"
                    />

                    {(field.value || []).length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {(field.value || []).map((s) => (
                          <Badge
                            key={s}
                            variant="outline"
                            className="rounded-md bg-gray-50 text-gray-700 border-gray-300 px-3 py-1.5 text-xs font-medium"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-gray-500 italic px-1">Aucun service sélectionné</div>
                    )}

                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="groupe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Groupe</FormLabel>
                    {groupes.length > 0 ? (
                      <Select value={field.value || ""} onValueChange={(val) => field.onChange(val)}>
                        <FormControl>
                          <SelectTrigger className="h-10 border-gray-300 focus:border-[#840404] focus:ring-[#840404]">
                            <SelectValue placeholder="Sélectionner un groupe" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {groupes.map((groupe: string) => (
                            <SelectItem key={groupe} value={groupe}>
                              {groupe}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-10 rounded-md border border-gray-200 bg-gray-50 px-3 flex items-center text-sm text-gray-500">
                        Aucun groupe disponible
                      </div>
                    )}
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2 — COORDONNÉES */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-2 h-5 bg-[#840404] rounded-sm" />
              <div className="text-sm font-semibold text-gray-800">Coordonnées</div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <FormField
              control={form.control}
              name="adresse"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Adresse</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="h-10 border-gray-300 focus:border-[#840404] focus:ring-[#840404]"
                      placeholder="Entrez l'adresse"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 sm:col-span-4">
                <FormField
                  control={form.control}
                  name="code_postal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Code postal</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="numeric"
                          maxLength={5}
                          className="h-10 border-gray-300 focus:border-[#840404] focus:ring-[#840404]"
                          placeholder="75000"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-12 sm:col-span-8">
                <FormField
                  control={form.control}
                  name="ville"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">Ville</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="h-10 border-gray-300 focus:border-[#840404] focus:ring-[#840404]"
                          placeholder="Entrez la ville"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="telephone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Téléphone</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      inputMode="numeric"
                      maxLength={14}
                      placeholder="06 00 00 00 00"
                      className="h-10 border-gray-300 focus:border-[#840404] focus:ring-[#840404]"
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, "").slice(0, 10)
                        const formatted = cleaned.replace(/(\d{2})(?=\d)/g, "$1 ").trim()
                        field.onChange(formatted)
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* SECTION 3 — NOTES & STATUT */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-2 h-5 bg-[#840404] rounded-sm" />
              <div className="text-sm font-semibold text-gray-800">Notes & statut</div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <FormField
              control={form.control}
              name="commentaire"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Commentaire</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      placeholder="Ajouter un commentaire sur le client"
                      className="w-full rounded-md border border-gray-300 p-3 text-sm resize-none h-32 bg-white focus:border-[#840404] focus:ring-[#840404] focus:outline-none"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="actif"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-gray-200 p-5 bg-white">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-900">Client actif</div>
                    <div className="text-xs text-gray-500">Si inactif ne sera plus visible dans l'application.</div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-[#840404]"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </div>
      </div>
    </Form>
  )
}
