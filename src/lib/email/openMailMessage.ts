// src/lib/email/openMailMessage.ts

type OpenMailMessageParams = {
    to: string | string[]
    cc?: string | string[]
    bcc?: string | string[]
    subject?: string
    body?: string
  }
  
  /**
   * Ouvre un nouveau message via le handler mail Windows (idéalement Outlook Desktop).
   * -> Remplit "À" (obligatoire), et optionnellement cc/bcc/subject/body.
   *
   * Note : en web, on ne peut pas piloter Outlook Desktop comme une macro Excel.
   * Le standard est mailto:, qui ouvre Outlook si configuré comme app mail par défaut.
   */
  export function openMailMessage({ to, cc, bcc, subject, body }: OpenMailMessageParams) {
    const toStr = normalizeRecipients(to)
    if (!toStr) return
  
    const params = new URLSearchParams()
  
    const ccStr = normalizeRecipients(cc)
    const bccStr = normalizeRecipients(bcc)
  
    if (ccStr) params.set("cc", ccStr)
    if (bccStr) params.set("bcc", bccStr)
    if (subject) params.set("subject", subject)
    if (body) params.set("body", body)
  
    const qs = params.toString()
    const url = `mailto:${encodeURIComponent(toStr)}${qs ? `?${qs}` : ""}`
  
    // Déclenche le handler mail du poste (Outlook si défini par défaut).
    window.location.href = url
  }
  
  function normalizeRecipients(input?: string | string[]) {
    if (!input) return ""
    const arr = Array.isArray(input) ? input : [input]
    const cleaned = arr
      .map((x) => (x || "").trim())
      .filter(Boolean)
    return cleaned.join(";") // Outlook accepte ; (et souvent , aussi)
  }
  