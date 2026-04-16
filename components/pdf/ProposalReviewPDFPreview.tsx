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
      const primary = pd?.brandColors?.primary || "#5DBEB4";
      const secondary = pd?.brandColors?.secondary || "#4A90E2";
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

      // ── Helper: standard page background (#FAFBFC like HTML template) ──
      const addPageBg = (d: jsPDF) => {
        d.setFillColor(250, 251, 252);
        d.rect(0, 0, W, H, "F");
      };

      // ── Helper: add logo + brand line to standard page (Risen pattern) ──
      const addBranding = (d: jsPDF): number => {
        addPageBg(d);
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

      // ── Helper: standard page header (36px title from HTML template) ──
      const pageHeader = (d: jsPDF, title: string): number => {
        const y = addBranding(d);
        d.setFontSize(28);
        d.setTextColor(...hexToRgb(primary));
        d.setFont("helvetica", "bold");
        d.text(title, M, y + 6);
        return y + 18;
      };

      // ════════════════════════════════════════════════════════════════════
      // PAGE 1: COVER PAGE — matches risen_proposal_template.html exactly
      // ════════════════════════════════════════════════════════════════════
      drawGradientBg(doc, primary, secondary);

      // Cover padding (HTML: padding: 50px 60px → ~16mm side, ~13mm top)
      const CP = 18;

      // ── Logo: centered at top ──
      if (coverImg) {
        try {
          const lh = 22;
          const lw = lh * coverImg.aspectRatio;
          doc.addImage(coverImg.dataUrl, "PNG", (W - lw) / 2, 16, lw, lh, undefined, "FAST");
        } catch { /* skip */ }
      }

      // ── Quote: LEFT-ALIGNED (HTML .cover-quote: font-size 28px, italic, left-aligned) ──
      const quote = pd?.coverQuote || "";
      const quoteAuthor = pd?.coverQuoteAuthor || "";
      let quoteBottomY = 80;
      if (quote) {
        doc.setFontSize(21);          // 28px → ~21pt
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "italic");
        const quoteLines = doc.splitTextToSize(`\u201C${quote}\u201D`, W - CP * 2);
        doc.text(quoteLines, CP, 80); // LEFT-aligned, no { align: "center" }
        quoteBottomY = 80 + quoteLines.length * 9;
        if (quoteAuthor) {
          doc.setFontSize(12);        // 16px → 12pt
          doc.setFont("helvetica", "normal");
          doc.text(`\u2013 ${quoteAuthor}`, CP, quoteBottomY + 6); // LEFT-aligned
        }
      }

      // ── "Proposal for" section: CENTERED (HTML .proposal-title) ──
      const pfY = H * 0.50;
      doc.setFontSize(14);            // 18px → ~14pt
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "normal");
      doc.text("Proposal for", W / 2, pfY, { align: "center" });

      // Client name: LARGE BOLD CENTERED (HTML h2: 52px → ~39pt)
      doc.setFontSize(39);
      doc.setFont("helvetica", "bold");
      doc.text(clientName, W / 2, pfY + 16, { align: "center" });

      // Proposal number pill (HTML .proposal-number: 16px, bg rgba white 0.15, border-radius 20px)
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      const pillText = `Proposal #${refNumber}`;
      const pillTw = doc.getTextWidth(pillText);
      const pillW = pillTw + 16;
      const pillX = (W - pillW) / 2;
      const pillY = pfY + 28;
      doc.setFillColor(255, 255, 255, 0.15);
      doc.roundedRect(pillX, pillY, pillW, 10, 5, 5, "F");
      doc.text(pillText, W / 2, pillY + 7, { align: "center" });

      // ── Contact grid at bottom (HTML .contact-grid) ──
      const gridY = H - 68;
      const colR = W / 2 + 5;       // right column start

      // Top border (HTML: border-top: 1px solid rgba(255,255,255,0.25))
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.15);
      doc.line(CP, gridY, W - CP, gridY);

      // — Left column: CREATED BY —
      // Label (HTML: 13px, uppercase, letter-spacing 1.5px, opacity 0.75)
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(210, 225, 235); // white at ~0.75 opacity on gradient
      doc.text("CREATED BY", CP, gridY + 12);

      // Name (HTML: strong, 18px bold)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(pd?.advisorName || "[ADVISOR NAME]", CP, gridY + 22);

      // Title, email, mobile (HTML: p, 14px normal)
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(pd?.advisorTitle || "[ADVISOR TITLE]", CP, gridY + 28);
      doc.text(`e: ${pd?.advisorEmail || "[EMAIL]"}`, CP, gridY + 34);
      doc.text(`m: ${pd?.advisorPhone || "[MOBILE]"}`, CP, gridY + 40);

      // — Right column: CREATED FOR —
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(210, 225, 235);
      doc.text("CREATED FOR", colR, gridY + 12);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(clientName || "[CLIENT CONTACT NAME]", colR, gridY + 22);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(clientPhone ? "Client" : "[CLIENT TITLE]", colR, gridY + 28);
      doc.text(`e: ${clientEmail || "[CLIENT_EMAIL]"}`, colR, gridY + 34);
      doc.text(`m: ${clientPhone || "[CLIENT_MOBILE]"}`, colR, gridY + 40);

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
        "Service Summary & Timeline",
        "All The Services We Provide",
        "Next Steps",
      ];

      // White card container (matching HTML template .contents-list)
      const tocItemH = 12;
      const tocPad = 8;
      const tocCardH = tocEntries.length * tocItemH + tocPad * 2;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M, y, W - M * 2, tocCardH, 4, 4, "F");

      let tocY = y + tocPad + 6;
      let pageNum = 3;

      tocEntries.forEach((entry, idx) => {
        // Entry text
        doc.setFontSize(13);
        doc.setTextColor(55, 65, 81);
        doc.setFont("helvetica", "bold");
        doc.text(entry, M + tocPad, tocY);

        // Page number pill (teal bg, teal text)
        const pillText = String(pageNum);
        const pillW = doc.getTextWidth(pillText) + 10;
        const pillX = W - M - tocPad - pillW;
        const pillY = tocY - 4;
        doc.setFillColor(...lerpColor(hexToRgb(primary), [255, 255, 255], 0.85));
        doc.roundedRect(pillX, pillY, pillW, 7, 3.5, 3.5, "F");
        doc.setFontSize(10);
        doc.setTextColor(...hexToRgb(primary));
        doc.setFont("helvetica", "bold");
        doc.text(pillText, pillX + pillW / 2, tocY, { align: "center" });

        // Bottom border (except last item)
        if (idx < tocEntries.length - 1) {
          doc.setDrawColor(229, 231, 235);
          doc.setLineWidth(0.15);
          doc.line(M + tocPad, tocY + 5, W - M - tocPad, tocY + 5);
        }

        tocY += tocItemH;
        pageNum++;
      });

      // ════════════════════════════════════════════════════════════════════
      // PAGE 3: INTRODUCTION — HTML .intro-content (white card, rounded)
      // ════════════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(doc, "Introduction");

      const introParas = customIntroText
        ? customIntroText.split(/\n+/).filter(Boolean)
        : [
            `Hello ${clientName}!`,
            `Thank you for considering ${firmName} as your trusted financial partner. We\u2019re excited to present this proposal, which has been carefully crafted specifically for ${clientName}.`,
            `At ${firmName}, we understand that every business has unique challenges and opportunities. That\u2019s why we\u2019ve tailored this proposal to address your specific needs and goals, ensuring that our services align perfectly with your vision for success.`,
            `This document outlines not just the services we\u2019ll provide, but also how we\u2019ll work together to drive your business forward. We believe in building long-term partnerships based on trust, transparency, and measurable results.`,
            `We look forward to embarking on this exciting journey with you.`,
          ];

      // Measure content height for the white card
      const cardPadIntro = 12;
      let introContentH = 0;
      const introMeasured = introParas.map((p, idx) => {
        const fs = idx === 0 ? 13 : 12;
        doc.setFontSize(fs);
        doc.setFont("helvetica", idx === 0 ? "bold" : "normal");
        const lines = doc.splitTextToSize(p, W - M * 2 - cardPadIntro * 2);
        const blockH = lines.length * (idx === 0 ? 6 : 6.5) + 6;
        introContentH += blockH;
        return { lines, fs, bold: idx === 0, blockH };
      });

      // White card (HTML .intro-content: bg white, padding 40px, border-radius 16px)
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M, y, W - M * 2, introContentH + cardPadIntro * 2, 4, 4, "F");

      let iy = y + cardPadIntro + 4;
      introMeasured.forEach((item) => {
        doc.setFontSize(item.fs);
        if (item.bold) {
          doc.setTextColor(...hexToRgb(primary));
          doc.setFont("helvetica", "bold");
        } else {
          doc.setTextColor(75, 85, 99);
          doc.setFont("helvetica", "normal");
        }
        doc.text(item.lines, M + cardPadIntro, iy);
        iy += item.blockH;
      });
      y = iy + cardPadIntro;

      // ════════════════════════════════════════════════════════════════════
      // PAGE 4: ABOUT US — HTML .about-content (white card, rounded)
      // ════════════════════════════════════════════════════════════════════
      const hasAboutUs = pd?.aboutUsHtml || pd?.missionStatement || pd?.whyChooseUsItems?.length;
      if (hasAboutUs) {
        doc.addPage();
        y = pageHeader(doc, `About ${firmName}`);

        // White card container (HTML .about-content: bg white, padding 40px, border-radius 16px)
        const aboutCardX = M;
        const aboutCardW = W - M * 2;
        const aboutCardY = y;
        const aboutPad = 12;

        // Draw card bg first (will extend to bottom of content)
        // We'll measure content, then draw
        let ay = aboutCardY + aboutPad;

        // Temporarily measure without drawing, then draw card + content
        const aboutSections: { draw: () => void; h: number }[] = [];

        if (pd?.aboutUsHtml) {
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          const aboutLines = doc.splitTextToSize(stripHtml(pd.aboutUsHtml), aboutCardW - aboutPad * 2);
          const h = aboutLines.length * 5.5 + 8;
          aboutSections.push({ h, draw: () => {
            doc.setFontSize(12);
            doc.setTextColor(75, 85, 99);
            doc.setFont("helvetica", "normal");
            doc.text(aboutLines, aboutCardX + aboutPad, ay);
            ay += h;
          }});
        }
        if (pd?.missionStatement) {
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setFont("helvetica", "normal");
          const mLines = doc.splitTextToSize(pd.missionStatement, aboutCardW - aboutPad * 2);
          const h = 9 + mLines.length * 5.5 + 8;
          aboutSections.push({ h, draw: () => {
            doc.setFontSize(16);
            doc.setTextColor(...hexToRgb(secondary));
            doc.setFont("helvetica", "bold");
            doc.text("Our Mission", aboutCardX + aboutPad, ay);
            ay += 9;
            doc.setFontSize(11);
            doc.setTextColor(75, 85, 99);
            doc.setFont("helvetica", "normal");
            doc.text(mLines, aboutCardX + aboutPad, ay);
            ay += mLines.length * 5.5 + 8;
          }});
        }
        if (pd?.whyChooseUsItems && pd.whyChooseUsItems.length > 0) {
          let itemsH = 9;
          const itemData: { lines: string[]; lh: number }[] = [];
          pd.whyChooseUsItems.forEach((item) => {
            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            const itemLines = doc.splitTextToSize(item, aboutCardW - aboutPad * 2 - 12);
            const lh = itemLines.length * 5.5 + 3;
            itemsH += lh;
            itemData.push({ lines: itemLines, lh });
          });
          itemsH += 5;
          aboutSections.push({ h: itemsH, draw: () => {
            doc.setFontSize(16);
            doc.setTextColor(...hexToRgb(secondary));
            doc.setFont("helvetica", "bold");
            doc.text("Why Choose Us?", aboutCardX + aboutPad, ay);
            ay += 9;
            doc.setFontSize(11);
            doc.setFont("helvetica", "normal");
            itemData.forEach((d) => {
              doc.setFillColor(...hexToRgb(primary));
              doc.circle(aboutCardX + aboutPad + 4, ay - 1.5, 1.5, "F");
              doc.setTextColor(75, 85, 99);
              doc.text(d.lines, aboutCardX + aboutPad + 10, ay);
              ay += d.lh;
            });
            ay += 5;
          }});
        }
        if (pd?.valuesStatement) {
          doc.setFontSize(11);
          doc.setFont("helvetica", "normal");
          const vLines = doc.splitTextToSize(pd.valuesStatement, aboutCardW - aboutPad * 2);
          const h = 9 + vLines.length * 5.5 + 8;
          aboutSections.push({ h, draw: () => {
            doc.setFontSize(16);
            doc.setTextColor(...hexToRgb(secondary));
            doc.setFont("helvetica", "bold");
            doc.text("Our Values", aboutCardX + aboutPad, ay);
            ay += 9;
            doc.setFontSize(11);
            doc.setTextColor(75, 85, 99);
            doc.setFont("helvetica", "normal");
            doc.text(vLines, aboutCardX + aboutPad, ay);
            ay += vLines.length * 5.5 + 8;
          }});
        }
        if (pd?.website) {
          aboutSections.push({ h: 8, draw: () => {
            doc.setFontSize(11);
            doc.setTextColor(...hexToRgb(primary));
            doc.setFont("helvetica", "bold");
            doc.text(`Learn more: ${pd.website}`, aboutCardX + aboutPad, ay);
            ay += 8;
          }});
        }

        // Draw white card
        const totalAboutH = aboutSections.reduce((s, sec) => s + sec.h, 0) + aboutPad * 2;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(aboutCardX, aboutCardY, aboutCardW, totalAboutH, 4, 4, "F");

        // Draw content inside card
        aboutSections.forEach((sec) => sec.draw());
        y = aboutCardY + totalAboutH + 5;
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
      const proposalEntities = pd?.entities ?? [];
      const hasEntities = proposalEntities.length > 0;

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

      // Fees page 1: Investment & Fees
      doc.addPage();
      y = pageHeader(doc, "Investment & Fees");

      // Fees intro card
      const feesIntro = pd?.feesIntroductionText ||
        "This section outlines the services included in this proposal and the fees associated with those services. All fees are quoted in South African Rand (ZAR) and are subject to VAT. For a full breakdown of what each service includes, please refer to the \"Service Summary & Timeline\" and \"All The Services We Provide\" sections.";
      doc.setFillColor(255, 255, 255);
      const fiLines = doc.splitTextToSize(feesIntro, W - M * 2 - 14);
      const fiCardH = Math.max(20, fiLines.length * 5 + 10);
      doc.roundedRect(M, y, W - M * 2, fiCardH, 4, 4, "F");
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99);
      doc.setFont("helvetica", "normal");
      doc.text(fiLines, M + 7, y + 6);
      y += fiCardH + 6;

      // Section label: dot + "SERVICES SUMMARY"
      doc.setFillColor(...hexToRgb(primary));
      doc.circle(M + 2, y + 1.5, 1.5, "F");
      doc.setFontSize(10);
      doc.setTextColor(...hexToRgb(secondary));
      doc.setFont("helvetica", "bold");
      doc.text("SERVICES SUMMARY", M + 8, y + 3);
      y += 8;

      // Build category groups
      const feeCategories: { label: string; items: typeof servicesWithPrices }[] = [];
      if (hasCategoryBreakdown) {
        if (monthlyServices.length > 0) feeCategories.push({ label: "Accounting Services", items: monthlyServices });
        if (annualServices.length > 0) feeCategories.push({ label: "Tax & Compliance", items: annualServices });
        if (onceOffServices.length > 0) feeCategories.push({ label: "Once-Off Services", items: onceOffServices });
      } else {
        feeCategories.push({ label: "", items: servicesWithPrices });
      }

      const netTotal = totalNet;
      const tax = netTotal * 0.15;
      const gross = netTotal + tax;

      if (hasEntities) {
        // ── Services Summary Table with entity columns ──
        const entityNames = proposalEntities.map(e => e.name);
        const headRow = ["Service", ...entityNames, "Amount"];
        const tableBody: string[][] = [];
        const rowMeta: { isCategory?: boolean; isGrandTotal?: boolean }[] = [];

        feeCategories.forEach(group => {
          if (group.label) {
            const catRow = new Array(headRow.length).fill("");
            catRow[headRow.length - 1] = group.label;
            tableBody.push(catRow);
            rowMeta.push({ isCategory: true });
          }
          group.items.forEach(svc => {
            const row = [svc.name];
            entityNames.forEach((eName) => {
              row.push(svc.entityLabels?.some(l => l === eName) ? eName.replace(/^Entity\s*/i, "").charAt(0).toUpperCase() : "\u2014");
            });
            row.push(fmtCurrency(svc.price, currency));
            tableBody.push(row);
            rowMeta.push({});
          });
        });

        // Grand total row
        const grandRow = new Array(headRow.length).fill("");
        grandRow[0] = "Grand Total";
        grandRow[headRow.length - 1] = fmtCurrency(gross, currency);
        tableBody.push(grandRow);
        rowMeta.push({ isGrandTotal: true });

        const entityBadgeColors: [number, number, number][] = [hexToRgb(secondary), [26, 122, 74]];
        const entityBadgeBgs: [number, number, number][] = [[232, 243, 252], [230, 244, 238]];

        autoTable(doc, {
          startY: y,
          head: [headRow],
          body: tableBody,
          theme: "striped",
          headStyles: { fillColor: hexToRgb(primary), textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
          bodyStyles: { fontSize: 10, cellPadding: 5 },
          columnStyles: {
            0: { cellWidth: "auto" },
            ...Object.fromEntries(entityNames.map((_, i) => [String(i + 1), { cellWidth: 25, halign: "center" as const }])),
            [String(headRow.length - 1)]: { cellWidth: 38, halign: "right" as const, fontStyle: "bold" },
          },
          margin: { left: M, right: M },
          didParseCell: (data) => {
            if (data.section !== "body") return;
            const meta = rowMeta[data.row.index];
            if (!meta) return;
            if (meta.isCategory) {
              data.cell.styles.fillColor = [249, 250, 251];
              data.cell.styles.textColor = hexToRgb(secondary);
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fontSize = 8;
              data.cell.styles.halign = "right";
            }
            if (meta.isGrandTotal) {
              data.cell.styles.fillColor = hexToRgb(primary);
              data.cell.styles.textColor = [255, 255, 255];
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fontSize = 12;
            }
          },
          didDrawCell: (data) => {
            if (data.section !== "body") return;
            const meta = rowMeta[data.row.index];
            if (meta?.isCategory || meta?.isGrandTotal) return;
            // Draw entity badges for entity columns
            const colIdx = data.column.index;
            if (colIdx >= 1 && colIdx < headRow.length - 1) {
              const cellText = String(data.cell.text);
              if (cellText && cellText !== "\u2014") {
                const bIdx = colIdx - 1;
                const bx = data.cell.x + data.cell.width / 2 - 5;
                const by = data.cell.y + 2;
                doc.setFillColor(...(entityBadgeBgs[bIdx % entityBadgeBgs.length]));
                doc.roundedRect(bx, by, 10, 6, 1, 1, "F");
                doc.setFontSize(7);
                doc.setTextColor(...(entityBadgeColors[bIdx % entityBadgeColors.length]));
                doc.setFont("helvetica", "bold");
                doc.text(cellText, bx + 5, by + 4.5, { align: "center" });
              }
            }
          },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

        // ══════════════════════════════════════════════════════════
        // FEES PAGE 2: Pricing Breakdown Per Entity
        // ══════════════════════════════════════════════════════════
        doc.addPage();
        y = addBranding(doc);

        // Section label
        doc.setFillColor(...hexToRgb(primary));
        doc.circle(M + 2, y + 1.5, 1.5, "F");
        doc.setFontSize(10);
        doc.setTextColor(...hexToRgb(secondary));
        doc.setFont("helvetica", "bold");
        doc.text("PRICING BREAKDOWN PER ENTITY", M + 8, y + 3);
        y += 10;

        // Group services by entity
        const servicesByEntity = new Map<string, typeof servicesWithPrices>();
        proposalEntities.forEach(e => servicesByEntity.set(e.name, []));
        servicesWithPrices.forEach(svc => {
          (svc.entityLabels ?? []).forEach(label => {
            const arr = servicesByEntity.get(label);
            if (arr) arr.push(svc);
          });
        });

        const cardW = (W - M * 2 - 10) / Math.min(proposalEntities.length, 2);
        const entityCardColors: [number, number, number][] = [hexToRgb(secondary), [26, 122, 74]];
        let maxCardBottom = y;

        proposalEntities.slice(0, 2).forEach((entity, eIdx) => {
          const cx = M + eIdx * (cardW + 10);
          const entitySvcs = servicesByEntity.get(entity.name) ?? [];
          const entitySubtotal = entitySvcs.reduce((s, svc) => s + svc.price, 0);
          const headerH = 26;
          const rowH = 12;
          const bodyH = entitySvcs.length * rowH + 20;
          const totalCardH = headerH + bodyH;
          const ec = entityCardColors[eIdx % entityCardColors.length];

          // Card container
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(cx, y, cardW, totalCardH, 3, 3, "F");

          // Card header (colored)
          doc.setFillColor(...ec);
          doc.roundedRect(cx, y, cardW, headerH, 3, 3, "F");
          doc.rect(cx, y + headerH - 3, cardW, 3, "F");

          // Entity label
          doc.setFontSize(7);
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.text(entity.name.toUpperCase(), cx + 7, y + 7);

          // Category name + subtotal
          doc.setFontSize(13);
          const groupLabel = feeCategories[eIdx]?.label || entity.name;
          doc.text(groupLabel, cx + 7, y + 17);
          doc.text(fmtCurrency(entitySubtotal, currency), cx + cardW - 7, y + 17, { align: "right" });
          doc.setFontSize(7);
          doc.text("subtotal", cx + cardW - 7, y + 22, { align: "right" });

          // Service rows
          let ry = y + headerH + 8;
          entitySvcs.forEach((svc, sIdx) => {
            doc.setFontSize(10);
            doc.setTextColor(75, 85, 99);
            doc.setFont("helvetica", "normal");
            doc.text(svc.name, cx + 7, ry);
            doc.setTextColor(31, 41, 55);
            doc.setFont("helvetica", "bold");
            doc.text(fmtCurrency(svc.price, currency), cx + cardW - 7, ry, { align: "right" });
            if (sIdx < entitySvcs.length - 1) {
              doc.setDrawColor(229, 231, 235);
              doc.setLineWidth(0.15);
              doc.line(cx + 7, ry + 4, cx + cardW - 7, ry + 4);
            }
            ry += rowH;
          });

          // Section subtotal line
          ry += 2;
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.line(cx + 7, ry - 4, cx + cardW - 7, ry - 4);
          doc.setFontSize(10);
          doc.setTextColor(31, 41, 55);
          doc.setFont("helvetica", "bold");
          doc.text("Section Subtotal", cx + 7, ry);
          doc.text(fmtCurrency(entitySubtotal, currency), cx + cardW - 7, ry, { align: "right" });

          maxCardBottom = Math.max(maxCardBottom, y + totalCardH);
        });

        y = maxCardBottom + 15;

        // Payment terms card
        const payTerms = pd?.paymentTermsText || "Monthly services are billed at the beginning of each month. Annual services are billed upon completion or as per agreed milestones. All fees are subject to review every 3 months based on actual transaction volumes.";
        if (y < H - 50) {
          const ptContentLines = doc.splitTextToSize(payTerms, W - M * 2 - 14);
          const ptCardH = ptContentLines.length * 5 + 18;
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(M, y, W - M * 2, ptCardH, 4, 4, "F");
          doc.setFontSize(12);
          doc.setTextColor(...hexToRgb(primary));
          doc.setFont("helvetica", "bold");
          doc.text("Payment Terms", M + 7, y + 7);
          doc.setFontSize(9);
          doc.setTextColor(75, 85, 99);
          doc.setFont("helvetica", "normal");
          doc.text(ptContentLines, M + 7, y + 14);
        }
      } else {
        // ── No entities: simpler fee table layout ──
        if (hasCategoryBreakdown) {
          y = renderFeesTable(doc, "Monthly Fees", "FEES/MONTH", monthlyServices, y);
          if (y > H - 80) { doc.addPage(); y = addBranding(doc); }
          if (annualServices.length > 0) y = renderFeesTable(doc, "Annual Fees", "FEES/YEAR", annualServices, y);
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
      }

      // ════════════════════════════════════════════════════════════════════
      // SERVICE SUMMARY & TIMELINE PAGE
      // ════════════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(doc, "Service Summary & Timeline");

      // ── "Services We'll Deliver" card (matching HTML .summary-section) ──
      {
        const svcItems = servicesWithPrices;
        const itemH = 14;
        const cardPad = 10;
        const titleH = 10;
        const svcCardH = titleH + svcItems.length * itemH + cardPad * 2;

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(M, y, W - M * 2, svcCardH, 4, 4, "F");

        // Card heading
        doc.setFontSize(16);
        doc.setTextColor(...hexToRgb(primary));
        doc.setFont("helvetica", "bold");
        doc.text("Services We'll Deliver", M + cardPad, y + cardPad + 4);

        let svcY = y + cardPad + titleH + 4;
        svcItems.forEach((svc, idx) => {
          // Service name (blue, like HTML .service-item h4)
          doc.setFontSize(11);
          doc.setTextColor(...hexToRgb(secondary));
          doc.setFont("helvetica", "bold");
          doc.text(svc.name, M + cardPad, svcY);

          // Description
          if (svc.description) {
            doc.setFontSize(9);
            doc.setTextColor(107, 114, 128);
            doc.setFont("helvetica", "normal");
            const descLines = doc.splitTextToSize(stripHtml(svc.description), W - M * 2 - cardPad * 2);
            doc.text(descLines[0] || "", M + cardPad, svcY + 5);
          }

          // Bottom border (except last)
          if (idx < svcItems.length - 1) {
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.15);
            doc.line(M + cardPad, svcY + 8, W - M - cardPad, svcY + 8);
          }
          svcY += itemH;
        });

        y += svcCardH + 8;
      }

      // ── "Service Delivery Timeline" card (matching HTML .summary-section) ──
      const timelineSteps = pd?.timelineSteps ?? [
        { marker: "W1", title: "Week 1: Onboarding & Setup", description: "Initial meeting, system setup, data migration, and team introductions." },
        { marker: "W2", title: "Week 2-4: First Month Transition", description: "Daily processing begins, weekly check-ins, and process refinement." },
        { marker: "M2+", title: "Month 2 Onwards: Regular Service Delivery", description: "Ongoing monthly services, regular reporting, quarterly reviews, and continuous support." },
      ];

      {
        const stepH = 18;
        const tlPad = 10;
        const titleH = 10;
        const tlCardH = titleH + timelineSteps.length * stepH + tlPad * 2;

        // If card won't fit, use remaining space
        const tlStartY = Math.min(y, H - tlCardH - 15);

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(M, tlStartY, W - M * 2, tlCardH, 4, 4, "F");

        doc.setFontSize(16);
        doc.setTextColor(...hexToRgb(primary));
        doc.setFont("helvetica", "bold");
        doc.text("Service Delivery Timeline", M + tlPad, tlStartY + tlPad + 4);

        let ty = tlStartY + tlPad + titleH + 6;
        timelineSteps.slice(0, 3).forEach((step) => {
          // Marker circle (50x50 in HTML → 8mm radius)
          doc.setFillColor(...lerpColor(hexToRgb(primary), [255, 255, 255], 0.82));
          doc.circle(M + tlPad + 8, ty + 2, 7, "F");
          doc.setFontSize(9);
          doc.setTextColor(...hexToRgb(primary));
          doc.setFont("helvetica", "bold");
          doc.text(step.marker, M + tlPad + 8, ty + 4, { align: "center" });

          // Title
          doc.setFontSize(12);
          doc.setTextColor(...hexToRgb(primary));
          doc.setFont("helvetica", "bold");
          doc.text(step.title, M + tlPad + 20, ty);

          // Description
          doc.setFontSize(9);
          doc.setTextColor(75, 85, 99);
          doc.setFont("helvetica", "normal");
          const descLines = doc.splitTextToSize(step.description, W - M * 2 - tlPad * 2 - 22);
          doc.text(descLines[0] || "", M + tlPad + 20, ty + 6);

          ty += stepH;
        });
      }

      // ════════════════════════════════════════════════════════════════════
      // ALL SERVICES PAGE
      // ════════════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(doc, "All The Services We Provide");

      // Intro card (HTML .services-intro: white card, rounded)
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      const allSvcIntro = "While this proposal focuses on the services you\u2019ve selected, we want you to know about the full range of solutions we offer. As your business grows and evolves, we\u2019re here to support you with additional services:";
      const introL = doc.splitTextToSize(allSvcIntro, W - M * 2 - 20);
      const introCardH = introL.length * 5.5 + 14;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M, y, W - M * 2, introCardH, 4, 4, "F");
      doc.setTextColor(75, 85, 99);
      doc.text(introL, M + 10, y + 7);
      y += introCardH + 6;

      const firmServices = pd?.allFirmServices ?? allServiceNames.map((n) => ({ name: n }));
      if (firmServices.length > 0) {
        // 2-column card grid matching HTML template
        const svcCardW = (W - M * 2 - 8) / 2;
        const svcCardH = 24;
        const svcCardGap = 6;

        firmServices.forEach((svc, idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const cx = M + col * (svcCardW + 8);
          const cy = y + row * (svcCardH + svcCardGap);

          // Card background
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(cx, cy, svcCardW, svcCardH, 4, 4, "F");

          // Top accent border
          doc.setFillColor(...hexToRgb(primary));
          doc.roundedRect(cx, cy, svcCardW, 1.5, 4, 4, "F");
          doc.setFillColor(255, 255, 255);
          doc.rect(cx, cy + 1.2, svcCardW, 2, "F");

          // Icon box
          doc.setFillColor(...lerpColor(hexToRgb(primary), [255, 255, 255], 0.82));
          doc.roundedRect(cx + 6, cy + 6, 12, 12, 2, 2, "F");
          doc.setFontSize(9);
          doc.setTextColor(...hexToRgb(primary));
          doc.setFont("helvetica", "bold");
          doc.text(String(idx + 1), cx + 12, cy + 14, { align: "center" });

          // Service name
          doc.setFontSize(10);
          doc.setTextColor(...hexToRgb(primary));
          doc.setFont("helvetica", "bold");
          const nameLines = doc.splitTextToSize(svc.name, svcCardW - 26);
          doc.text(nameLines[0] || svc.name, cx + 22, cy + 14);
        });

        y += Math.ceil(firmServices.length / 2) * (svcCardH + svcCardGap);
      }

      // ════════════════════════════════════════════════════════════════════
      // NEXT STEPS PAGE
      // ════════════════════════════════════════════════════════════════════
      doc.addPage();
      y = pageHeader(doc, "Next Steps");

      // Intro card (HTML .steps-intro: white card, rounded)
      const stepsIntro = pd?.whatHappensNextText ||
        "We\u2019ve made the onboarding process as smooth as possible. Here\u2019s exactly what will happen once you approve this proposal:";
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      const stepsIntroLines = doc.splitTextToSize(stepsIntro, W - M * 2 - 20);
      const stepsIntroCardH = stepsIntroLines.length * 5.5 + 14;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M, y, W - M * 2, stepsIntroCardH, 4, 4, "F");
      doc.setTextColor(75, 85, 99);
      doc.text(stepsIntroLines, M + 10, y + 7);
      y += stepsIntroCardH + 6;

      const steps = [
        {
          title: "Approve & Sign",
          desc: 'Click the "Accept Proposal" button below to proceed. You\'ll be guided through a quick digital signature process for your Engagement Letter.',
          detail: "Timeline: Immediate (less than 2 minutes)",
        },
        {
          title: "Your Personal Onboarding Call",
          desc: `${pd?.advisorName || "Your advisor"} will contact you within 24 hours to schedule your onboarding session. We'll set up your Xero access, Dext account, and walk you through our workflow together.`,
          detail: `Timeline: Within 24-48 hours  |  Duration: 60-90 minute video call`,
        },
        {
          title: "First Month Transition",
          desc: "We'll work closely with you during your first month with weekly check-ins to ensure everything runs smoothly. You'll have direct access to your dedicated team for any questions.",
          detail: "Timeline: Starts immediately after onboarding  |  Includes: Weekly check-ins, direct team access",
        },
      ];

      // Step cards with left border and number circle (matching HTML template)
      steps.forEach((step, idx) => {
        const stepCardH = 40;
        if (y + stepCardH > H - 55) {
          doc.addPage();
          y = pageHeader(doc, "Next Steps");
        }

        // Card background
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(M, y, W - M * 2, stepCardH, 4, 4, "F");

        // Left accent border
        doc.setFillColor(...hexToRgb(primary));
        doc.rect(M, y + 2, 1.5, stepCardH - 4, "F");

        // Step number circle (top right)
        const circleX = W - M - 12;
        const circleY = y + 10;
        doc.setFillColor(...lerpColor(hexToRgb(primary), [255, 255, 255], 0.82));
        doc.circle(circleX, circleY, 7, "F");
        doc.setFontSize(14);
        doc.setTextColor(...hexToRgb(primary));
        doc.setFont("helvetica", "bold");
        doc.text(String(idx + 1), circleX, circleY + 4.5, { align: "center" });

        // Title
        doc.setFontSize(13);
        doc.setTextColor(...hexToRgb(primary));
        doc.setFont("helvetica", "bold");
        doc.text(step.title, M + 7, y + 10);

        // Description
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.setFont("helvetica", "normal");
        const descLines = doc.splitTextToSize(step.desc, W - M * 2 - 35);
        doc.text(descLines.slice(0, 2), M + 7, y + 17);

        // Detail box
        const detailY = y + 28;
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(M + 7, detailY, W - M * 2 - 14, 8, 2, 2, "F");
        doc.setFontSize(7);
        doc.setTextColor(...hexToRgb(primary));
        doc.setFont("helvetica", "bold");
        doc.text(step.detail, M + 10, detailY + 5);

        y += stepCardH + 6;
      });

      // ── Approval section card (HTML .approval-section: white card, centered) ──
      const approvalCardH = 52;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M, y, W - M * 2, approvalCardH, 4, 4, "F");

      // "Ready to Get Started?" heading
      doc.setFontSize(18);
      doc.setTextColor(...hexToRgb(primary));
      doc.setFont("helvetica", "bold");
      doc.text("Ready to Get Started?", W / 2, y + 12, { align: "center" });

      // Accept / Decline buttons
      const btnY = y + 20;
      const btnW = 55;
      const btnH = 11;
      // Accept button (gradient-like primary color)
      doc.setFillColor(...hexToRgb(primary));
      doc.roundedRect(W / 2 - btnW - 5, btnY, btnW, btnH, 5.5, 5.5, "F");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("Accept Proposal", W / 2 - btnW / 2 - 5, btnY + 7.5, { align: "center" });

      // Decline button (gray)
      doc.setFillColor(156, 163, 175);
      doc.roundedRect(W / 2 + 5, btnY, btnW, btnH, 5.5, 5.5, "F");
      doc.text("Decline Proposal", W / 2 + btnW / 2 + 5, btnY + 7.5, { align: "center" });

      // Validity note
      const validDate = pd?.validUntil
        ? new Date(pd.validUntil).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })
        : new Date(Date.now() + 30 * 86400000).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.setFont("helvetica", "normal");
      doc.text(`This proposal is valid for 30 days from ${validDate}`, W / 2, y + 44, { align: "center" });
      y += approvalCardH + 5;

      // ════════════════════════════════════════════════════════════════════
      // CLOSING PAGE — matches HTML .closing-page exactly
      // ════════════════════════════════════════════════════════════════════
      doc.addPage();
      drawGradientBg(doc, primary, secondary);

      const closeQuote = pd?.closingQuote || "";
      const closeAuthor = pd?.closingQuoteAuthor || "";
      if (closeQuote) {
        doc.setFontSize(24);          // HTML .closing-quote: 32px → ~24pt
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "italic");
        const qLines = doc.splitTextToSize(`\u201C${closeQuote}\u201D`, W - 60);
        doc.text(qLines, W / 2, H / 2 - 15, { align: "center" });
        if (closeAuthor) {
          doc.setFontSize(13);        // HTML .closing-author: 18px → ~13pt
          doc.setFont("helvetica", "normal");
          const authorY = H / 2 - 15 + qLines.length * 10 + 10;
          // Author pill (HTML: bg rgba white 0.2, border-radius 25px)
          const authorText = `- ${closeAuthor}`;
          const aw = doc.getTextWidth(authorText) + 20;
          doc.setFillColor(255, 255, 255, 0.2);
          doc.roundedRect((W - aw) / 2, authorY - 5, aw, 12, 6, 6, "F");
          doc.text(authorText, W / 2, authorY + 3, { align: "center" });
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
            const blY = H - blH - 14;
            doc.addImage(footerImg.dataUrl, "PNG", blX, blY, blW, blH, undefined, "FAST");
          } catch { /* skip */ }
        }

        // Page number — bottom right (matching HTML .page-number)
        const footerY = H - 8;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(156, 163, 175);
        doc.text(`Proposal #${refNumber} | Page ${i} of ${pageCount}`, W - M, footerY, { align: "right" });
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
