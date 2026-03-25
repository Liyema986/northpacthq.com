"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle,
  X,
  XCircle,
  AlertTriangle,
  FileText,
  Loader2,
  FileDown,
  UserCircle,
  Calendar,
  Clock,
} from "lucide-react";
import { StatsCard, statCardConfigs } from "@/components/ui/stats-card";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { SignaturePad } from "@/components/signature/SignaturePad";
import { ProposalReviewPDFPreview } from "@/components/pdf/ProposalReviewPDFPreview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ProposalOutcomePage } from "@/components/proposals/ProposalOutcomePage";
import { FirmLogoMark } from "@/components/proposals/FirmLogoMark";

function LinkExpiresCard({
  expiresDateFormatted,
  timeLeftLabel,
  daysLeft,
  expiresAtMs,
  timeRemainingPercent,
}: {
  expiresDateFormatted: string | null;
  timeLeftLabel: string;
  daysLeft: number | null;
  expiresAtMs: number | null;
  timeRemainingPercent: number;
}) {
  const colors = statCardConfigs.Clock ?? statCardConfigs.default;
  return (
    <div
      className={cn(
        colors.bg,
        "p-4 border rounded-md transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600 cursor-default",
        colors.borderColor
      )}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn("w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0", colors.iconBg)}>
          <Clock size={15} className={colors.iconColor} strokeWidth={2} />
        </div>
        <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate leading-tight">
          Link expires
        </p>
      </div>
      <p className={cn("text-2xl font-semibold mb-1.5 leading-none tracking-tight", colors.textColor)}>
        {expiresDateFormatted ?? "—"}
      </p>
      <p
        className={cn(
          "text-[10px] font-normal truncate leading-tight",
          daysLeft !== null && daysLeft <= 0 && "text-red-600 dark:text-red-400",
          daysLeft !== null && daysLeft > 0 && daysLeft <= 3 && "text-amber-600 dark:text-amber-400",
          (daysLeft === null || daysLeft > 3) && "text-slate-500 dark:text-slate-400"
        )}
      >
        {timeLeftLabel}
      </p>
      {expiresAtMs != null && (
        <div className="mt-2 w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" aria-hidden>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${timeRemainingPercent}%`,
              backgroundColor:
                timeRemainingPercent > 30 ? "var(--color-primary, #3b82f6)" : timeRemainingPercent > 0 ? "#f59e0b" : "#ef4444",
            }}
          />
        </div>
      )}
    </div>
  );
}

function formatCurrency(amount: number, currency: string = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount || 0);
}

export default function ProposalViewPage() {
  const params = useParams();
  const token = params.token as string;

  const [signerName, setSignerName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [action, setAction] = useState<"accepted" | "rejected" | null>(null);
  const [clientInfo, setClientInfo] = useState({
    ip: "Client IP",
    userAgent: "",
  });

  const session = useQuery(api.proposalAccept.getProposalAcceptSession, {
    token,
  });
  const acceptProposal = useMutation(api.proposalAccept.acceptProposal);
  const rejectProposal = useMutation(api.proposalAccept.rejectProposal);

  useEffect(() => {
    setClientInfo({
      ip: "Client IP",
      userAgent: navigator.userAgent,
    });
  }, []);

  const handleAccept = async () => {
    if (!signerName.trim()) {
      toast.error("Please enter your full name");
      return;
    }
    if (!signatureData) {
      toast.error("Please sign in the box above");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await acceptProposal({
        token,
        signerName: signerName.trim(),
        signatureImage: signatureData,
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      });
      if (result.success) {
        setAction("accepted");
        toast.success("Proposal accepted successfully!");
      } else {
        toast.error(result.error || "Failed to accept");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    setShowRejectConfirm(false);
    setIsSubmitting(true);
    try {
      const result = await rejectProposal({
        token,
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      });
      if (result.success) {
        setAction("rejected");
        toast.success("Proposal declined");
      } else {
        toast.error(result.error || "Failed to decline");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state first
  if (!session) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <header className="relative w-full">
          <div className="relative h-28 sm:h-32 w-full bg-primary overflow-hidden">
            <div className="absolute top-0 right-0 w-[50%] h-full bg-white/5 skew-x-12 transform origin-top-right z-0" />
            <div className="absolute bottom-0 left-0 w-[30%] h-[50%] bg-black/5 rounded-tr-[100px] z-0" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 md:px-8 lg:px-10 z-20">
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-center gap-4 -mb-4 sm:-mb-6 min-w-0 flex-1">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-center shrink-0 overflow-hidden p-1.5">
                  <Skeleton className="w-full h-full rounded-lg min-h-[4rem]" />
                </div>
                <div className="pb-1 min-w-0 space-y-2">
                  <Skeleton className="h-5 w-32 bg-white/30" />
                  <Skeleton className="h-3 w-24 bg-white/20" />
                </div>
              </div>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-white/20 border border-white/20 text-white mb-5 backdrop-blur-sm shrink-0">Proposal</span>
            </div>
          </div>
        </header>
        <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 pt-12 sm:pt-14 pb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 border rounded-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2.5 mb-3">
                  <Skeleton className="w-8 h-8 rounded-md shrink-0" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-7 w-24 mb-2" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          <div className="mt-8">
            <div className="grid w-full grid-cols-2 h-10 mb-6 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0 gap-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
              <Skeleton className="h-full rounded-l-lg rounded-r-none" />
              <Skeleton className="h-full rounded-r-lg rounded-l-none" />
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3 px-4 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Already accepted or rejected (returning to link) - show outcome page with confetti for accepted
  const resolved = session as {
    resolvedStatus?: "accepted" | "rejected";
    firmName?: string;
    proposalTitle?: string;
    proposalNumber?: string;
    signerName?: string;
    acceptedAt?: number;
    firmLogoUrl?: string | null;
    clientEmail?: string;
  };
  if (resolved?.resolvedStatus) {
    return (
      <ProposalOutcomePage
        variant={resolved.resolvedStatus}
        firmName={resolved.firmName ?? "Your firm"}
        proposalTitle={resolved.proposalTitle}
        proposalNumber={resolved.proposalNumber}
        signerName={resolved.signerName}
        acceptedAt={resolved.acceptedAt}
        firmLogoUrl={resolved.firmLogoUrl}
        clientEmail={resolved.clientEmail}
        triggerConfettiOnMount={resolved.resolvedStatus === "accepted"}
      />
    );
  }

  // Link not found or expired - show clean error
  if (session?.error) {
    const isExpired = session.error?.toLowerCase().includes("expired");
    const isNotFound = session.error?.toLowerCase().includes("not found") || session.error?.toLowerCase().includes("link not found");
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC] dark:bg-muted/30">
        <div className="max-w-md w-full text-center">
          <AlertTriangle className="h-16 w-16 mx-auto text-amber-500 dark:text-amber-400 mb-4" />
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {isExpired ? "Link expired" : isNotFound ? "Link not found" : "Something went wrong"}
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400 mt-2">
            {session.error}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-4">
            Please contact the sender if you need a new link.
          </p>
        </div>
      </div>
    );
  }

  const {
    proposal,
    firmName,
    clientName,
    clientEmail,
    firmLogoUrl,
    brandColors,
    pdfFooterText,
    pdfFooterAddress,
    pdfDisclaimer,
    pdfSignOffBlock,
    pdfBankingDetails,
    pdfCoverImageUrl,
    pdfFooterImageUrl,
    pdfLastPageImageUrl,
  } = session as typeof session & {
    pdfFooterText?: string;
    pdfFooterAddress?: string;
    pdfDisclaimer?: string;
    pdfSignOffBlock?: string;
    pdfBankingDetails?: string;
    pdfCoverImageUrl?: string;
    pdfFooterImageUrl?: string;
    pdfLastPageImageUrl?: string;
  };

  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC] dark:bg-muted/30">
        <p className="text-slate-600 dark:text-slate-400">Unable to load proposal.</p>
      </div>
    );
  }

  const firmNameSafe = firmName ?? "Your firm";
  const clientNameSafe = clientName ?? "—";

  const pdfUrl = proposal.pdfStorageUrl ?? null;

  // Same design as /proposals/new step 6 (cover, logos, closing page); use firm assets from session (shared contract)
  const proposalDataForPdf = {
    firmName: firmNameSafe,
    clientName: clientNameSafe,
    clientEmail: clientEmail ?? "",
    proposalNumber: proposal.proposalNumber,
    title: proposal.title,
    services: (proposal.services ?? []).map(
      (s: { serviceName: string; quantity: number; unitPrice?: number; subtotal: number }) => ({
        serviceName: s.serviceName,
        quantity: s.quantity,
        unitPrice: s.unitPrice ?? (s.quantity ? s.subtotal / s.quantity : 0),
        subtotal: s.subtotal,
      })
    ),
    total: proposal.total ?? 0,
    currency: proposal.currency ?? "ZAR",
    introText: proposal.introText,
    termsText: proposal.termsText,
    validUntil: (proposal as { validUntil?: number }).validUntil,
    createdAt: (proposal as { createdAt?: number }).createdAt ?? Date.now(),
    firmLogo: firmLogoUrl ?? undefined,
    brandColors: brandColors ?? undefined,
    footerText: pdfFooterText,
    footerAddress: pdfFooterAddress,
    disclaimer: pdfDisclaimer,
    signOffBlock: pdfSignOffBlock,
    bankingDetails: pdfBankingDetails,
    coverImageUrl: pdfCoverImageUrl,
    footerImageUrl: pdfFooterImageUrl,
    lastPageImageUrl: pdfLastPageImageUrl,
  };

  // Just accepted or rejected - show outcome page (confetti for accepted)
  if (action === "accepted" || action === "rejected") {
    return (
      <ProposalOutcomePage
        variant={action}
        firmName={firmNameSafe}
        proposalTitle={proposal.title}
        proposalNumber={proposal.proposalNumber}
        signerName={action === "accepted" ? signerName : undefined}
        acceptedAt={action === "accepted" ? Date.now() : undefined}
        firmLogoUrl={firmLogoUrl}
        clientEmail={clientEmail || undefined}
        triggerConfettiOnMount={action === "accepted"}
      />
    );
  }

  const services = proposal.services ?? [];
  const subtotalFromServices = services.reduce((sum: number, s: { subtotal: number }) => sum + (s.subtotal ?? 0), 0);
  const proposalTotal = proposal.total ?? subtotalFromServices;
  const createdDate = proposal.createdAt
    ? new Date(proposal.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const expiresAtMs = session.session?.expiresAt ? new Date(session.session.expiresAt).getTime() : null;
  const nowMs = Date.now();
  const createdMs = proposal.createdAt ? new Date(proposal.createdAt).getTime() : nowMs;
  const totalWindowMs = expiresAtMs && createdMs ? Math.max(1, expiresAtMs - createdMs) : 1;
  const remainingMs = expiresAtMs ? Math.max(0, expiresAtMs - nowMs) : 0;
  const timeRemainingPercent = expiresAtMs ? Math.min(100, (remainingMs / totalWindowMs) * 100) : 100;
  const expiresDateFormatted = expiresAtMs
    ? new Date(expiresAtMs).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const daysLeft = expiresAtMs ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : null;
  const timeLeftLabel =
    daysLeft === null
      ? "—"
      : daysLeft <= 0
        ? "Expired"
        : daysLeft === 1
          ? "1 day left"
          : `${daysLeft} days left`;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Hero-style header: bg-primary + same background decorations as landing Hero */}
      <header className="relative w-full">
        <div className="relative h-28 sm:h-32 w-full bg-primary overflow-hidden">
          <div className="absolute top-0 right-0 w-[50%] h-full bg-white/5 skew-x-12 transform origin-top-right z-0" />
          <div className="absolute bottom-0 left-0 w-[30%] h-[50%] bg-black/5 rounded-tr-[100px] z-0" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 md:px-8 lg:px-10 z-20">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-center gap-4 -mb-4 sm:-mb-6 min-w-0 flex-1">
              <FirmLogoMark firmName={firmNameSafe} firmLogoUrl={firmLogoUrl} alt={`${firmNameSafe} logo`} />
              <div className="pb-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white truncate drop-shadow-sm" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
                  {firmNameSafe}
                </h1>
                <p className="text-xs text-white/90 mt-0.5 truncate drop-shadow-sm" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
                  {proposal.title}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-white/20 border border-white/20 text-white shadow-sm mb-5 backdrop-blur-sm shrink-0" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}>
              Proposal
            </span>
          </div>
        </div>
      </header>

      {/* Proposal info: dashboard-style stats cards with icons, compact and readable */}
      <div className="w-full px-4 sm:px-6 md:px-8 lg:px-10 pt-12 sm:pt-14 pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatsCard
            title="Proposal to"
            value={clientNameSafe}
            comparison={clientEmail || "—"}
            icon={UserCircle}
            iconVariant="UserCircle"
          />
          <StatsCard
            title="Date"
            value={createdDate}
            comparison={firmNameSafe}
            icon={Calendar}
            iconVariant="FileText"
          />
          <StatsCard
            title="Proposal number"
            value={`N°: ${proposal.proposalNumber}`}
            comparison="Reference"
            icon={FileText}
            iconVariant="FileText"
          />
          {/* Link expires card: same stats style + timeline bar */}
          <LinkExpiresCard
            expiresDateFormatted={expiresDateFormatted}
            timeLeftLabel={timeLeftLabel}
            daysLeft={daysLeft}
            expiresAtMs={expiresAtMs}
            timeRemainingPercent={timeRemainingPercent}
          />
        </div>

        {/* Tabs: Summary (invoice content) | PDF */}
        <div className="mt-8">
          <Tabs defaultValue={pdfUrl ? "pdf" : "summary"} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-10 mb-6 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0 gap-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
              <TabsTrigger value="summary" className="rounded-l-lg rounded-r-none flex-1 w-full">Summary</TabsTrigger>
              <TabsTrigger value="pdf" className="rounded-r-lg rounded-l-none flex-1 w-full">
                <FileDown className="h-4 w-4 mr-2" />
                PDF
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="mt-0 w-full">
              {/* Services table - invoice style */}
              {services.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 text-sm font-medium">
                        <th className="py-3 px-4">Item</th>
                        <th className="py-3 px-4 text-right w-28">Price</th>
                        <th className="py-3 px-4 text-right w-20">Qty</th>
                        <th className="py-3 px-4 text-right w-32">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map(
                        (
                          s: {
                            serviceName: string;
                            quantity: number;
                            unitPrice?: number;
                            subtotal: number;
                          },
                          i: number
                        ) => {
                          const unitPrice = s.unitPrice ?? (s.quantity ? s.subtotal / s.quantity : s.subtotal);
                          return (
                            <tr
                              key={i}
                              className="border-t border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                            >
                              <td className="py-3 px-4 font-medium">{s.serviceName}</td>
                              <td className="py-3 px-4 text-right">
                                {formatCurrency(unitPrice, proposal.currency)}
                              </td>
                              <td className="py-3 px-4 text-right">{s.quantity}</td>
                              <td className="py-3 px-4 text-right font-medium">
                                {formatCurrency(s.subtotal, proposal.currency)}
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom row: Terms left, Summary right */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                    Terms & Conditions
                  </h3>
                  {proposal.introText && (
                    <div
                      className="text-sm text-slate-600 dark:text-slate-400 prose prose-sm dark:prose-invert max-w-none mb-4"
                      dangerouslySetInnerHTML={{ __html: proposal.introText }}
                    />
                  )}
                  {proposal.termsText ? (
                    <div
                      className="text-sm text-slate-600 dark:text-slate-400 prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: proposal.termsText }}
                    />
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-500">
                      This proposal is valid until{" "}
                      {proposal.validUntil
                        ? new Date(proposal.validUntil).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "further notice"}
                      . By accepting, you agree to the terms outlined above.
                    </p>
                  )}
                </div>
                <div className="lg:pl-4">
                  <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                      Proposal summary
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotalFromServices, proposal.currency)}</span>
                      </div>
                      <div className="flex justify-between text-slate-900 dark:text-white font-semibold pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                        <span>Proposal total</span>
                        <span>{formatCurrency(proposalTotal, proposal.currency)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pdf" className="mt-0 w-full">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900/30 min-h-[600px]">
                <ProposalReviewPDFPreview
                  firmName={firmNameSafe}
                  selectedClientData={null}
                  packageTemplate=""
                  entities={[]}
                  template=""
                  documentType=""
                  startMonth=""
                  startYear=""
                  financialYearEndMonth=""
                  financialYearEndYear=""
                  addProjectName={false}
                  projectName=""
                  selectedServices={{}}
                  sections={undefined}
                  proposalData={proposalDataForPdf}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Respond section - full width, flat */}
        <section className="mt-10 pt-8 border-t border-slate-200 dark:border-slate-800 w-full max-w-full">
          <h2 className="text-[15px] font-semibold text-[#243E63] dark:text-white mb-1">
            Respond to proposal
          </h2>
          <p className="text-[13px] text-slate-600 dark:text-slate-400 mb-6">
            Accept or decline this proposal. If accepting, enter your full name and sign below.
          </p>
          <div className="space-y-4 w-full max-w-full">
            <div className="w-full max-w-full">
              <Label htmlFor="signer-name" className="text-slate-700 dark:text-slate-300 text-sm font-medium">
                Your full name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="signer-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Enter your full legal name"
                className="mt-1.5 w-full max-w-full box-border"
                disabled={isSubmitting}
              />
            </div>
            <div className="w-full max-w-full">
              <Label className="text-slate-700 dark:text-slate-300 text-sm font-medium">
                Your signature <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-2">
                Draw your signature or upload an image (PNG, JPG, WebP, max 2MB)
              </p>
              <div className="w-full max-w-full">
                <SignaturePad
                  onSignatureChange={setSignatureData}
                  disabled={isSubmitting}
                  proposalMode
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 w-full max-w-full">
              <Button
                onClick={handleAccept}
                disabled={isSubmitting || !signerName.trim() || !signatureData}
                className="w-full h-11 text-[13px] font-semibold text-white border-0 shadow-sm hover:opacity-95"
                style={{ background: "#C8A96E" }}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Accept proposal
              </Button>
              <Button
                onClick={() => setShowRejectConfirm(true)}
                disabled={isSubmitting}
                className="w-full h-11 text-[13px] font-semibold bg-red-600 hover:bg-red-700 text-white"
              >
                <XCircle className="h-4 w-4 mr-2 text-white" />
                Decline
              </Button>
            </div>
          </div>
        </section>

        {/* Footer strip - gradient, content to bottom */}
        <footer
          className="mt-12 w-full py-5 px-4 sm:px-6 md:px-8 lg:px-10 rounded-none"
          style={{
            background: "linear-gradient(135deg, #e0f2fe 0%, #f3e8ff 50%, #e0e7ff 100%)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{firmName}</p>
              <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">
                Powered by NorthPact
              </p>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-500">
              Link expires{" "}
              {session.session?.expiresAt
                ? new Date(session.session.expiresAt).toLocaleDateString("en-GB")
                : "N/A"}
            </p>
          </div>
        </footer>
      </div>

      <AlertDialog open={showRejectConfirm} onOpenChange={setShowRejectConfirm}>
        <AlertDialogContent>
          <div className="flex items-start justify-between gap-4">
            <AlertDialogHeader className="flex-1 space-y-2 text-left">
              <AlertDialogTitle>Decline proposal?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to decline this proposal? The sender will be notified.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <button
              type="button"
              onClick={() => setShowRejectConfirm(false)}
              className="-m-1 p-1 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRejectConfirm} className="bg-red-600 hover:bg-red-700">
              Yes, decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
