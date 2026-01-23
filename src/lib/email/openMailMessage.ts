type OpenMailMessageArgs = {
    to: string
    subject?: string
    body?: string
  }
  
  /**
   * Ouvre le client mail par défaut (Outlook desktop si défini par Windows).
   * IMPORTANT: mailto ne permet pas d’ajouter des pièces jointes.
   */
  export function openMailMessage({ to, subject, body }: OpenMailMessageArgs) {
    if (!to) return
  
    const params: string[] = []
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
    if (body) params.push(`body=${encodeURIComponent(body)}`)
  
    const qs = params.length ? `?${params.join("&")}` : ""
    const href = `mailto:${encodeURIComponent(to)}${qs}`
  
    // window.open peut être bloqué par popup-blocker; location marche mieux
    window.location.href = href
  }
  