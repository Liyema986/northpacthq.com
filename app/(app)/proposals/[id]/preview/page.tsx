"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  FileText,
  DollarSign,
  TrendingUp,
  ArrowLeft,
  Printer,
} from "lucide-react";
import Link from "next/link";

export default function ProposalPreviewPage() {
  const params = useParams();
  const id = params.id as Id<"proposals">;
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  const proposal = useQuery(
    api.proposals.getProposal,
    userId ? { userId, proposalId: id } : "skip"
  );

  if (proposal === undefined) {
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

  if (!proposal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Proposal Not Found</h1>
          <Link href="/proposals" className="text-sm text-[#C8A96E] hover:underline">
            Back to proposals
          </Link>
        </div>
      </div>
    );
  }

  const firmName = user?.name ?? "Your Firm";
  const clientName = proposal.client?.companyName ?? proposal.client?.contactName ?? "Client";
  const services = proposal.services ?? [];
  const monthlyTotal = proposal.grossMonthlyFee ?? proposal.netMonthlyFee ?? 0;
  const onceoffTotal = proposal.grossOneOffFee ?? proposal.oneOffFee ?? 0;
  const total = proposal.total ?? 0;
  const acv = monthlyTotal > 0 ? monthlyTotal * 12 + onceoffTotal : total;
  const createdAtStr = proposal.createdAt
    ? new Date(proposal.createdAt).toISOString()
    : new Date().toISOString();

  return (
    <div className="min-h-screen bg-background">
      {/* Preview banner */}
      <div className="border-b border-amber-200 bg-amber-50 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[11px]">
              PREVIEW
            </Badge>
            <span className="text-[12px] text-amber-700">This is how the client will see your proposal</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <Printer className="h-3 w-3" /> Print / PDF
            </button>
            <Link
              href={`/proposals/${id}`}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Back
            </Link>
          </div>
        </div>
      </div>

      {/* Header bar — same as portal */}
      <div className="border-b border-border bg-card/80 backdrop-blur sticky top-[41px] z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Proposal from</p>
            <p className="text-sm font-semibold truncate">{firmName}</p>
          </div>
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
            { label: "Monthly", value: formatCurrency(monthlyTotal), icon: DollarSign },
            { label: "ACV", value: formatCurrency(acv), icon: TrendingUp },
            { label: "Total", value: formatCurrency(total), icon: FileText },
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
              {services.map((service: { serviceId?: string; serviceName: string; description?: string; quantity: number; unitPrice: number; subtotal: number }, i: number) => (
                <div key={`${service.serviceId}-${i}`} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{service.serviceName}</p>
                    {service.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                    )}
                    {service.quantity > 1 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Qty: {service.quantity} × {formatCurrency(service.unitPrice)}
                      </p>
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

        <p className="text-center text-xs text-muted-foreground pb-6">
          Powered by NorthPact · {firmName}
        </p>
      </div>
    </div>
  );
}
