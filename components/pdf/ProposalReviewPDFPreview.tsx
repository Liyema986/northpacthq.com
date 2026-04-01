"use client";

import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { getDisplayEmail } from "@/lib/utils";
import type { ProposalPDFData } from "@/lib/pdf-types";
import { Button } from "@/components/ui/button";

type Entity = {
  id: number;
  name: string;
  type: string;
  revenueRange: string;
  incomeTaxRange: string;
};

type LineItemWithPrice = {
  _id: string;
  name: string;
  fixedPrice?: number;
  hourlyRate?: number;
  pricingTiers?: Array<{ name: string; price: number; description: string }>;
};

type Section = {
  _id: string;
  name: string;
  lineItems?: LineItemWithPrice[];
};

/** Alias for shared PDF data contract from lib/pdf-types.ts */
export type ProposalDataForPDF = ProposalPDFData;

export interface ProposalReviewPDFPreviewProps {
  firmName: string;
  selectedClientData: {
    companyName?: string;
    contactName?: string;
    email?: string;
    phone?: string;
  } | null;
  packageTemplate: string;
  entities: Entity[];
  template: string;
  documentType: string;
  startMonth: string;
  startYear: string;
  financialYearEndMonth: string;
  financialYearEndYear: string;
  addProjectName: boolean;
  projectName: string;
  selectedServices: Record<string, Set<string>>;
  sections: Section[] | undefined;
  onDownloadReady?: (downloadFn: () => void) => void;
  /** When set, PDF is generated from this data (cover, logos, same design as step 6). Used on /proposals/view. */
  proposalData?: ProposalDataForPDF | null;
  /** Hide the internal Download PDF button (when parent provides its own) */
  hideDownloadButton?: boolean;
  /** Scroll the PDF viewer to this page number (1-based) */
  scrollToPage?: number;
}

function getServicePrice(item: LineItemWithPrice): number {
  if (item.fixedPrice != null && item.fixedPrice > 0) return item.fixedPrice;
  if (item.hourlyRate != null && item.hourlyRate > 0) return item.hourlyRate;
  if (item.pricingTiers && item.pricingTiers.length > 0) return item.pricingTiers[0].price;
  return 0;
}

function stripHtml(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, "").trim();
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").trim();
}

function fmtCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
  ];
}

/** Draw a diagonal gradient background on the current page */
function drawGradientBg(doc: jsPDF, primary: string, secondary: string) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const c1 = hexToRgb(primary);
  const c2 = hexToRgb(secondary);
  const steps = 60;
  const stripH = h / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const [r, g, b] = lerpColor(c1, c2, t);
    doc.setFillColor(r, g, b);
    doc.rect(0, i * stripH, w, stripH + 1, "F");
  }
}

type LoadedImage = { dataUrl: string; aspectRatio: number } | null;

async function loadImageWithDimensions(url: string): Promise<LoadedImage> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (!w || !h) { resolve(null); return; }
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL("image/png", 1.0), aspectRatio: w / h });
      } else resolve(null);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function ProposalReviewPDFPreview({
  firmName,
  selectedClientData,
  packageTemplate,
  entities,
  template,
  documentType,
  startMonth,
  startYear,
  financialYearEndMonth,
  financialYearEndYear,
  addProjectName,
  projectName,
  selectedServices,
  sections,
  onDownloadReady,
  proposalData,
  hideDownloadButton,
  scrollToPage,
}: ProposalReviewPDFPreviewProps) {
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const hasGeneratedOnce = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    return () => {
      if (pdfDataUrl && pdfDataUrl.startsWith("blob:")) URL.revokeObjectURL(pdfDataUrl);
    };
  }, [pdfDataUrl]);

  // Scroll PDF to page when scrollToPage changes — use hash navigation to avoid reload
  useEffect(() => {
    if (!scrollToPage || !pdfDataUrl || !iframeRef.current) return;
    try {
      // Try updating just the hash (no iframe reload)
      const win = iframeRef.current.contentWindow;
      if (win) {
        win.location.hash = `page=${scrollToPage}`;
      }
    } catch {
      // Cross-origin fallback — won't cause full re-gen since pdfDataUrl hasn't changed
    }
  }, [scrollToPage]);

  useEffect(() => {
    // Small debounce so we don't re-gen on every keystroke
    const timer = setTimeout(() => void generatePDF(), 300);
    return () => clearTimeout(timer);
  }, [
    selectedClientData, packageTemplate, entities, template, documentType,
    startMonth, startYear, financialYearEndMonth, financialYearEndYear,
    addProjectName, projectName, selectedServices, sections, proposalData,
  ]);

  const generatePDF = async () => {
    try {
      // Only show full loading spinner on first generation
      if (!hasGeneratedOnce.current) setIsGenerating(true);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const M = 15; // margin

      // ── Resolve data ──
      const pd = proposalData;
      const primary = pd?.brandColors?.primary || "#2563EB";
      const secondary = pd?.brandColors?.secondary || "#10B981";
      const currency = pd?.currency || "ZAR";

      let clientName: string;
      let clientEmail: string;
      let clientPhone: string;
      let refNumber: string;
      let servicesWithPrices: { name: string; price: number; description?: string; billingCategory?: string; entityLabels?: string[] }[];
      let totalNet: number;
      let allServiceNames: string[];
      let customIntroText: string | undefined;

      if (pd) {
        clientName = pd.clientName || "Client";
        clientEmail = getDisplayEmail(pd.clientEmail) || "";
        clientPhone = pd.clientPhone || "";
        refNumber = pd.proposalNumber;
        servicesWithPrices = (pd.services || []).map((s) => ({
          name: s.serviceName,
          price: typeof s.subtotal === "number" ? s.subtotal : (s.unitPrice ?? 0) * (s.quantity || 1),
          description: s.description,
          billingCategory: s.billingCategory,
          entityLabels: s.entityLabels,
        }));
        totalNet = typeof pd.total === "number" ? pd.total : servicesWithPrices.reduce((sum, s) => sum + s.price, 0);
        allServiceNames = servicesWithPrices.map((s) => s.name);
        customIntroText = pd.introText ? stripHtml(pd.introText) : undefined;
      } else {
        clientName = selectedClientData?.companyName || selectedClientData?.contactName || "Client";
        clientEmail = getDisplayEmail(selectedClientData?.email) || "";
        clientPhone = selectedClientData?.phone || "";
        refNumber = selectedClientData?.companyName
          ? `PROP-${String(selectedClientData.companyName).substring(0, 8).toUpperCase().replace(/\s/g, "")}`
          : "PROP-REVIEW";
        servicesWithPrices = [];
        totalNet = 0;
        if (sections) {
          sections.forEach((section) => {
            const ids = selectedServices[section._id];
            if (ids && ids.size > 0 && section.lineItems) {
              section.lineItems.forEach((item) => {
                if (ids.has(item._id)) {
                  const price = getServicePrice(item);
                  servicesWithPrices.push({ name: item.name, price });
                  totalNet += price;
                }
              });
            }
          });
        }
        allServiceNames = servicesWithPrices.map((s) => s.name);
      }

      // Load logos with stable dimensions
      const coverLogoSrc = pd?.coverImageUrl || pd?.firmLogo;
      const footerLogoSrc = pd?.footerImageUrl || pd?.firmLogo;
      const headerLogoSrc = pd?.firmLogo;

      let headerImg: LoadedImage = null;
      let coverImg: LoadedImage = null;
      let footerImg: LoadedImage = null;

      if (headerLogoSrc) headerImg = await loadImageWithDimensions(headerLogoSrc);
      if (coverLogoSrc) coverImg = await loadImageWithDimensions(coverLogoSrc);
      if (!coverImg) coverImg = headerImg;
      if (footerLogoSrc) footerImg = await loadImageWithDimensions(footerLogoSrc);
      if (!footerImg) footerImg = headerImg;

      // ── Helper: add logo + brand line to standard page (Risen pattern) ──
      const addBranding = (d: jsPDF): number => {
        if (!headerImg) return 18;
        try {
          const logoX = 2;
          const logoY = 2;
          const targetH = 22;
          const logoW = targetH * headerImg.aspectRatio;
          d.addImage(headerImg.dataUrl, "PNG", logoX, logoY, logoW, targetH, undefined, "FAST");
          const lineY = logoY + targetH * 0.7;
          const lineStartX = logoX + logoW - 5;
          d.setLineWidth(0.3);
          d.setDrawColor(...hexToRgb(primary));
          d.line(lineStartX, lineY, W, lineY);
          return logoY + targetH + 8;
        } catch {
          return 18;
        }
      };

      // ── Helper: standard page header ──
      const pageHeader = (d: jsPDF, title: string): number => {
        const y = addBranding(d);
        d.setFontSize(22);
        d.setTextColor(...hexToRgb(primary));
        d.setFont("helvetica", "bold");
        d.text(title, M, y + 4);
        return y + 12;
      };

      // ════════════════════════════════════════════════════════════════════
      // PAGE 1: COVER PAGE
      // ════════════════════════════════════════════════════════════════════
      drawGradientBg(doc, primary, secondary);

      // Cover logo centered at top
      if (coverImg) {
        try {
          const lh = 22;
          const lw = lh * coverImg.aspectRatio;
          doc.addImage(coverImg.dataUrl, "PNG", (W - lw) / 2, 20, lw, lh, undefined, "FAST");
        } catch { /* skip */ }
      }

      // Quote
      const quote = pd?.coverQuote || "";
      const quoteAuthor = pd?.coverQuoteAuthor || "";
      if (quote) {
        doc.setFontSize(18);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "italic");
        const quoteLines = doc.splitTextToSize(`"${quote}"`, W - 80);
        doc.text(quoteLines, W / 2, 80, { align: "center" });
        if (quoteAuthor) {
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.text(`– ${quoteAuthor}`, W / 2, 80 + quoteLines.length * 8 + 5, { align: "center" });
        }
      }

      // Proposal for [CLIENT]
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.text("Proposal for", W / 2, H * 0.5, { align: "center" });

      doc.setFontSize(36);
      doc.setFont("helvetica", "bold");
      doc.text(clientName, W / 2, H * 0.5 + 16, { align: "center" });

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      // Pill-shaped proposal number
      const pillText = `Proposal #${refNumber}`;
      const pillW = doc.getTextWidth(pillText) + 16;
      const pillX = (W - pillW) / 2;
      const pillY = H * 0.5 + 26;
      doc.setFillColor(255, 255, 255, 0.15);
      doc.roundedRect(pillX, pillY, pillW, 10, 5, 5, "F");
      doc.text(pillText, W / 2, pillY + 7, { align: "center" });

      // Contact grid at bottom
      const gridY = H - 70;
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.2);
      doc.line(M + 20, gridY, W - M - 20, gridY);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("CREATED BY", M + 20, gridY + 10);
      doc.text("CREATED FOR", W / 2 + 10, gridY + 10);

      doc.setFontSize(14);
      doc.text(pd?.advisorName || firmName, M + 20, gridY + 20);
      doc.text(clientName, W / 2 + 10, gridY + 20);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const advisorTitle = pd?.advisorTitle || "Advisor";
      doc.text(advisorTitle, M + 20, gridY + 27);
      doc.text("Client", W / 2 + 10, gridY + 27);

      if (pd?.advisorEmail) doc.text(`e: ${pd.advisorEmail}`, M + 20, gridY + 34);
      if (clientEmail) doc.text(`e: ${clientEmail}`, W / 2 + 10, gridY + 34);
      if (pd?.advisorPhone) doc.text(`m: ${pd.advisorPhone}`, M + 20, gridY + 41);
      if (clientPhone) doc.text(`m: ${clientPhone}`, W / 2 + 10, gridY + 41);

      // ════════════════════════════════════════════════════════════════════
      // PAGE 2: CONTENTS
      // ════════════════════════════════════════════════════════════════════
      doc.addPage();
      let y = pageHeader(doc, "Contents");

      const tocEntries = [
        "Introduction",
        ...(pd?.aboutUsHtml || pd?.missionStatement ? ["About " + firmName] : []),
        ...(pd?.teamMembers && pd.teamMembers.length > 0 ? ["Your Dedicated Team"] : []),
        "Investment & Fees",
        "Service Summary",
        "All The Services We Provide",
        "Next Steps",
      ];
      // Full-width contents table
      const tocRows = tocEntries.map((entry, idx) => [entry, String(idx + 3)]);
      autoTable(doc, {
        startY: y,
        head: [["SECTION", "PAGE"]],
        body: tocRows,
        theme: "striped",
        headStyles: { fillColor: hexToRgb(primary), textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 },
        bodyStyles: { fontSize: 12, cellPadding: 6, textColor: [55, 65, 81], fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: "auto" },
          1: { cellWidth: 20, halign: "center", textColor: hexToRgb(primary) },
        },
        margin: { left: M, right: M },
      });

      // ════════════════════════════════════════════════════════════════════
      // PAGE 3: INTRODUCTION
      // ════════════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(doc, "Introduction");

      const introParas = customIntroText
        ? customIntroText.split(/\n+/).filter(Boolean)
        : [
            `Hello ${clientName}!`,
            `Thank you for considering ${firmName} as your trusted financial partner. We're excited to present this proposal, which has been carefully crafted specifically for you.`,
            `This document outlines not just the services we'll provide, but also how we'll work together to drive your business forward. We believe in building long-term partnerships based on trust, transparency, and measurable results.`,
            `We look forward to embarking on this exciting journey with you.`,
          ];

      introParas.forEach((p, idx) => {
        if (idx === 0) {
          doc.setFontSize(13);
          doc.setTextColor(...hexToRgb(primary));
          doc.setFont("helvetica", "bold");
        } else {
          doc.setFontSize(11);
          doc.setTextColor(75, 85, 99);
          doc.setFont("helvetica", "normal");
        }
        const lines = doc.splitTextToSize(p, W - M * 2);
        doc.text(lines, M, y);
        y += lines.length * 6 + 5;
      });

      // ════════════════════════════════════════════════════════════════════
      // PAGE 4: ABOUT US (conditional)
      // ════════════════════════════════════════════════════════════════════
      const hasAboutUs = pd?.aboutUsHtml || pd?.missionStatement || pd?.whyChooseUsItems?.length;
      if (hasAboutUs) {
        doc.addPage();
        y = pageHeader(doc, `About ${firmName}`);

        if (pd?.aboutUsHtml) {
          doc.setFontSize(11);
          doc.setTextColor(75, 85, 99);
          doc.setFont("helvetica", "normal");
          const aboutLines = doc.splitTextToSize(stripHtml(pd.aboutUsHtml), W - M * 2);
          doc.text(aboutLines, M, y);
          y += aboutLines.length * 5.5 + 10;
        }
        if (pd?.missionStatement) {
          doc.setFontSize(16);
          doc.setTextColor(...hexToRgb(secondary));
          doc.setFont("helvetica", "bold");
          doc.text("Our Mission", M, y);
          y += 9;
          doc.setFontSize(11);
          doc.setTextColor(75, 85, 99);
          doc.setFont("helvetica", "normal");
          const mLines = doc.splitTextToSize(pd.missionStatement, W - M * 2);
          doc.text(mLines, M, y);
          y += mLines.length * 5.5 + 10;
        }
        if (pd?.whyChooseUsItems && pd.whyChooseUsItems.length > 0) {
          doc.setFontSize(16);
          doc.setTextColor(...hexToRgb(secondary));
          doc.setFont("helvetica", "bold");
          doc.text("Why Choose Us?", M, y);
          y += 9;
          doc.setFontSize(11);
          doc.setFont("helvetica", "normal");
          pd.whyChooseUsItems.forEach((item) => {
            doc.setTextColor(...hexToRgb(primary));
            doc.text("▸", M + 2, y);
            doc.setTextColor(75, 85, 99);
            const itemLines = doc.splitTextToSize(item, W - M * 2 - 12);
            doc.text(itemLines, M + 10, y);
            y += itemLines.length * 5.5 + 3;
          });
          y += 5;
        }
        if (pd?.valuesStatement) {
          doc.setFontSize(16);
          doc.setTextColor(...hexToRgb(secondary));
          doc.setFont("helvetica", "bold");
          doc.text("Our Values", M, y);
          y += 9;
          doc.setFontSize(11);
          doc.setTextColor(75, 85, 99);
          doc.setFont("helvetica", "normal");
          const vLines = doc.splitTextToSize(pd.valuesStatement, W - M * 2);
          doc.text(vLines, M, y);
        }
        if (pd?.website) {
          doc.setFontSize(11);
          doc.setTextColor(...hexToRgb(primary));
          doc.setFont("helvetica", "bold");
          doc.text(pd.website, M, H - 35);
        }
      }

      // ════════════════════════════════════════════════════════════════════
      // PAGE 5: YOUR DEDICATED TEAM (conditional)
      // ════════════════════════════════════════════════════════════════════
      const team = pd?.teamMembers ?? [];
      if (team.length > 0) {
        doc.addPage();
        y = pageHeader(doc, "Your Dedicated Team");

        const colW = (W - M * 2 - 10) / 2;
        const cardH = 65;
        team.slice(0, 4).forEach((member, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const cx = M + col * (colW + 10);
          const cy = y + row * (cardH + 10);

          // Card background
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(cx, cy, colW, cardH, 4, 4, "F");
          // Top border accent
          doc.setFillColor(...hexToRgb(primary));
          doc.rect(cx, cy, colW, 1.5, "F");

          // Initials circle
          const circleX = cx + colW / 2;
          const circleY = cy + 15;
          doc.setFillColor(...lerpColor(hexToRgb(primary), [255, 255, 255], 0.8));
          doc.circle(circleX, circleY, 10, "F");
          doc.setFontSize(14);
          doc.setTextColor(...hexToRgb(primary));
          doc.setFont("helvetica", "bold");
          const initials = member.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
          doc.text(initials, circleX, circleY + 4, { align: "center" });

          // Name
          doc.setFontSize(12);
          doc.setTextColor(...hexToRgb(primary));
          doc.text(member.name, circleX, cy + 32, { align: "center" });

          // Role
          if (member.role) {
            doc.setFontSize(9);
            doc.setTextColor(...hexToRgb(secondary));
            doc.setFont("helvetica", "normal");
            doc.text(member.role, circleX, cy + 38, { align: "center" });
          }

          // Bio
          if (member.bio) {
            doc.setFontSize(8);
            doc.setTextColor(75, 85, 99);
            const bioLines = doc.splitTextToSize(member.bio, colW - 14);
            doc.text(bioLines.slice(0, 3), cx + 7, cy + 45);
          }
        });
      }

      // ════════════════════════════════════════════════════════════════════
      // FEES PAGES
      // ════════════════════════════════════════════════════════════════════
      const monthlyServices = servicesWithPrices.filter((s) => s.billingCategory === "monthly" || (!s.billingCategory && true));
      const annualServices = servicesWithPrices.filter((s) => s.billingCategory === "yearly");
      const onceOffServices = servicesWithPrices.filter((s) => s.billingCategory === "onceoff");

      // If no billingCategory at all, put everything under "Fees"
      const hasCategoryBreakdown = annualServices.length > 0 || onceOffServices.length > 0;

      const renderFeesTable = (
        d: jsPDF,
        title: string,
        subLabel: string,
        items: typeof servicesWithPrices,
        startY: number
      ): number => {
        d.setFontSize(16);
        d.setTextColor(...hexToRgb(primary));
        d.setFont("helvetica", "bold");
        d.text(title, M, startY);
        startY += 8;

        const rows: string[][] = [];
        if (items.length > 0) {
          items.forEach((s) => {
            rows.push([s.name, fmtCurrency(s.price, currency)]);
            if (s.entityLabels && s.entityLabels.length > 0) {
              s.entityLabels.forEach((e) => {
                rows.push([`   ${e}`, ""]);
              });
            }
          });
        } else {
          rows.push(["No services", "-"]);
        }

        autoTable(d, {
          startY,
          head: [["SERVICES", `${subLabel}\n${currency}`]],
          body: rows,
          theme: "striped",
          headStyles: {
            fillColor: hexToRgb(primary),
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "left",
            fontSize: 10,
          },
          bodyStyles: { fontSize: 10, cellPadding: 4 },
          columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 45, halign: "right" } },
          margin: { left: M, right: M },
        });
        return (d as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      };

      // Fees page 1: Monthly (or all)
      doc.addPage();
      y = pageHeader(doc, "Investment & Fees");

      // Fees intro
      const feesIntro = pd?.feesIntroductionText ||
        "This section outlines the services included in this proposal and the fees associated with those services. All fees are quoted in South African Rand (ZAR) and are subject to VAT.";
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M, y, W - M * 2, 20, 4, 4, "F");
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      doc.setFont("helvetica", "normal");
      const fiLines = doc.splitTextToSize(feesIntro, W - M * 2 - 14);
      doc.text(fiLines, M + 7, y + 6);
      y += Math.max(20, fiLines.length * 5 + 10);

      if (hasCategoryBreakdown) {
        y = renderFeesTable(doc, "Monthly Fees", "FEES/MONTH", monthlyServices, y);

        // If annual won't fit, new page
        if (y > H - 80) {
          doc.addPage();
          y = addBranding(doc);
        }
        if (annualServices.length > 0) {
          y = renderFeesTable(doc, "Annual Fees", "FEES/YEAR", annualServices, y);
        }
        if (onceOffServices.length > 0) {
          if (y > H - 80) { doc.addPage(); y = addBranding(doc); }
          y = renderFeesTable(doc, "Once-Off Fees", "FEES", onceOffServices, y);
        }
      } else {
        y = renderFeesTable(doc, "Fees", "COSTS", servicesWithPrices, y);
      }

      // Investment Summary
      if (y > H - 70) { doc.addPage(); y = addBranding(doc); }

      doc.setFontSize(16);
      doc.setTextColor(...hexToRgb(primary));
      doc.setFont("helvetica", "bold");
      doc.text("Investment Summary", M, y);
      y += 8;

      const monthlyTotal = pd?.netMonthlyFee ?? monthlyServices.reduce((s, i) => s + i.price, 0);
      const annualTotal = pd?.netAnnualFee ?? annualServices.reduce((s, i) => s + i.price, 0);
      const onceOffTotal = pd?.netOnceOffFee ?? onceOffServices.reduce((s, i) => s + i.price, 0);
      const netTotal = totalNet;
      const tax = netTotal * 0.15;
      const gross = netTotal + tax;

      const summaryRows = hasCategoryBreakdown
        ? [
            ["Monthly Services Subtotal", fmtCurrency(monthlyTotal, currency)],
            ["Annual Services Subtotal", fmtCurrency(annualTotal, currency)],
            ...(onceOffTotal > 0 ? [["Once-Off Services Subtotal", fmtCurrency(onceOffTotal, currency)]] : []),
          ]
        : [];

      autoTable(doc, {
        startY: y,
        body: [
          ...summaryRows,
          ["Net Total", fmtCurrency(netTotal, currency)],
          ["Tax (15% VAT)", fmtCurrency(tax, currency)],
          ["Gross Total", fmtCurrency(gross, currency)],
        ],
        theme: "grid",
        bodyStyles: { fontSize: 11, cellPadding: 5 },
        columnStyles: {
          0: { cellWidth: "auto", fontStyle: "bold" },
          1: { cellWidth: 55, halign: "right", fontStyle: "bold" },
        },
        margin: { left: M, right: M },
        didParseCell: (data) => {
          const rowIdx = data.row.index;
          const totalRows = summaryRows.length + 3;
          if (rowIdx === totalRows - 1) {
            // Grand total row — gradient-like
            data.cell.styles.fillColor = hexToRgb(primary);
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontSize = 13;
          } else if (rowIdx >= totalRows - 3) {
            data.cell.styles.fillColor = [243, 244, 246];
          }
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

      // Payment terms
      const payTerms = pd?.paymentTermsText || "Monthly services are billed at the beginning of each month. Annual services are billed upon completion or as per agreed milestones.";
      if (y < H - 40) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(M, y, W - M * 2, 25, 4, 4, "F");
        doc.setFontSize(12);
        doc.setTextColor(...hexToRgb(primary));
        doc.setFont("helvetica", "bold");
        doc.text("Payment Terms", M + 7, y + 7);
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.setFont("helvetica", "normal");
        const ptLines = doc.splitTextToSize(payTerms, W - M * 2 - 14);
        doc.text(ptLines, M + 7, y + 14);
      }

      // ════════════════════════════════════════════════════════════════════
      // SERVICE SUMMARY PAGE
      // ════════════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(doc, "Service Summary");

      // Use autoTable for service summary — full-width, matching fees style
      const svcSummaryRows = servicesWithPrices.map((svc) => [
        svc.name,
        svc.description ? stripHtml(svc.description).slice(0, 120) : "",
      ]);
      if (svcSummaryRows.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["SERVICE", "DESCRIPTION"]],
          body: svcSummaryRows,
          theme: "striped",
          headStyles: { fillColor: hexToRgb(primary), textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 },
          bodyStyles: { fontSize: 10, cellPadding: 5, textColor: [55, 65, 81] },
          columnStyles: { 0: { cellWidth: 60, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
          margin: { left: M, right: M },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      }

      // Timeline
      const timelineSteps = pd?.timelineSteps ?? [
        { marker: "W1", title: "Week 1: Onboarding & Setup", description: "Initial meeting, system setup, data migration, and team introductions." },
        { marker: "W2", title: "Week 2-4: First Month Transition", description: "Daily processing begins, weekly check-ins, and process refinement." },
        { marker: "M2+", title: "Month 2 Onwards: Regular Service Delivery", description: "Ongoing monthly services, regular reporting, quarterly reviews, and continuous support." },
      ];

      const timelineY = H - 70;
      doc.setFontSize(14);
      doc.setTextColor(...hexToRgb(primary));
      doc.setFont("helvetica", "bold");
      doc.text("Service Delivery Timeline", M, timelineY);
      let ty = timelineY + 8;

      timelineSteps.slice(0, 3).forEach((step) => {
        // Marker circle
        doc.setFillColor(...lerpColor(hexToRgb(primary), [255, 255, 255], 0.8));
        doc.circle(M + 8, ty + 3, 6, "F");
        doc.setFontSize(8);
        doc.setTextColor(...hexToRgb(primary));
        doc.setFont("helvetica", "bold");
        doc.text(step.marker, M + 8, ty + 5, { align: "center" });

        doc.setFontSize(11);
        doc.text(step.title, M + 18, ty + 2);
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.setFont("helvetica", "normal");
        doc.text(doc.splitTextToSize(step.description, W - M - 22).slice(0, 1).join(""), M + 18, ty + 7);
        ty += 16;
      });

      // ════════════════════════════════════════════════════════════════════
      // ALL SERVICES PAGE
      // ════════════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(doc, "All The Services We Provide");

      doc.setFontSize(11);
      doc.setTextColor(75, 85, 99);
      doc.setFont("helvetica", "normal");
      const allSvcIntro = "While this proposal focuses on the services you've selected, here is the full range of solutions we offer:";
      const introL = doc.splitTextToSize(allSvcIntro, W - M * 2);
      doc.text(introL, M, y);
      y += introL.length * 6 + 6;

      const firmServices = pd?.allFirmServices ?? allServiceNames.map((n) => ({ name: n }));
      if (firmServices.length > 0) {
        // Full-width table of all services
        const svcRows = firmServices.map((svc, idx) => [String(idx + 1), svc.name]);
        autoTable(doc, {
          startY: y,
          head: [["#", "SERVICE"]],
          body: svcRows,
          theme: "striped",
          headStyles: { fillColor: hexToRgb(primary), textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 },
          bodyStyles: { fontSize: 11, cellPadding: 5, textColor: [55, 65, 81] },
          columnStyles: { 0: { cellWidth: 15, halign: "center", fontStyle: "bold" }, 1: { cellWidth: "auto" } },
          margin: { left: M, right: M },
        });
      }

      // ════════════════════════════════════════════════════════════════════
      // NEXT STEPS PAGE
      // ════════════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(doc, "Next Steps");

      const stepsIntro = pd?.whatHappensNextText ||
        "We've made the onboarding process as smooth as possible. Here's exactly what will happen once you approve this proposal:";
      doc.setFontSize(11);
      doc.setTextColor(75, 85, 99);
      doc.setFont("helvetica", "normal");
      const stepsIntroLines = doc.splitTextToSize(stepsIntro, W - M * 2);
      doc.text(stepsIntroLines, M, y);
      y += stepsIntroLines.length * 6 + 6;

      const steps = [
        {
          title: "Approve & Sign",
          desc: 'Click the "Accept Proposal" button below to proceed. You\'ll be guided through a quick digital signature process.',
        },
        {
          title: "Your Personal Onboarding Call",
          desc: `${pd?.advisorName || "Your advisor"} will contact you within 24 hours to schedule your onboarding session.`,
        },
        {
          title: "First Month Transition",
          desc: "We'll work closely with you during your first month with weekly check-ins to ensure everything runs smoothly.",
        },
      ];

      const stepsRows = steps.map((step, idx) => [
        `STEP ${idx + 1}`,
        step.title,
        step.desc,
      ]);
      autoTable(doc, {
        startY: y,
        head: [["STEP", "ACTION", "DETAILS"]],
        body: stepsRows,
        theme: "striped",
        headStyles: { fillColor: hexToRgb(primary), textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 },
        bodyStyles: { fontSize: 10, cellPadding: 5, textColor: [55, 65, 81] },
        columnStyles: {
          0: { cellWidth: 20, halign: "center", fontStyle: "bold", textColor: hexToRgb(primary) },
          1: { cellWidth: 45, fontStyle: "bold" },
          2: { cellWidth: "auto" },
        },
        margin: { left: M, right: M },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

      // Accept / Decline buttons
      y += 5;
      const btnW = 60;
      const btnH = 12;
      // Accept
      doc.setFillColor(...hexToRgb(primary));
      doc.roundedRect(W / 2 - btnW - 5, y, btnW, btnH, 6, 6, "F");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("Accept Proposal", W / 2 - btnW / 2 - 5, y + 8, { align: "center" });

      // Decline
      doc.setFillColor(156, 163, 175);
      doc.roundedRect(W / 2 + 5, y, btnW, btnH, 6, 6, "F");
      doc.text("Decline", W / 2 + btnW / 2 + 5, y + 8, { align: "center" });
      y += btnH + 8;

      // Validity
      const validDate = pd?.validUntil
        ? new Date(pd.validUntil).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })
        : new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.setFont("helvetica", "normal");
      doc.text(`This proposal is valid until ${validDate}`, W / 2, y, { align: "center" });

      // ════════════════════════════════════════════════════════════════════
      // CLOSING PAGE
      // ════════════════════════════════════════════════════════════════════
      doc.addPage();
      drawGradientBg(doc, primary, secondary);

      const closeQuote = pd?.closingQuote || "";
      const closeAuthor = pd?.closingQuoteAuthor || "";
      if (closeQuote) {
        doc.setFontSize(22);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "italic");
        const qLines = doc.splitTextToSize(`"${closeQuote}"`, W - 80);
        doc.text(qLines, W / 2, H / 2 - 10, { align: "center" });
        if (closeAuthor) {
          doc.setFontSize(13);
          doc.setFont("helvetica", "normal");
          const authorY = H / 2 - 10 + qLines.length * 9 + 8;
          doc.setFillColor(255, 255, 255, 0.2);
          const aw = doc.getTextWidth(`- ${closeAuthor}`) + 20;
          doc.roundedRect((W - aw) / 2, authorY - 5, aw, 12, 6, 6, "F");
          doc.text(`- ${closeAuthor}`, W / 2, authorY + 3, { align: "center" });
        }
      } else {
        // Fallback: firm name centered
        doc.setFontSize(28);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(firmName, W / 2, H / 2, { align: "center" });
      }

      // ════════════════════════════════════════════════════════════════════
      // FOOTERS (page numbers on standard pages — skip cover + closing)
      // ════════════════════════════════════════════════════════════════════
      const pageCount = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
      for (let i = 2; i < pageCount; i++) {
        doc.setPage(i);

        // Bottom logo — far bottom-right corner, touching edges
        if (footerImg) {
          try {
            const blH = 20;
            const blW = blH * footerImg.aspectRatio;
            const blX = W - M - blW; // aligned with content right margin
            const blY = H - blH - 3;
            doc.addImage(footerImg.dataUrl, "PNG", blX, blY, blW, blH, undefined, "FAST");
          } catch { /* skip */ }
        }

        // Page number — bottom left (Risen pattern)
        const footerY = H - 5;
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${pageCount} - ${pd?.firmName ?? firmName}`, M, footerY);
      }

      // ── Output ──
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfDataUrl(url);
      hasGeneratedOnce.current = true;
    } catch (error) {
      console.error("Error generating PDF:", error);
      if (!hasGeneratedOnce.current) toast.error("Failed to generate PDF preview");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pdfDataUrl) return;
    try {
      const link = document.createElement("a");
      link.href = pdfDataUrl;
      const name = selectedClientData?.companyName || selectedClientData?.contactName || proposalData?.clientName || "Client";
      const safe = String(name).replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, " ").trim() || "proposal";
      const dateStr = new Date().toISOString().split("T")[0];
      link.download = `Proposal - ${safe} - ${dateStr}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("PDF downloaded successfully");
    } catch {
      toast.error("Failed to download PDF");
    }
  };

  useEffect(() => {
    if (onDownloadReady && pdfDataUrl) onDownloadReady(handleDownload);
  }, [pdfDataUrl, onDownloadReady]);

  return (
    <div className="flex flex-col h-full min-h-[600px] bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden relative scrollbar-hide">
      {!hideDownloadButton && (
        <div className="absolute top-4 right-4 z-30">
          <Button
            onClick={handleDownload}
            disabled={!pdfDataUrl || isGenerating}
            size="sm"
            className="shadow-md h-9 px-4 text-[13px] font-medium rounded-lg"
            style={{ backgroundColor: "#243E63", color: "#ffffff" }}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isGenerating ? "Preparing..." : "Download PDF"}
          </Button>
        </div>
      )}
      {isGenerating ? (
        <div className="flex flex-col items-center justify-center flex-1 min-h-[500px]">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#C8A96E" }} />
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Generating PDF preview...</p>
        </div>
      ) : pdfDataUrl ? (
        <iframe
          ref={iframeRef}
          src={`${pdfDataUrl}#toolbar=0&view=FitV&navpanes=0&scrollbar=1`}
          className="w-full flex-1 border-none min-h-[800px]"
          style={{ height: "800px" }}
          title="Proposal PDF Preview"
        />
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 text-slate-400">Failed to load preview</div>
      )}
    </div>
  );
}
