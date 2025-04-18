import * as z from "zod"
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
import { Switch } from "@/components/ui/switch"

// Export the formSchema so it can be imported by other components
export const formSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  prenom: z.string().min(1, "Le prénom est requis"),
  email: z.string().email().optional().or(z.literal("")),
  telephone: z.string().optional(),
  vehicule: z.boolean().default(false),
  actif: z.boolean().default(true),
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
  // Format the initialData if it exists, especially the date
  const formattedInitialData = initialData
    ? {
        ...initialData,
        // Ensure date_naissance is a string in the format dd/mm/yyyy or empty string
        date_naissance: initialData.date_naissance 
          ? formatDateString(initialData.date_naissance)
          : ""
      }
    : {
        nom: "",
        prenom: "",
        email: "",
        telephone: "",
        vehicule: false,
        actif: true,
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

  // Function to format a submission before sending to the server
  const handleFormSubmit = (data: z.infer<typeof formSchema>) => {
    onSubmit(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
        <CandidatePersonalInfo form={form} />
        <CandidateContactInfo form={form} />
        <CandidateAddressInfo form={form} />
        <CandidateDateInfo form={form} />
        <CandidateSectorInfo form={form} />
        <CandidateToggleOptions form={form} />
        <CandidateFormActions onCancel={onCancel} />
      </form>
    </Form>
  )
}

// Helper function to format date string from any format to dd/mm/yyyy
function formatDateString(dateStr: string): string {
  // If it's already in the dd/mm/yyyy format, return it
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  try {
    // Try to create a date object from the string
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return "";
    }
    
    // Format as dd/mm/yyyy
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.error("Error parsing date:", error);
    return "";
  }
}

// Personal Information Component
function CandidatePersonalInfo({ form }: { form: any }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="nom"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nom</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="prenom"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Prénom</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

// Contact Information Component
function CandidateContactInfo({ form }: { form: any }) {
  return (
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
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

// Address Information Component
function CandidateAddressInfo({ form }: { form: any }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <FormField
        control={form.control}
        name="adresse"
        render={({ field }) => (
          <FormItem className="col-span-3">
            <FormLabel>Adresse</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
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
              <Input {...field} />
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
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

// Date Information Component with simplified input
function CandidateDateInfo({ form }: { form: any }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="date_naissance"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Date de naissance</FormLabel>
            <FormControl>
              <Input
                type="text"
                placeholder="jj/mm/aaaa"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

// Sector Selection Component
function CandidateSectorInfo({ form }: { form: any }) {
  return (
    <FormField
      control={form.control}
      name="secteurs"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Secteurs</FormLabel>
          <div className="flex flex-wrap gap-2">
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
  )
}

// Toggle Options Component
function CandidateToggleOptions({ form }: { form: any }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={form.control}
        name="vehicule"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Véhicule</FormLabel>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="actif"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Actif</FormLabel>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  )
}

// Form Actions Component
function CandidateFormActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex justify-end space-x-2">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
      >
        Annuler
      </Button>
      <Button type="submit">
        Enregistrer
      </Button>
    </div>
  )
}
