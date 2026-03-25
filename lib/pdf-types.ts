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
};

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
}
