import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "@/lib/utils";

/** NorthPact accent #C8A96E */
const ACCENT_RGB: [number, number, number] = [200, 169, 110];

export type CashFlowPdfStatRow = {
  label: string;
  sublabel: string;
  value: string;
};

export type CashFlowPdfMonthRow = {
  label: string;
  ym: string;
  monthly: number;
  onceoff: number;
  total: number;
};

export type CashFlowPdfProposalRow = {
  title: string;
  clientName: string;
  acv: number;
  pct: number;
};

export function downloadCashFlowPdf(params: {
  clientFilterLabel: string;
  statsCards: CashFlowPdfStatRow[];
  monthRows: CashFlowPdfMonthRow[];
  proposalRows: CashFlowPdfProposalRow[];
}): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const generated = new Date();

  let y = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text("Cash flow report", 14, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Generated ${generated.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })}`,
    14,
    y
  );
  y += 6;
  doc.text(`View: ${params.clientFilterLabel}`, 14, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Detail", "Value"]],
    body: params.statsCards.map((c) => [c.label, c.sublabel, c.value]),
    theme: "striped",
    headStyles: { fillColor: ACCENT_RGB, textColor: 255 },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 68 },
      1: { cellWidth: 52 },
      2: { halign: "right", cellWidth: 55 },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text("Month by month (next 12 months)", 14, y);
  y += 6;

  if (params.monthRows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("No monthly data for this view.", 14, y);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Month", "Recurring", "One-off", "Total"]],
      body: params.monthRows.map((m) => {
        const monthKey = `${m.label} ${m.ym.slice(0, 4)}`;
        return [
          monthKey,
          formatCurrency(m.monthly),
          formatCurrency(m.onceoff),
          formatCurrency(m.total),
        ];
      }),
      theme: "striped",
      headStyles: { fillColor: ACCENT_RGB, textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
      },
      margin: { left: 14, right: 14 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text("By proposal (recurring ACV share)", 14, y);
  y += 6;

  if (params.proposalRows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("No proposals in this view.", 14, y);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Proposal", "Client", "Recurring ACV / yr", "Share"]],
      body: params.proposalRows.map((p) => [
        p.title,
        p.clientName,
        formatCurrency(p.acv),
        `${p.pct.toFixed(0)}%`,
      ]),
      theme: "striped",
      headStyles: { fillColor: ACCENT_RGB, textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 42 },
        2: { halign: "right" },
        3: { halign: "right", cellWidth: 22 },
      },
      margin: { left: 14, right: 14 },
    });
  }

  const stamp = generated.toISOString().slice(0, 10);
  doc.save(`Cash-flow-${stamp}.pdf`);
}
