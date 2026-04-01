/**
 * Shared PDF data contract for ProposalPro.
 * Used by ProposalPDF (react-pdf) and ProposalReviewPDFPreview (jsPDF).
 * Single source of truth - updates here propagate to all PDF generators.
 */

export type ProposalPDFServiceItem = {
  serviceName: string;
  quantity: number;
  unitPrice?: number;
  subtotal: number;
  description?: string;
  billingCategory?: string;
  frequency?: string;
  /** Entity names this service applies to */
  entityLabels?: string[];
};

export interface ProposalPDFTeamMember {
  name: string;
  role?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface ProposalPDFTimelineStep {
  marker: string;
  title: string;
  description: string;
}

export interface ProposalPDFData {
  firmName: string;
  proposalNumber: string;
  title: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  services: ProposalPDFServiceItem[];
  total: number;
  currency: string;
  introText?: string;
  termsText?: string;
  validUntil?: number;
  createdAt: number;
  /** Base64 or URL for firm logo (proposal header) */
  firmLogo?: string;
  brandColors?: {
    primary: string;
    secondary: string;
  };
  /** PDF generation (Settings > Proposals): used across all PDFs */
  footerText?: string;
  footerAddress?: string;
  disclaimer?: string;
  signOffBlock?: string;
  bankingDetails?: string;
  /** Optional cover/first page image URL (Settings > Proposals). */
  coverImageUrl?: string;
  /** Optional footer image URL (Settings > Proposals). */
  footerImageUrl?: string;
  /** Optional last page image/background URL (Settings > Proposals). */
  lastPageImageUrl?: string;

  // ── New template fields ──
  /** About Us HTML content */
  aboutUsHtml?: string;
  /** Firm mission statement */
  missionStatement?: string;
  /** "Why choose us" bullet items */
  whyChooseUsItems?: string[];
  /** Firm values statement */
  valuesStatement?: string;
  /** Firm website */
  website?: string;
  /** Cover page quote */
  coverQuote?: string;
  coverQuoteAuthor?: string;
  /** Closing page quote */
  closingQuote?: string;
  closingQuoteAuthor?: string;
  /** Team members for "Your Dedicated Team" page */
  teamMembers?: ProposalPDFTeamMember[];
  /** Onboarding timeline steps */
  timelineSteps?: ProposalPDFTimelineStep[];
  /** Advisor (proposal creator) details for cover page */
  advisorName?: string;
  advisorTitle?: string;
  advisorEmail?: string;
  advisorPhone?: string;
  /** Fees section intro paragraph */
  feesIntroductionText?: string;
  /** What happens next intro text */
  whatHappensNextText?: string;
  /** Payment terms text */
  paymentTermsText?: string;
  /** All firm service section names (for "All Services We Provide" page) */
  allFirmServices?: { name: string; icon?: string }[];
  /** Entities on this proposal */
  entities?: { name: string; type: string }[];
  /** Monthly / annual / once-off fee subtotals */
  netMonthlyFee?: number;
  netAnnualFee?: number;
  netOnceOffFee?: number;
}
