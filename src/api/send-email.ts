import type { VercelRequest, VercelResponse } from "@vercel/node"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { to, subject, html } = req.body || {}

    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Missing fields" })
    }

    // MODE TEST - aucun envoi réel
    console.log("📧 TEST Email prêt à envoyer :", {
      to,
      subject,
      htmlLength: html.length
    })

    return res.status(200).json({
      success: true,
      message: `Email prêt pour ${to}`,
      note: "Mode test - Configurez Gmail pour les vrais envois"
    })

  } catch (e: any) {
    console.error("❌ Erreur API:", e)
    return res.status(500).json({ error: "Erreur serveur" })
  }
}