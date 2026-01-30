import type { VercelRequest, VercelResponse } from "@vercel/node"
import nodemailer from "nodemailer"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { to, subject, html } = req.body || {}

    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Champs manquants (to, subject, html)" })
    }

    // ✅ CONFIG GMAIL TEST (comme tu veux, en dur pour avancer)
    const gmailUser = "contact.adaptel@gmail.com"
    const gmailAppPassword = "bzux scic kfqt vugl"

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    })

    const info = await transporter.sendMail({
      // Pour le test : expéditeur réel = gmailUser (sinon Gmail peut réécrire/forcer)
      from: `"ADAPTEL Lyon" <${gmailUser}>`,
      to,
      subject,
      html,
    })

    return res.status(200).json({
      success: true,
      message: `Email envoyé à ${to}`,
      messageId: info.messageId,
    })
  } catch (error: any) {
    console.error("❌ Erreur envoi email:", error)
    return res.status(500).json({
      error: "Erreur lors de l'envoi",
      details: error?.message || String(error),
    })
  }
}
