/**
 * Build ProposalPDFData from proposal + client + firm.
 * Single function for deriving PDF content - used by proposals/[id], proposals/view/[token], Settings preview.
 */
import type { Id } from "@/convex/_generated/dataModel";
import type { ProposalPDFData } from "./pdf-types";
import { getDisplayEmail } from "./utils";

export type ProposalForPDF = {
  proposalNumber: string;
  title: string;
  clientId: Id<"clients">;
  total: number;
  currency: string;
  introText?: string;
  termsText?: string;
  validUntil?: number;
  createdAt: number;
  services?: Array<{
    serviceName: string;
    quantity: number;
    unitPrice?: number;
    subtotal: number;
  }>;
};

export type ClientForPDF = {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
};

export type FirmForPDF = {
  name: string;
  brandColors?: { primary: string; secondary: string };
  pdfFooterText?: string;
  pdfFooterAddress?: string;
  pdfDisclaimer?: string;
  pdfSignOffBlock?: string;
  pdfBankingDetails?: string;
  /** Pass footer/last-page image URLs via overrides when building PDF data (storage IDs resolved by caller). */
};

export function buildProposalPDFData(
  proposal: ProposalForPDF,
  client: ClientForPDF | null,
  firm: FirmForPDF,
  overrides?: Partial<ProposalPDFData>
): ProposalPDFData {
  const clientName =
    client?.companyName?.trim() ||
    client?.contactName?.trim() ||
    "Unknown Client";
  const clientEmail = client?.email ? getDisplayEmail(client.email) : undefined;
  const services = proposal.services ?? [];

  const data: ProposalPDFData = {
    firmName: firm.name,
    proposalNumber: proposal.proposalNumber,
    title: proposal.title || "Proposal",
    clientName,
    clientEmail,
    clientPhone: client?.phone,
    services,
    total: proposal.total,
    currency: proposal.currency || "ZAR",
    introText: proposal.introText,
    termsText: proposal.termsText,
    validUntil: proposal.validUntil,
    createdAt: proposal.createdAt,
    brandColors: firm.brandColors,
    footerText: firm.pdfFooterText,
    footerAddress: firm.pdfFooterAddress,
    disclaimer: firm.pdfDisclaimer,
    signOffBlock: firm.pdfSignOffBlock,
    bankingDetails: firm.pdfBankingDetails,
  };

  return overrides ? { ...data, ...overrides } : data;
}
