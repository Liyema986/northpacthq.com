"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

export default function ClientPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [acceptOpen,  setAcceptOpen]  = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [signerName,  setSignerName]  = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [processing,  setProcessing]  = useState(false);
  const [resolved,    setResolved]    = useState<"accepted" | "declined" | null>(null);

  const sessionData = useQuery(api.proposalAccept.getProposalAcceptSession, { token });
  const acceptProposal = useMutation(api.proposalAccept.acceptProposal);
  const rejectProposal = useMutation(api.proposalAccept.rejectProposal);

  async function handleAccept() {
    if (!signerName.trim()) return;
    setProcessing(true);
    try {
      const result = await acceptProposal({
        token,
        signerName: signerName.trim(),
        userAgent: navigator.userAgent,
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to accept proposal");
        return;
      }
      setResolved("accepted");
      setAcceptOpen(false);
      toast.success("Proposal accepted! We'll be in touch shortly.");
    } catch {
      toast.error("Failed to process acceptance");
    } finally {
      setProcessing(false);
    }
  }

  async function handleDecline() {
    setProcessing(true);
    try {
      const result = await rejectProposal({
        token,
        userAgent: navigator.userAgent,
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to decline proposal");
        return;
      }
      setResolved("declined");
      setDeclineOpen(false);
      toast.info("Proposal declined. Thank you for your response.");
    } catch {
      toast.error("Failed to process decline");
    } finally {
      setProcessing(false);
    }
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (sessionData === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if ("error" in sessionData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Link Unavailable</h1>
          <p className="text-muted-foreground">{sessionData.error}</p>
        </div>
      </div>
    );
  }

  // ── Already resolved ─────────────────────────────────────────────────────
  if ("resolvedStatus" in sessionData) {
    const isAccepted = sessionData.resolvedStatus === "accepted";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isAccepted ? "bg-emerald-100" : "bg-muted"}`}>
            {isAccepted
              ? <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              : <XCircle className="h-8 w-8 text-muted-foreground" />
            }
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {isAccepted ? "Proposal Accepted" : "Proposal Declined"}
          </h1>
          <p className="text-muted-foreground">
            {isAccepted
              ? `Accepted by ${sessionData.signerName ?? "client"} · Thank you for your acceptance.`
              : "Thank you for your response."}
          </p>
        </div>
      </div>
    );
  }

  // ── Locally accepted or declined ─────────────────────────────────────────
  if (resolved === "accepted") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Proposal Accepted</h1>
          <p className="text-muted-foreground mb-4">
            Thank you for accepting our proposal. Your dedicated account manager will be in
            contact within 1 business day to confirm the engagement details.
          </p>
          <p className="text-sm text-muted-foreground">
            An engagement letter will be sent to your email shortly.
          </p>
        </div>
      </div>
    );
  }

  if (resolved === "declined") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Proposal Declined</h1>
          <p className="text-muted-foreground">
            We appreciate your response. Feel free to reach out if you&apos;d like to discuss
            alternative options.
          </p>
        </div>
      </div>
    );
  }

  // ── Active proposal ──────────────────────────────────────────────────────
  const { session, proposal, firmName, clientName } = sessionData;
  const services = proposal.services ?? [];
  const total    = proposal.total ?? 0;
  const monthlyTotal = total; // Use total as proxy for monthly
  const acv      = monthlyTotal * 12;

  const isExpired  = Date.now() > session.expiresAt;
  const canRespond = session.status === "pending" && !isExpired;

  const createdAtStr = proposal.createdAt
    ? new Date(proposal.createdAt).toISOString()
    : new Date().toISOString();

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <div className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Proposal from</p>
            <p className="text-sm font-semibold truncate">{firmName}</p>
          </div>
          {isExpired && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              Expired
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Title block */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">{proposal.title}</h1>
          <p className="text-muted-foreground mt-1">
            Prepared for{" "}
            <span className="font-medium text-foreground">{clientName}</span>
            {" · "}
            <span className="text-sm">{formatDate(createdAtStr)}</span>
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Monthly",  value: formatCurrency(monthlyTotal), icon: DollarSign },
            { label: "ACV",      value: formatCurrency(acv),          icon: TrendingUp },
            { label: "Total",    value: formatCurrency(total),         icon: FileText },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-4 text-center">
                <Icon className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                <p className="text-lg font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Introduction text */}
        {proposal.introText && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{proposal.introText}</p>
            </CardContent>
          </Card>
        )}

        {/* Services */}
        {services.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Services Included</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {services.map((service, i) => (
                <div key={`${service.serviceId}-${i}`} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{service.serviceName}</p>
                    {service.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                    )}
                    {service.quantity > 1 && (
                      <p className="text-xs text-muted-foreground mt-0.5">Qty: {service.quantity} × {formatCurrency(service.unitPrice)}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      {formatCurrency(service.subtotal)}
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 font-semibold">
                <span className="text-sm">Total</span>
                <span className="text-sm">{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Terms */}
        {proposal.termsText && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-muted-foreground">Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">{proposal.termsText}</p>
            </CardContent>
          </Card>
        )}

        {/* Validity */}
        {proposal.validUntil && (
          <p className="text-xs text-center text-muted-foreground">
            Valid until {formatDate(new Date(proposal.validUntil).toISOString())}
          </p>
        )}

        <Separator />

        {/* Actions */}
        {canRespond ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              size="lg"
              onClick={() => setAcceptOpen(true)}
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Accept Proposal
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1 text-muted-foreground"
              onClick={() => setDeclineOpen(true)}
            >
              <XCircle className="mr-2 h-5 w-5" />
              Decline
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              {isExpired
                ? "This proposal has expired. Please contact us for an updated quote."
                : "This proposal is no longer available for response."}
            </p>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-6">
          Powered by NorthPact · {firmName}
        </p>
      </div>

      {/* Accept dialog */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              By accepting, you confirm your agreement to the terms and services outlined above.
            </p>
            <div className="space-y-1.5">
              <Label>Your full name *</Label>
              <Input
                placeholder="John Smith"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Your email (optional)</Label>
              <Input
                type="email"
                placeholder="john@company.co.za"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleAccept}
              disabled={processing || !signerName.trim()}
            >
              {processing ? "Processing..." : "Confirm Acceptance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline dialog */}
      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Proposal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to decline this proposal? You can always reach out to us directly
            if you&apos;d like to discuss alternatives.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDecline}
              disabled={processing}
            >
              {processing ? "Processing..." : "Decline Proposal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
