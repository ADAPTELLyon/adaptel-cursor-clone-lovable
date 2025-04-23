export type Commande = {
    id: string
    date: string
    client_id: string
    statut: string
    secteur: string
    service: string
    heure_debut_matin?: string
    heure_fin_matin?: string
    heure_debut_soir?: string
    heure_fin_soir?: string
    heure_debut_nuit?: string
    heure_fin_nuit?: string
    clients?: { nom: string }
    candidats?: { nom: string; prenom: string }
  }
  
  export type JourPlanning = {
    date: string
    secteur: string
    service?: string
    commandes: Commande[]
  }
  