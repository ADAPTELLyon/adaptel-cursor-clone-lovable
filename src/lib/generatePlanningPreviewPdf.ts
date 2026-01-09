import jsPDF from "jspdf"
import html2canvas from "html2canvas"

type Args = {
  element: HTMLElement
  filename: string
  orientation?: "landscape" | "portrait"
}

export async function generatePlanningPreviewPdf({
  element,
  filename,
  orientation = "landscape",
}: Args) {
  // ✅ Capture fidèle de ce qui est affiché
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: Math.max(2, window.devicePixelRatio || 1), // bonne qualité
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: -window.scrollY,
  })

  const imgData = canvas.toDataURL("image/png", 1.0)

  // A4 en points
  const pdf = new jsPDF({
    orientation,
    unit: "pt",
    format: "a4",
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // Marges légères
  const margin = 18
  const maxW = pageWidth - margin * 2
  const maxH = pageHeight - margin * 2

  // On fit en largeur (comme “screenshot”)
  const imgW = canvas.width
  const imgH = canvas.height

  const ratio = maxW / imgW
  const drawW = maxW
  const drawH = imgH * ratio

  // ✅ Si ça tient sur 1 page
  if (drawH <= maxH) {
    pdf.addImage(imgData, "PNG", margin, margin, drawW, drawH, undefined, "FAST")
    pdf.save(filename)
    return
  }

  // ✅ Multi-page simple par découpe verticale (sans mise en page avancée)
  // On découpe l'image en “tranches” correspondant à la hauteur page.
  const sliceHeightPx = Math.floor(maxH / ratio) // hauteur en pixels correspondant à une page
  let y = 0
  let pageIndex = 0

  while (y < imgH) {
    const sliceCanvas = document.createElement("canvas")
    sliceCanvas.width = imgW
    sliceCanvas.height = Math.min(sliceHeightPx, imgH - y)

    const ctx = sliceCanvas.getContext("2d")
    if (!ctx) break

    ctx.drawImage(
      canvas,
      0,
      y,
      imgW,
      sliceCanvas.height,
      0,
      0,
      imgW,
      sliceCanvas.height
    )

    const sliceData = sliceCanvas.toDataURL("image/png", 1.0)

    if (pageIndex > 0) pdf.addPage()
    const sliceDrawH = sliceCanvas.height * ratio

    pdf.addImage(sliceData, "PNG", margin, margin, drawW, sliceDrawH, undefined, "FAST")

    y += sliceCanvas.height
    pageIndex += 1
  }

  pdf.save(filename)
}
