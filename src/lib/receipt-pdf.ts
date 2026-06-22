import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatNumber, prettyMethod } from "./format";
import avadaLogo from "@/assets/avada-logo.png";

export interface ReceiptPdfData {
  school: {
    name?: string | null;
    sigle?: string | null;
    approval_number?: string | null;
    address?: string | null;
    city?: string | null;
    email?: string | null;
    phone?: string | null;
    logo_url?: string | null;
  };
  receipt: { receipt_number: string };
  payment: {
    amount: number;
    currency: string;
    method: string | null;
    reference: string | null;
    paid_at: string | null;
  };
  student: { first_name: string; last_name: string; matricule?: string | null } | null;
  classe: { name?: string | null; level?: string | null } | null;
  fee: { label?: string | null; fee_type?: string | null } | null;
  date: Date;
}

async function loadImage(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;

  const [logoData, schoolLogoData] = await Promise.all([
    loadImage(avadaLogo),
    data.school.logo_url ? loadImage(data.school.logo_url) : Promise.resolve(null),
  ]);

  // Header logos
  if (logoData) {
    try { doc.addImage(logoData, "PNG", margin, 12, 22, 22); } catch { /* noop */ }
  }
  if (schoolLogoData) {
    try { doc.addImage(schoolLogoData, "PNG", pageW - margin - 22, 12, 22, 22); } catch { /* noop */ }
  }

  // Header text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("REPUBLIQUE DEMOCRATIQUE DU CONGO", pageW / 2, 16, { align: "center" });
  doc.setFontSize(11);
  doc.text((data.school.name ?? "École").toUpperCase(), pageW / 2, 22, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (data.school.sigle) doc.text(String(data.school.sigle).toUpperCase(), pageW / 2, 27, { align: "center" });
  if (data.school.approval_number) doc.text(`Numéro d'agrément : ${data.school.approval_number}`, pageW / 2, 32, { align: "center" });
  const loc = [data.school.address, data.school.city].filter(Boolean).join(", ");
  if (loc) doc.text(loc, pageW / 2, 37, { align: "center" });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("REÇU DE PAIEMENT", pageW / 2, 48, { align: "center" });
  doc.setLineWidth(0.4);
  doc.line(pageW / 2 - 35, 50, pageW / 2 + 35, 50);

  // Info block (two columns)
  const userName = data.student ? `${data.student.first_name} ${data.student.last_name}`.toUpperCase() : "—";
  const rows: Array<[string, string, string, string]> = [
    ["Id. Utilisateur", data.receipt.receipt_number, "Classe", data.classe?.name ?? "—"],
    ["Nom utilisateur", userName, "Section", data.classe?.level ?? "—"],
    ["Fonction", "ÉLÈVE", "Option", data.fee?.fee_type ?? "—"],
    ["Matricule", data.student?.matricule ?? "—", "Devise", data.payment.currency],
  ];
  doc.setFontSize(9);
  let y = 58;
  rows.forEach(([la, va, lb, vb]) => {
    doc.setFont("helvetica", "normal");
    doc.text(`${la}`, margin, y);
    doc.text(`: ${va}`, margin + 32, y);
    doc.text(`${lb}`, pageW / 2 + 4, y);
    doc.text(`: ${vb}`, pageW / 2 + 4 + 24, y);
    y += 5;
  });
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);

  // Table
  autoTable(doc, {
    startY: y + 4,
    head: [["No", "ÉLÈVE", "MOTIF", "REÇU", "DATE", "MONTANT", "RÉFÉRENCE", "MODE"]],
    body: [[
      "01",
      userName,
      data.fee?.label ?? "—",
      data.receipt.receipt_number,
      data.date.toLocaleDateString("fr-FR"),
      `${formatNumber(Number(data.payment.amount))},00`,
      data.payment.reference ?? "—",
      prettyMethod(data.payment.method).toUpperCase(),
    ]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
    theme: "grid",
    margin: { left: margin, right: margin },
  });

  // Total
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `Total Montant (${data.payment.currency}) : ${formatNumber(Number(data.payment.amount))},00`,
    pageW - margin,
    finalY + 8,
    { align: "right" },
  );

  // Signatory
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(data.school.name ?? "Caisse", pageW - margin - 30, finalY + 35, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Caissière", pageW - margin - 30, finalY + 40, { align: "center" });

  // Footer band
  const footerY = 277;
  doc.setFillColor(21, 199, 155);
  doc.rect(0, footerY, pageW, 20, "F");
  doc.setTextColor(255);
  doc.setFontSize(8);
  let fy = footerY + 6;
  const footerLines = [
    `${(data.school.name ?? "École").split(" ")[0]} : ${loc || "—"}`,
    data.school.phone ? `Téléphone : ${data.school.phone}` : null,
    data.school.email ? `Mail : ${data.school.email}` : null,
  ].filter(Boolean) as string[];
  footerLines.forEach((line) => {
    doc.text(line, margin, fy);
    fy += 4;
  });
  if (logoData) {
    try { doc.addImage(logoData, "PNG", margin, footerY + 4, 12, 12); } catch { /* noop */ }
  }

  return doc.output("blob");
}

export async function downloadReceiptPdf(data: ReceiptPdfData) {
  const blob = await generateReceiptPdf(data);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Recu-${data.receipt.receipt_number}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}