// src/lib/secteurs.ts
import { Bed, ChefHat, GlassWater, Droplet, Bell } from "lucide-react"

export const secteursList = [
  {
    label: "Étages",
    value: "Étages",
    icon: Bed,              // composant <Bed />
    emoji: "🛏️",            // emoji 🛏️
  },
  {
    label: "Cuisine",
    value: "Cuisine",
    icon: ChefHat,
    emoji: "👨‍🍳",
  },
  {
    label: "Salle",
    value: "Salle",
    icon: GlassWater,
    emoji: "🍽️",
  },
  {
    label: "Plonge",
    value: "Plonge",
    icon: Droplet,
    emoji: "🫧", 
  },
  {
    label: "Réception",
    value: "Réception",
    icon: Bell,
    emoji: "🛎️",
  },
]
