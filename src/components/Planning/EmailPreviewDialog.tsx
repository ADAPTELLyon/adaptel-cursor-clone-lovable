import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Loader2, Send, X, Eye } from "lucide-react"

type EmailPreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTo: string
  initialSubject: string
  initialHtml: string
  candidatNom: string
  onSent?: () => void
}

export default function EmailPreviewDialog({
  open,
  onOpenChange,
  initialTo,
  initialSubject,
  initialHtml,
  candidatNom,
  onSent,
}: EmailPreviewDialogProps) {
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [customMessage, setCustomMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // HTML avec message personnalisé
  const finalHtml = customMessage.trim() 
    ? initialHtml.replace(
        '<div class="greeting">',
        `<div class="greeting">Bonjour,</div>
        <div class="custom-message">${customMessage}</div>`
      )
    : initialHtml

  useEffect(() => {
    if (!open) return
    setTo(initialTo || "")
    setSubject(initialSubject || "")
    setCustomMessage("")
    setError(null)
    setSuccess(false)
    setSending(false)
  }, [open, initialTo, initialSubject])

  const canSend = to.trim() && subject.trim()

  const handleClose = () => onOpenChange(false)

  const handleSend = async () => {
    setError(null)
    setSuccess(false)

    if (!canSend) {
      setError("Veuillez remplir tous les champs.")
      return
    }

    setSending(true)
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          html: finalHtml,
        }),
      })

      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi")
      }

      setSuccess(true)
      onSent?.()
      setTimeout(() => onOpenChange(false), 1500)
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'envoi")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[1100px] max-w-[1100px] h-[820px] max-h-[820px] p-0 overflow-hidden bg-white">
        <div className="p-6 h-full flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#8a0000] flex items-center justify-center">
                <Eye className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Prévisualisation et envoi
                </DialogTitle>
                <div className="text-sm text-gray-600 mt-1">
                  Destinataire : <span className="font-semibold">{candidatNom}</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <Separator className="my-4" />

          <div className="flex-1 grid grid-cols-[400px_1fr] gap-6 overflow-hidden">
            {/* Colonne gauche - Configuration */}
            <div className="space-y-6 overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destinataire
                </label>
                <Input
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="email@exemple.com"
                  className="border-gray-300 focus:ring-[#8a0000] h-10"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Pour tester, mettez votre propre email
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Objet
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="border-gray-300 focus:ring-[#8a0000] h-10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message personnalisé (optionnel)
                </label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={6}
                  placeholder="Ex: Pensez à apporter votre tablier..."
                  className="border-gray-300 focus:ring-[#8a0000] resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Ce message apparaîtra après le "Bonjour"
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    ✅ Email envoyé avec succès
                  </p>
                </div>
              )}
            </div>

            {/* Colonne droite - Prévisualisation */}
            <div className="border border-gray-200 rounded-lg overflow-hidden flex flex-col">
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Aperçu du mail
                </h3>
              </div>
              <div className="flex-1 overflow-auto">
                <div 
                  className="p-4"
                  dangerouslySetInnerHTML={{ __html: finalHtml }}
                />
              </div>
            </div>
          </div>

          {/* Boutons */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <div className="text-sm text-gray-600">
              Vérifiez l'aperçu avant d'envoyer
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={sending}
                className="h-10 px-5"
              >
                <X className="h-4 w-4 mr-2" />
                Annuler
              </Button>
              <Button
                onClick={handleSend}
                disabled={!canSend || sending}
                className="h-10 px-5 bg-[#8a0000] hover:bg-[#7a0000]"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}