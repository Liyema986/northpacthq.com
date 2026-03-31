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
}

const GOLD_LINE = [200, 169, 110] as [number, number, number]; // #C8A96E
const NAVY_HEADING = [36, 62, 99] as [number, number, number]; // #243E63

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
}: ProposalReviewPDFPreviewProps) {
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null | undefined>(undefined);
  const [bottomLogoDataUrl, setBottomLogoDataUrl] = useState<string | null | undefined>(undefined);
  const [coverPageDataUrl, setCoverPageDataUrl] = useState<string | null | undefined>(undefined);
  const [closingPageDataUrl, setClosingPageDataUrl] = useState<string | null | undefined>(undefined);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // When proposalData is set (e.g. /proposals/view), use firm Convex URLs — do not fall back to missing /images/logo.png.
  useEffect(() => {
    const loadLocalAsset = (path: string): Promise<string | null> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = path;
        img.onload = () => {
          const scale = 2;
          const canvas = document.createElement("canvas");
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png", 1.0));
          } else resolve(null);
        };
        img.onerror = () => resolve(null);
      });

    if (proposalData?.coverImageUrl) {
      setCoverPageDataUrl(proposalData.coverImageUrl);
    }

    if (proposalData?.firmLogo) {
      setLogoDataUrl(proposalData.firmLogo);
      setBottomLogoDataUrl(proposalData.firmLogo);
      if (!proposalData.coverImageUrl) {
        void loadLocalAsset("/images/coverpage.png")
          .then((c) => c ?? loadLocalAsset("/coverpage.png"))
          .then((c) => setCoverPageDataUrl(c ?? null));
      }
      if (proposalData.lastPageImageUrl) {
        setClosingPageDataUrl(proposalData.lastPageImageUrl);
      } else {
        void loadLocalAsset("/images/closingpage.png")
          .then((c) => c ?? loadLocalAsset("/closingpage.png"))
          .then((c) => setClosingPageDataUrl(c ?? null));
      }
      return;
    }

    if (proposalData) {
      setLogoDataUrl(null);
      setBottomLogoDataUrl(null);
      if (!proposalData.coverImageUrl) {
        void loadLocalAsset("/images/coverpage.png")
          .then((c) => c ?? loadLocalAsset("/coverpage.png"))
          .then((c) => setCoverPageDataUrl(c ?? null));
      }
      if (proposalData.lastPageImageUrl) {
        setClosingPageDataUrl(proposalData.lastPageImageUrl);
      } else {
        void loadLocalAsset("/images/closingpage.png")
          .then((c) => c ?? loadLocalAsset("/closingpage.png"))
          .then((c) => setClosingPageDataUrl(c ?? null));
      }
      return;
    }

    const run = async () => {
      let top: string | null = await loadLocalAsset("/images/logo.png");
      if (!top) top = await loadLocalAsset("/logo.png");
      setLogoDataUrl(top);
      let bottom: string | null = await loadLocalAsset("/images/bottomlogo.png");
      if (!bottom) bottom = await loadLocalAsset("/bottomlogo.png");
      if (!bottom) bottom = await loadLocalAsset("/logo.png");
      setBottomLogoDataUrl(bottom ?? top);
      let cover: string | null = await loadLocalAsset("/images/coverpage.png");
      if (!cover) cover = await loadLocalAsset("/coverpage.png");
      setCoverPageDataUrl(cover);
      let closing: string | null = await loadLocalAsset("/images/closingpage.png");
      if (!closing) closing = await loadLocalAsset("/closingpage.png");
      setClosingPageDataUrl(closing);
    };
    void run();
  }, [
    !!proposalData,
    proposalData?.firmLogo,
    proposalData?.coverImageUrl,
    proposalData?.lastPageImageUrl,
  ]);

  useEffect(() => {
    return () => {
      if (pdfDataUrl && pdfDataUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pdfDataUrl);
      }
    };
  }, [pdfDataUrl]);

  useEffect(() => {
    if (logoDataUrl === undefined || coverPageDataUrl === undefined) return;
    generatePDF();
  }, [
    logoDataUrl,
    bottomLogoDataUrl,
    coverPageDataUrl,
    closingPageDataUrl,
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
    proposalData,
  ]);

  const addBranding = async (doc: jsPDF, logoData: string | null | undefined, pageWidth: number, margin: number): Promise<number> => {
    const logoX = 2;
    const logoY = 2;
    if (!logoData) {
      const lineY = logoY + 5;
      doc.setLineWidth(0.3);
      doc.setDrawColor(...GOLD_LINE);
      doc.line(margin, lineY, pageWidth - margin, lineY);
      return lineY + 8;
    }
    try {
      const img = new Image();
      const loadImage = (): Promise<{ width: number; height: number }> => {
        return new Promise((resolve, reject) => {
          img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
          img.onerror = () => reject(new Error("Failed to load logo"));
          img.src = logoData;
          if (img.complete && (img.naturalWidth > 0 || img.width > 0)) {
            resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
          }
        });
      };
      const dimensions = await Promise.race([
        loadImage(),
        new Promise<{ width: number; height: number }>((_, reject) => setTimeout(() => reject(new Error("Logo load timeout")), 2000)),
      ]);
      const targetHeight = 55;
      const aspectRatio = dimensions.width / dimensions.height;
      const logoHeight = targetHeight;
      const logoWidth = targetHeight * aspectRatio;
      doc.addImage(logoData, "PNG", logoX, logoY, logoWidth, logoHeight, undefined, "FAST");
      const lineY = logoY + logoHeight * 0.7;
      const lineStartX = logoX + logoWidth - 10;
      doc.setLineWidth(0.3);
      doc.setDrawColor(...GOLD_LINE);
      doc.line(lineStartX, lineY, pageWidth, lineY);
      return logoY + logoHeight + 10;
    } catch {
      const lineY = logoY + 5;
      doc.setLineWidth(0.3);
      doc.setDrawColor(...GOLD_LINE);
      doc.line(margin, lineY, pageWidth - margin, lineY);
      return lineY + 8;
    }
  };

  const generatePDF = async () => {
    try {
      setIsGenerating(true);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;

      let contactName: string;
      let clientCompany: string;
      let contactEmail: string;
      let contactPhone: string;
      let refNumber: string;
      let servicesWithPrices: { name: string; price: number }[];
      let totalNet: number;
      let allServiceNames: string[];
      let customIntroText: string | undefined;
      const currency = proposalData?.currency || "ZAR";

      if (proposalData) {
        contactName = proposalData.clientName || "Client";
        clientCompany = proposalData.clientName || "Client";
        contactEmail = getDisplayEmail(proposalData.clientEmail) || "";
        contactPhone = proposalData.clientPhone || "";
        refNumber = proposalData.proposalNumber;
        servicesWithPrices = (proposalData.services || []).map((s) => ({
          name: s.serviceName,
          price: typeof s.subtotal === "number" ? s.subtotal : (s.unitPrice ?? 0) * (s.quantity || 1),
        }));
        totalNet = typeof proposalData.total === "number" ? proposalData.total : servicesWithPrices.reduce((sum, s) => sum + s.price, 0);
        allServiceNames = servicesWithPrices.map((s) => s.name);
        customIntroText = proposalData.introText ? stripHtml(proposalData.introText) : undefined;
      } else {
        contactName = selectedClientData?.contactName || selectedClientData?.companyName || "Not specified";
        clientCompany = selectedClientData?.companyName || contactName;
        contactEmail = getDisplayEmail(selectedClientData?.email) || "";
        contactPhone = selectedClientData?.phone || "";

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

      // ========== PAGE 1: COVER PAGE ==========
      let hasCoverPage = false;
      if (coverPageDataUrl) {
        try {
          doc.addImage(coverPageDataUrl, "PNG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
          doc.addPage();
          hasCoverPage = true;
        } catch {
          // skip cover page on error
        }
      }

      // ========== PAGE 2: INTRODUCTION / TOC ==========
      let currentY = await addBranding(doc, logoDataUrl, pageWidth, margin);

      const titleY = currentY + 15;
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text("Proposal for", pageWidth / 2, titleY, { align: "center" });

      doc.setFontSize(24);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text(clientCompany || "Client Name", pageWidth / 2, titleY + 12, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text(`Proposal #${refNumber}`, pageWidth / 2, titleY + 20, { align: "center" });

      // CREATED BY / CREATED FOR table
      const gridY = titleY + 40;
      autoTable(doc, {
        startY: gridY,
        head: [["CREATED BY", "CREATED FOR"]],
        body: [
          [firmName, contactName],
          ["Advisor", "Client"],
          ["", contactEmail || "N/A"],
          ["", contactPhone || "N/A"],
        ],
        theme: "grid",
        headStyles: {
          fillColor: NAVY_HEADING,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "left",
          fontSize: 10,
          cellPadding: 5,
        },
        bodyStyles: {
          halign: "left",
          fontSize: 10,
          cellPadding: 5,
          textColor: [0, 0, 0],
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        },
        columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: "auto" } },
        margin: { left: margin, right: margin },
        alternateRowStyles: { fillColor: [255, 255, 255] },
      });

      // CONTENTS section
      const tocY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
      doc.setFontSize(16);
      doc.setTextColor(...NAVY_HEADING);
      doc.setFont("helvetica", "bold");
      doc.text("CONTENTS", margin, tocY);

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, tocY + 2, pageWidth - margin, tocY + 2);

      let listY = tocY + 15;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");

      const tocSections = [
        { title: "INTRODUCTION", page: 3 },
        { title: "FEES", page: 3 },
        { title: "WHAT HAPPENS NEXT?", page: 4 },
      ];
      tocSections.forEach((sec) => {
        doc.text(sec.title, margin, listY);
        const dots = "................................................................................................";
        doc.text(dots, margin + doc.getTextWidth(sec.title) + 2, listY);
        doc.setFillColor(255, 255, 255);
        doc.rect(pageWidth - margin - 8, listY - 4, 10, 5, "F");
        doc.text(String(sec.page), pageWidth - margin, listY, { align: "right" });
        listY += 8;
      });

      // ========== PAGE 3: INTRODUCTION & FEES ==========
      doc.addPage();
      currentY = await addBranding(doc, logoDataUrl, pageWidth, margin);

      doc.setFontSize(14);
      doc.setTextColor(...NAVY_HEADING);
      doc.setFont("helvetica", "bold");
      doc.text("INTRODUCTION", margin, currentY);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
      currentY += 10;

      const introParagraphs = customIntroText
        ? customIntroText.split(/\n+/).filter(Boolean)
        : [
            `Hello ${contactName}!`,
            "",
            "Welcome to our proposal, put together just for you.",
            `We are excited to present it to you, as we hope that it marks the start of an exciting and positive road ahead between ${firmName} and ${clientCompany || "your company"}.`,
            "This proposal outlines the Services we discussed that, we believe, will help drive your business to the next level of success.",
          ];
      introParagraphs.forEach((line) => {
        const splitText = doc.splitTextToSize(line, pageWidth - margin * 2);
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.text(splitText, margin, currentY);
        currentY += splitText.length * 5 + 2;
      });
      currentY += 10;

      // FEES section
      doc.setFontSize(14);
      doc.setTextColor(...NAVY_HEADING);
      doc.setFont("helvetica", "bold");
      doc.text("FEES", margin, currentY);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
      currentY += 10;

      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      const feesSubtext =
        'This section outlines the services included in this proposal and the fees associated with those services. For a full breakdown of what each of these services includes, please check out the "The Services You\'ve Selected" section of this Proposal.';
      const splitSubtext = doc.splitTextToSize(feesSubtext, pageWidth - margin * 2);
      doc.text(splitSubtext, margin, currentY);
      currentY += splitSubtext.length * 5 + 5;

      doc.setFontSize(12);
      doc.setTextColor(...NAVY_HEADING);
      doc.setFont("helvetica", "bold");
      doc.text("One-Off Costs", margin, currentY);
      currentY += 6;

      const feeRows: string[][] = [];
      if (servicesWithPrices.length > 0) {
        servicesWithPrices.forEach((s) => {
          feeRows.push([s.name, s.price.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })]);
        });
      } else {
        feeRows.push(["No services selected", "-"]);
      }

      autoTable(doc, {
        startY: currentY,
        head: [["SERVICES", `COSTS\n${currency}`]],
        body: feeRows,
        theme: "striped",
        headStyles: {
          fillColor: NAVY_HEADING,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "left",
        },
        columnStyles: {
          0: { cellWidth: "auto" },
          1: { cellWidth: 40, halign: "right" },
        },
        margin: { left: margin, right: margin },
      });

      currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      const tax = totalNet * 0.15;
      const totalGross = totalNet + tax;
      const totalsData = [
        ["Net Total", totalNet.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
        ["Tax", tax.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
        ["Gross Total", totalGross.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
      ];
      const totalsWidth = 80;
      const totalsMarginLeft = pageWidth - margin - totalsWidth;
      autoTable(doc, {
        startY: currentY,
        body: totalsData,
        theme: "grid",
        bodyStyles: {
          halign: "right",
          fillColor: [50, 50, 50],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: totalsWidth / 2, halign: "right" },
          1: { cellWidth: totalsWidth / 2, halign: "right" },
        },
        margin: { left: totalsMarginLeft },
        alternateRowStyles: { fillColor: [100, 100, 100] },
      });

      // ========== PAGE 4: WHAT HAPPENS NEXT & ALL THE SERVICES WE PROVIDE ==========
      doc.addPage();
      currentY = await addBranding(doc, logoDataUrl, pageWidth, margin);

      doc.setFontSize(14);
      doc.setTextColor(...NAVY_HEADING);
      doc.setFont("helvetica", "bold");
      doc.text("WHAT HAPPENS NEXT?", margin, currentY);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
      currentY += 10;

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.text("Moving over to us and getting the ball rolling couldn't be simpler:", margin, currentY);
      currentY += 8;

      doc.setFont("helvetica", "bold");
      doc.text("STEP 1", margin, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(" – Click to approve this Proposal and digitally sign your Engagement Letter.", margin + 15, currentY);
      currentY += 8;

      const step2Text =
        " – We'll get in touch with you and sort EVERYTHING! And don't worry, we will help you every step of the way to set up everything that is needed.";
      const splitStep2 = doc.splitTextToSize(step2Text, pageWidth - margin - 15 - margin);
      doc.setFont("helvetica", "bold");
      doc.text("STEP 2", margin, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(splitStep2, margin + 15, currentY);
      currentY += splitStep2.length * 5 + 15;

      const buttonWidth = 80;
      const buttonHeight = 15;
      const buttonX = (pageWidth - buttonWidth) / 2;
      doc.setFillColor(...NAVY_HEADING);
      doc.roundedRect(buttonX, currentY, buttonWidth, buttonHeight, 2, 2, "F");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.text("APPROVE MY PROPOSAL", pageWidth / 2, currentY + 9, { align: "center" });
      doc.setFontSize(9);
      doc.text(`#${refNumber}`, pageWidth / 2, currentY + 13, { align: "center" });
      currentY += buttonHeight + 10;

      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.text(
        `This proposal is valid for 30 days from ${new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}.`,
        pageWidth / 2,
        currentY,
        { align: "center" }
      );
      currentY += 20;

      doc.setFontSize(14);
      doc.setTextColor(...NAVY_HEADING);
      doc.setFont("helvetica", "bold");
      doc.text("ALL THE SERVICES WE PROVIDE", margin, currentY);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
      currentY += 10;

      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      const servicesText =
        "Here is a full explanation of ALL the services we provide. Only the ones, which are listed in the FEE SECTION of this Proposal, are the ones which apply to you, but we thought you'd like a reminder of everything we have to offer your business now, and in the future:";
      const splitServicesText = doc.splitTextToSize(servicesText, pageWidth - margin * 2);
      doc.text(splitServicesText, margin, currentY);
      currentY += splitServicesText.length * 5 + 5;

      if (allServiceNames.length > 0) {
        allServiceNames.forEach((item) => {
          doc.text(`– ${item}`, margin + 5, currentY);
          currentY += 6;
        });
      } else {
        doc.text("– No services have been selected for this proposal.", margin + 5, currentY);
        currentY += 6;
      }

      // ========== PAGE 5: CLOSING PAGE (proposalData sign-off/banking/last-page image or static) ==========
      let hasClosingPage = false;
      const hasProposalDataClosing =
        proposalData?.signOffBlock || proposalData?.bankingDetails || proposalData?.lastPageImageUrl;

      if (hasProposalDataClosing) {
        try {
          doc.addPage();
          if (proposalData?.lastPageImageUrl) {
            const lastPageImg = new Image();
            lastPageImg.crossOrigin = "anonymous";
            const lastPageDataUrl = await new Promise<string | null>((resolve) => {
              lastPageImg.onload = () => {
                try {
                  const canvas = document.createElement("canvas");
                  canvas.width = lastPageImg.naturalWidth || lastPageImg.width;
                  canvas.height = lastPageImg.naturalHeight || lastPageImg.height;
                  const ctx = canvas.getContext("2d");
                  if (ctx) {
                    ctx.drawImage(lastPageImg, 0, 0);
                    resolve(canvas.toDataURL("image/png"));
                  } else resolve(null);
                } catch {
                  resolve(null);
                }
              };
              lastPageImg.onerror = () => resolve(null);
              lastPageImg.src = proposalData.lastPageImageUrl!;
              if (lastPageImg.complete && (lastPageImg.naturalWidth > 0 || lastPageImg.width > 0))
                lastPageImg.onload?.({} as Event);
            });
            if (lastPageDataUrl) {
              doc.addImage(lastPageDataUrl, "PNG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
            }
          }

          let closeY = 25;
          if (proposalData?.signOffBlock || proposalData?.bankingDetails) {
            doc.setFillColor(255, 255, 255);
            doc.rect(margin, 20, pageWidth - margin * 2, pageHeight - 40, "F");
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.2);
            doc.rect(margin, 20, pageWidth - margin * 2, pageHeight - 40, "S");

            if (proposalData?.signOffBlock) {
              doc.setFontSize(12);
              doc.setTextColor(...NAVY_HEADING);
              doc.setFont("helvetica", "bold");
              doc.text("Sign-off", margin + 8, closeY);
              closeY += 8;
              doc.setFontSize(10);
              doc.setTextColor(0, 0, 0);
              doc.setFont("helvetica", "normal");
              const signOffLines = doc.splitTextToSize(
                stripHtml(proposalData.signOffBlock),
                pageWidth - margin * 2 - 16
              );
              signOffLines.forEach((line: string) => {
                doc.text(line, margin + 8, closeY);
                closeY += 5;
              });
              closeY += 12;
            }
            if (proposalData?.bankingDetails) {
              doc.setFontSize(12);
              doc.setTextColor(...NAVY_HEADING);
              doc.setFont("helvetica", "bold");
              doc.text("Banking details", margin + 8, closeY);
              closeY += 8;
              doc.setFontSize(10);
              doc.setTextColor(0, 0, 0);
              doc.setFont("helvetica", "normal");
              const bankLines = doc.splitTextToSize(
                stripHtml(proposalData.bankingDetails),
                pageWidth - margin * 2 - 16
              );
              bankLines.forEach((line: string) => {
                doc.text(line, margin + 8, closeY);
                closeY += 5;
              });
            }
          }
          hasClosingPage = true;
        } catch {
          // skip closing page on error
        }
      } else if (closingPageDataUrl) {
        try {
          doc.addPage();
          doc.addImage(closingPageDataUrl, "PNG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
          hasClosingPage = true;
        } catch {
          // skip closing page on error
        }
      }

      // ========== FOOTERS ==========
      const pageCount = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
      const startPage = hasCoverPage ? 2 : 1;
      const endPage = hasClosingPage ? pageCount - 1 : pageCount;
      const footerText = proposalData?.footerText;
      const footerAddress = proposalData?.footerAddress;
      const disclaimer = proposalData?.disclaimer;

      for (let i = startPage; i <= endPage; i++) {
        doc.setPage(i);

        if (bottomLogoDataUrl) {
          try {
            const bottomImg = new Image();
            const loadBottomImage = (): Promise<{ width: number; height: number }> => {
              return new Promise((resolve, reject) => {
                bottomImg.onload = () =>
                  resolve({ width: bottomImg.naturalWidth || bottomImg.width, height: bottomImg.naturalHeight || bottomImg.height });
                bottomImg.onerror = () => reject(new Error("Failed to load bottom logo"));
                bottomImg.src = bottomLogoDataUrl;
                if (bottomImg.complete && (bottomImg.naturalWidth > 0 || bottomImg.width > 0)) {
                  resolve({ width: bottomImg.naturalWidth || bottomImg.width, height: bottomImg.naturalHeight || bottomImg.height });
                }
              });
            };
            await Promise.race([
              loadBottomImage(),
              new Promise<{ width: number; height: number }>((_, reject) =>
                setTimeout(() => reject(new Error("Bottom logo load timeout")), 2000)
              ),
            ]);
            const bottomLogoHeight = 25;
            const bottomAspectRatio = (bottomImg.naturalWidth || bottomImg.width) / (bottomImg.naturalHeight || bottomImg.height);
            const bottomLogoWidth = bottomLogoHeight * bottomAspectRatio;
            const bottomLogoX = pageWidth - bottomLogoWidth;
            const bottomLogoY = pageHeight - bottomLogoHeight;
            doc.addImage(bottomLogoDataUrl, "PNG", bottomLogoX, bottomLogoY, bottomLogoWidth, bottomLogoHeight, undefined, "FAST");
          } catch {
            // skip bottom logo on error
          }
        }

        let footerY = pageHeight - 5;
        if (footerText || footerAddress || disclaimer) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          const footerLines: string[] = [];
          if (footerText) footerLines.push(footerText.trim());
          if (footerAddress) footerLines.push(footerAddress.trim());
          if (disclaimer) footerLines.push(disclaimer.trim());
          const combined = footerLines.join(" | ");
          const splitFooter = doc.splitTextToSize(combined, pageWidth - margin * 2);
          footerY = pageHeight - 5 - splitFooter.length * 4;
          doc.text(splitFooter, pageWidth / 2, footerY, { align: "center" });
          footerY += splitFooter.length * 4 + 2;
        }
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${pageCount} - ${firmName}`, margin, footerY, { align: "left" });
      }

      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      setPdfDataUrl(url);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF preview");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pdfDataUrl) return;
    try {
      const link = document.createElement("a");
      link.href = pdfDataUrl;
      const name = selectedClientData?.companyName || selectedClientData?.contactName || "Client";
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
    <div className="flex flex-col h-full min-h-[600px] bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden relative">
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
