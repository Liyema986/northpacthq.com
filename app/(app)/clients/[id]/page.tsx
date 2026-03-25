"use client";

import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { formatDate, formatCurrency, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft, FileText, Mail, Phone, Plus, Globe, MapPin, Building2,
} from "lucide-react";
import Link from "next/link";

const PROPOSAL_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:            { label: "Draft",   className: "bg-muted text-muted-foreground" },
  "pending-approval": { label: "Pending", className: "bg-amber-100 text-amber-700" },
  approved:         { label: "Approved",className: "bg-blue-100 text-blue-700" },
  sent:             { label: "Sent",    className: "bg-violet-100 text-violet-700" },
  viewed:           { label: "Viewed",  className: "bg-cyan-100 text-cyan-700" },
  accepted:         { label: "Accepted",className: "bg-emerald-100 text-emerald-700" },
  rejected:         { label: "Rejected",className: "bg-red-100 text-red-700" },
  expired:          { label: "Expired", className: "bg-muted text-muted-foreground" },
};

function ClientDetailPageInner() {
  const params   = useParams();
  const router   = useRouter();
  const { user } = useNorthPactAuth();
  const userId   = user?.id as Id<"users"> | undefined;
  const clientId = params.id as string;

  const client    = useQuery(
    api.clients.getClient,
    userId && clientId ? { userId, clientId: clientId as Id<"clients"> } : "skip"
  );
  const proposals = useQuery(
    api.proposals.listProposals,
    userId && clientId ? { userId, clientId: clientId as Id<"clients"> } : "skip"
  );

  const loading = client === undefined || proposals === undefined;

  if (loading) {
    return (
      <>
        <Header><Skeleton className="h-4 w-48" /></Header>
        <div className="p-6 space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (!client) {
    router.replace("/clients");
    return null;
  }

  return (
    <>
      <Header>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/clients"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <p className="text-xs text-muted-foreground">Clients</p>
            <h1 className="text-sm font-semibold">{client.companyName}</h1>
          </div>
        </div>
      </Header>

      <div className="p-6 space-y-6">
        {/* Client header card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="text-lg bg-primary/10 text-primary font-bold">
                  {getInitials(client.companyName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold">{client.companyName}</h2>
                  {client.status === "archived" && <Badge variant="secondary">Archived</Badge>}
                </div>
                {client.industry && <p className="text-sm text-muted-foreground mt-0.5">{client.industry}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                  {client.contactName && <span>{client.contactName}</span>}
                  <span>Since {formatDate(client.createdAt)}</span>
                </div>
                {client.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {client.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-muted text-xs font-medium">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <Button size="sm" asChild>
                <Link href={`/proposals/new?clientId=${client._id}`}>
                  <Plus className="mr-1.5 h-4 w-4" />New Proposal
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="proposals">Proposals ({proposals?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* Details tab */}
          <TabsContent value="details" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</p>
                  {client.email && (
                    <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {client.email}
                    </a>
                  )}
                  {client.phone && (
                    <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {client.phone}
                    </a>
                  )}
                  {client.website && (
                    <a href={client.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary">
                      <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {client.website}
                    </a>
                  )}
                </CardContent>
              </Card>

              {/* Company */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</p>
                  {client.companyNumber && (
                    <div className="flex items-start gap-2 text-sm">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                      <span className="text-slate-700">Reg: {client.companyNumber}</span>
                    </div>
                  )}
                  {client.taxNumber && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                      <span className="text-slate-700">Tax: {client.taxNumber}</span>
                    </div>
                  )}
                  {(client.addressLine1 || client.city) && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                      <span className="text-slate-700">
                        {[client.addressLine1, client.city, client.region, client.postalCode].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                  {!client.companyNumber && !client.taxNumber && !client.addressLine1 && !client.city && (
                    <p className="text-sm text-muted-foreground">No company details added yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              {client.notes && (
                <Card className="md:col-span-2">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{client.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Proposals tab */}
          <TabsContent value="proposals" className="mt-4">
            {!proposals || proposals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No proposals yet</p>
                <Button size="sm" className="mt-3" asChild>
                  <Link href={`/proposals/new?clientId=${client._id}`}>
                    <Plus className="mr-1.5 h-4 w-4" />Create proposal
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {proposals.map((p, i) => {
                  const cfg = PROPOSAL_STATUS_CONFIG[p.status] ?? { label: p.status, className: "bg-muted text-muted-foreground" };
                  return (
                    <Link key={`cp-${p._id}-${i}`} href={`/proposals/${p._id}`}>
                      <Card className="hover:border-primary/40 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p.title}</p>
                              <p className="text-xs text-muted-foreground">{p.proposalNumber} · {formatDate(p.createdAt)}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold">{formatCurrency(p.total)}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cfg.className}`}>{cfg.label}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

export default function ClientDetailPage() {
  return (
    <Suspense fallback={
      <>
        <Header><div className="h-4 w-48 bg-muted animate-pulse rounded" /></Header>
        <div className="p-6 space-y-4">
          <div className="h-32 w-full bg-muted animate-pulse rounded-xl" />
          <div className="h-48 w-full bg-muted animate-pulse rounded-xl" />
        </div>
      </>
    }>
      <ClientDetailPageInner />
    </Suspense>
  );
}
