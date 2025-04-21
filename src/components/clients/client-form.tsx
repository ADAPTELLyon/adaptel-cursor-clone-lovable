import * as z from "zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { Utensils, Sofa, ShowerHead, Building, Star } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  actif: z.boolean().default(true),
})

type ClientFormProps = {
  initialData?: z.infer<typeof formSchema>
  onSubmit: (data: z.infer<typeof formSchema>) => void
  onCancel: () => void
}

const secteurs = [
  { value: "cuisine", label: "Cuisine", icon: Utensils },
  { value: "salle", label: "Salle", icon: Sofa },
  { value: "plonge", label: "Plonge", icon: ShowerHead },
  { value: "reception", label: "Réception", icon: Building },
  { value: "etages", label: "Étages", icon: Star },
]

export function ClientForm({ initialData, onSubmit, onCancel }: ClientFormProps) {
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
      actif: true,
    },
  })

  useEffect(() => {
    form.reset(
      initialData || {
        nom: "",
        secteurs: [],
        services: [],
        groupe: "",
        adresse: "",
        code_postal: "",
        ville: "",
        telephone: "",
        actif: true,
      }
    )
  }, [JSON.stringify(initialData)])

  const { data: services = [] } = useQuery({
    queryKey: ["parametrages", "service"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parametrages")
        .select("valeur")
        .eq("categorie", "service")
        .order("valeur")

      if (error) {
        console.error("Erreur chargement services:", error)
        return []
      }

      return data.map((item) => item.valeur).filter((v): v is string => !!v && v.trim() !== "")
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

      if (error) {
        console.error("Erreur chargement groupes:", error)
        return []
      }

      return data.map((item) => item.valeur).filter((v): v is string => !!v && v.trim() !== "")
    },
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 p-3 max-h-[calc(100vh-200px)] overflow-y-auto"
      >
        <FormField control={form.control} name="nom" render={({ field }) => (
          <FormItem>
            <FormLabel>Nom du client</FormLabel>
            <FormControl><Input placeholder="Nom du client" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="secteurs" render={({ field }) => (
          <FormItem>
            <FormLabel>Secteurs</FormLabel>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {secteurs.map((secteur) => {
                const Icon = secteur.icon
                return (
                  <div key={secteur.value} className="flex items-center space-x-3">
                    <Checkbox
                      checked={field.value?.includes(secteur.value)}
                      onCheckedChange={(checked) => {
                        const updatedValue = checked
                          ? [...(field.value || []), secteur.value]
                          : (field.value || []).filter((value) => value !== secteur.value)
                        field.onChange(updatedValue)
                      }}
                    />
                    <div className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" />
                      <span>{secteur.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="services" render={({ field }) => (
          <FormItem>
            <FormLabel>Services</FormLabel>
            <MultiSelect
              options={services}
              selected={field.value || []}
              onChange={field.onChange}
              placeholder="Sélectionner un ou plusieurs services"
            />
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="groupe" render={({ field }) => (
          <FormItem>
            <FormLabel>Groupe</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner un groupe" /></SelectTrigger></FormControl>
              <SelectContent>
                {groupes.map((groupe) => (
                  <SelectItem key={groupe} value={groupe}>{groupe}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="adresse" render={({ field }) => (
          <FormItem>
            <FormLabel>Adresse</FormLabel>
            <FormControl><Input placeholder="Adresse" {...field} /></FormControl>
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="code_postal" render={({ field }) => (
            <FormItem>
              <FormLabel>Code postal</FormLabel>
              <FormControl><Input placeholder="Code postal" {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="ville" render={({ field }) => (
            <FormItem>
              <FormLabel>Ville</FormLabel>
              <FormControl><Input placeholder="Ville" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="telephone" render={({ field }) => (
          <FormItem>
            <FormLabel>Téléphone</FormLabel>
            <FormControl><Input placeholder="Téléphone" {...field} /></FormControl>
          </FormItem>
        )} />

        <FormField control={form.control} name="actif" render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between">
            <FormLabel>Client actif</FormLabel>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )} />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>
    </Form>
  )
}
