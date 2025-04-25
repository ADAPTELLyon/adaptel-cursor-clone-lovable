import { Utensils, Sofa, ShowerHead, Building, Star } from "lucide-react"

export const secteursList = [
  { value: "Étages", label: "Étages", icon: Star },
  { value: "Cuisine", label: "Cuisine", icon: Utensils },
  { value: "Salle", label: "Salle", icon: Sofa },
  { value: "Plonge", label: "Plonge", icon: ShowerHead },
  { value: "Réception", label: "Réception", icon: Building },
 
]

export const secteurLabels = secteursList.map((s) => s.label)
