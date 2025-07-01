export const statutColors = {
  "Validé": {
    bg: "#a9d08e",
    text: "#000000",
  },
  "En recherche": {
    bg: "#fdba74",
    text: "white",
  },
  "Non pourvue": {
    bg: "#ef5350",
    text: "white",
  },
  "Absence": {
    bg: "#f87171", // rouge clair
    text: "white",
  },
  "Annule Int": {
    bg: "#fef3c7", // amber-100
    text: "#1f2937",
  },
  "Annule Client": {
    bg: "#fef3c7", // amber-100
    text: "#1f2937",
  },
  "Annule ADA": {
    bg: "#d4d4d8", // zinc-300
    text: "#1f2937",
  },
  "Vide": {
    bg: "#e5e7eb",
    text: "#6b7280",
  },
}

export const statutBorders: Record<string, string> = {
  "Validé": "#166534",         // green-800
  "En recherche": "#b45309",   // orange-700, mieux distingué du rouge
  "Non pourvue": "#991b1b",    // red-800
  "Absence": "#991b1b",        // red-800
  "Annule Int": "#991b1b",     // red-800
  "Annule Client": "#991b1b",  // red-800
  "Annule ADA": "#991b1b",     // red-800
  "Vide": "#d1d5db",           // gray-300
  "Dispo": "#1e40af",          // blue-700
  "Non Dispo": "#1f2937",      // gray-800
  "Non Renseigné": "#d1d5db",  // gray-300
  "Planifié": "#166534",       // green-800
}

export const indicateurColors = {
  // Commandes (planning client)
  "Demandées": "#8ea9db",
  "Validées": "#a9d08e",
  "En recherche": "#fdba74",
  "Non pourvue": "#ef5350",

  // Planning (planning candidat)
  "Non renseigné": "#e5e7eb", // gris clair
  "Dispo": "#8ea9db",         // bleu
  "Non Dispo": "#4b5563",     // gris foncé
  "Planifié": "#a9d08e",      // vert
}

export const secteursColors = {
  "Étages": { bg: "#d8b4fe" },     // violet doux pastel
  "Cuisine": { bg: "#bfdbfe" },    // bleu clair pastel
  "Salle":   { bg: "#fcd5b5" },    // orange beige pastel
  "Plonge":  { bg: "#e5e7eb" },    // gris clair
  "Réception": { bg: "#fef9c3" },  // jaune pâle pastel
}

export const disponibiliteColors = {
  "Dispo": {
    bg: "#8ea9db",
    text: "#000000",
  },
  "Non Dispo": {
    bg: "#4b5563",
    text: "white",
  },
  "Non Renseigné": {
    bg: "#e5e7eb",
    text: "transparent",
  },
}
