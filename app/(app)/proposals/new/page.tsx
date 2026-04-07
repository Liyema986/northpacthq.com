"use client";

import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { useProposalDraft, clearProposalDraft } from "@/hooks/useProposalDraft";
import {
  hydrateDraftFromConvexProposal,
  type ConvexProposalHydrateInput,
} from "@/lib/hydrate-proposal-draft-from-saved";

import type {
  ProposalItem,
  ProposalBuilderEntity,
  ProposalBuilderContactOption,
  ServiceTemplate,
  BillingCategory,
} from "@/types";

import {
  ServiceLibrary,
  type ServiceCatalogSection,
} from "@/components/proposals/ServiceLibrary";
import {
  ProposalCanvas,
  parseProposalCanvasDraggableId,
} from "@/components/proposals/ProposalCanvas";
import { LiveSummary }         from "@/components/proposals/LiveSummary";
import { ServiceConfigDrawer } from "@/components/proposals/ServiceConfigDrawer";
import {
  parseBillingDroppableId,
  getItemTotalHours,
  getAssignedEntityNames,
} from "@/lib/proposal-entities";

import { Skeleton } from "@/components/ui/skeleton";
import {
  PanelLeftOpen, PanelRightOpen, PanelLeftClose, PanelRightClose,
  ChevronLeft, Save, Send,
} from "lucide-react";

// Map Convex pricingType → PricingMethod (closest match)
function mapPricingType(pt: string): ServiceTemplate["pricingMethod"] {
  switch (pt) {
    case "hourly":       return "hourly";
    case "tiered":       return "tiered";
    case "variation":    return "fixed_monthly"; // variation: use selected option price (defaults to first)
    case "recurring":    return "fixed_monthly"; // annual revenue bracket → fixed monthly at proposal level
    case "income_range": return "fixed_monthly"; // income bracket → fixed monthly at proposal level
    default:             return "fixed_monthly"; // "fixed" and anything else
  }
}

// Extract a representative unit price from any pricing type
function extractUnitPrice(row: { fixedPrice?: number; hourlyRate?: number; pricingTiers?: { price: number }[] }): number {
  if (row.fixedPrice != null)  return row.fixedPrice;
  if (row.hourlyRate != null)  return row.hourlyRate;
  if (row.pricingTiers?.length) return row.pricingTiers[0].price; // first variation/tier as default
  return 0;
}

// ─── Draft meta persistence key ──────────────────────────────────────────────
const PROPOSAL_META_KEY = "northpact_proposal_meta_v1";

// ─── Inner (needs searchParams) ──────────────────────────────────────────────

function NewProposalInner() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const packageIdParam = searchParams.get("packageId") ?? "";
  const templateIdParam = searchParams.get("templateId") ?? "";
  const fromProposalIdParam = searchParams.get("fromProposalId") ?? "";
  const editProposalIdParam = searchParams.get("editProposalId") ?? "";
  const urlClientId = searchParams.get("clientId") ?? "";

  // Fresh proposal (no URL loading context) — restore draft from sessionStorage
  const hasUrlParams = Boolean(packageIdParam || templateIdParam || fromProposalIdParam || editProposalIdParam);

  const { user }      = useNorthPactAuth();
  const userId        = user?.id as Id<"users"> | undefined;
  const firmId        = user?.firmId ?? "";

  // Panel visibility
  const [showLibrary, setShowLibrary] = useState(true);
  const [showSummary, setShowSummary] = useState(true);

  // Package selection — restore from sessionStorage when no URL params
  const [selectedPackageId, setSelectedPackageId] = useState(() => {
    if (hasUrlParams) return "";
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(PROPOSAL_META_KEY) : null;
      return raw ? (JSON.parse(raw)?.selectedPackageId ?? "") : "";
    } catch { return ""; }
  });

  // Editing item
  const [editingItem, setEditingItem] = useState<ProposalItem | null>(null);

  // Entity view state
  const [entityFilter,    setEntityFilter]    = useState("all");
  const [groupByEntity,   setGroupByEntity]   = useState(false);

  // Proposal metadata — restore title/clientId from sessionStorage when no URL params
  const [title, setTitle] = useState(() => {
    if (hasUrlParams) return "New Proposal";
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(PROPOSAL_META_KEY) : null;
      return raw ? (JSON.parse(raw)?.title ?? "New Proposal") : "New Proposal";
    } catch { return "New Proposal"; }
  });
  const [clientId, setClientId] = useState(() => {
    if (urlClientId) return urlClientId; // URL always wins
    if (hasUrlParams) return "";
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(PROPOSAL_META_KEY) : null;
      return raw ? (JSON.parse(raw)?.clientId ?? "") : "";
    } catch { return ""; }
  });
  const [saving,   setSaving]   = useState(false);

  const proposal = useProposalDraft(firmId, { restoreFromDraft: !hasUrlParams });

  // ── Convex data (catalog = sections + line items, same as /services) ─────
  const catalogSections = useQuery(
    api.lineItems.listSectionsWithItems,
    userId ? { userId } : "skip"
  );
  const proposalContacts = useQuery(
    api.clients.listClientsForProposalBuilder,
    userId ? { userId } : "skip"
  );
  const xeroConnection = useQuery(
    api.integrations.getXeroConnection,
    userId ? { userId } : "skip"
  );
  const linkedClient = useQuery(
    api.clients.getClient,
    userId && clientId ? { userId, clientId: clientId as Id<"clients"> } : "skip"
  );
  const packageTemplateRow = useQuery(
    api.packageTemplates.get,
    userId && packageIdParam
      ? { userId, packageId: packageIdParam as Id<"packageTemplates"> }
      : "skip"
  );
  const urlProposalTemplate = useQuery(
    api.templates.getTemplate,
    userId && templateIdParam
      ? { userId, templateId: templateIdParam as Id<"proposalTemplates"> }
      : "skip"
  );
  const allPackages = useQuery(
    api.packageTemplates.list,
    userId ? { userId } : "skip"
  );
  const hydrateSourceId = editProposalIdParam || fromProposalIdParam;
  const sourceProposal = useQuery(
    api.proposals.getProposal,
    userId && hydrateSourceId
      ? { userId, proposalId: hydrateSourceId as Id<"proposals"> }
      : "skip"
  );
  const createProposalMutation = useMutation(api.proposals.createProposal);
  const updateProposalMutation = useMutation(api.proposals.updateProposal);

  const appliedPackageFromUrl = useRef(false);
  const appliedTemplateFromUrl = useRef(false);

  /** Intro/terms/template label from ?templateId= — merged into createProposal on save */
  const [templatePreset, setTemplatePreset] = useState<{
    introText: string;
    termsText: string;
    templateName: string;
  } | null>(null);
  const replaceItems = proposal.replaceItems;
  const replaceEntities = proposal.replaceEntities;
  const addService = proposal.addService;
  const setEngagementLetterAfterAccept = proposal.setEngagementLetterAfterAccept;

  // ── Persist meta (title, clientId, selectedPackageId) to sessionStorage ────
  useEffect(() => {
    if (hasUrlParams || typeof window === "undefined") return;
    try {
      sessionStorage.setItem(PROPOSAL_META_KEY, JSON.stringify({ title, clientId, selectedPackageId }));
    } catch {}
  }, [title, clientId, selectedPackageId, hasUrlParams]);

  const loadingCatalog = catalogSections === undefined || proposalContacts === undefined;

  const stripHtml = (html: string | undefined) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  };

  /** Flatten active line items → ServiceTemplate (drag payload + configure drawer). */
  const templates: ServiceTemplate[] = useMemo(() => {
    if (!catalogSections) return [];
    const now = new Date().toISOString();
    const out: ServiceTemplate[] = [];
    for (const sec of catalogSections) {
      for (const row of sec.lineItems) {
        if (!row.isActive) continue;
        out.push({
          id:                String(row._id),
          firmId,
          categoryId:        sec._id as string,
          name:              row.name,
          description:       stripHtml(row.description),
          billingCategory:   (row.billingFrequency === "one_off" ? "onceoff" : "monthly") as BillingCategory,
          pricingMethod:     mapPricingType(row.pricingType),
          unitPrice:         extractUnitPrice(row),
          quantity:          1,
          discount:          0,
          taxRate:           15,
          frequency:         "monthly" as const,
          entityPricingMode: "single_price" as const,
          timeMethod:        "fixed_hours" as const,
          timeInputHours:    0,
          timeInputMinutes:  0,
          isActive:          row.isActive,
          isOptional:        false,
          sortOrder:         row.sortOrder,
          createdAt:         now,
          updatedAt:         now,
        });
      }
    }
    return out;
  }, [catalogSections, firmId]);

  const catalogSectionNames = useMemo(
    () => (catalogSections ?? []).map((s) => s.name),
    [catalogSections]
  );

  /** Map serviceId → pricing options (variations/tiers/fixed) from the catalog. */
  const servicePricingMap = useMemo(() => {
    const map = new Map<string, { label: string; price: number; hours?: number; minutes?: number }[]>();
    if (!catalogSections) return map;
    for (const sec of catalogSections) {
      for (const row of sec.lineItems) {
        if (row.pricingTiers && row.pricingTiers.length > 0) {
          map.set(String(row._id), row.pricingTiers.map((t: { name: string; price: number; hours?: number; minutes?: number }) => ({
            label: t.name, price: t.price, hours: t.hours, minutes: t.minutes,
          })));
        } else if (row.fixedPrice != null && row.fixedPrice > 0) {
          map.set(String(row._id), [{ label: "Fixed Price", price: row.fixedPrice }]);
        } else if (row.hourlyRate != null && row.hourlyRate > 0) {
          map.set(String(row._id), [{ label: "Hourly Rate", price: row.hourlyRate }]);
        }
      }
    }
    return map;
  }, [catalogSections]);

  /** Map serviceId → calculation definitions from the catalog. */
  const serviceCalculationsMap = useMemo(() => {
    const map = new Map<string, { id: string; operation: "add" | "multiply" | "divide" | "subtract"; valueType?: "quantity" | "static" | "variations"; label?: string; quantityFieldLabel?: string; staticValue?: number; options?: { label: string; value: number }[] }[]>();
    if (!catalogSections) return map;
    for (const sec of catalogSections) {
      for (const row of sec.lineItems) {
        if (row.addCalculation && row.calculationVariations?.length) {
          map.set(String(row._id), row.calculationVariations.map((c) => ({
            id: c.id,
            operation: c.operation as "add" | "multiply" | "divide" | "subtract",
            valueType: c.valueType as "quantity" | "static" | "variations" | undefined,
            label: c.label,
            quantityFieldLabel: c.quantityFieldLabel,
            staticValue: c.staticValue,
            options: c.options,
          })));
        }
      }
    }
    return map;
  }, [catalogSections]);

  useEffect(() => {
    if (searchParams.get("fromProposalId") || searchParams.get("editProposalId")) return;
    if (!packageIdParam) return;
    if (packageTemplateRow === undefined) return;
    if (packageTemplateRow === null) {
      toast.error("Package template not found");
      const params = new URLSearchParams();
      const cid = searchParams.get("clientId");
      if (cid) params.set("clientId", cid);
      router.replace(params.toString() ? `/proposals/new?${params.toString()}` : "/proposals/new");
      return;
    }
    const storageKey = `northpact-applied-pkg-${packageIdParam}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(storageKey)) {
      appliedPackageFromUrl.current = true;
      const params = new URLSearchParams();
      const cid = searchParams.get("clientId");
      if (cid) params.set("clientId", cid);
      router.replace(params.toString() ? `/proposals/new?${params.toString()}` : "/proposals/new");
      return;
    }
    if (appliedPackageFromUrl.current) return;
    if (!templates.length) return;
    appliedPackageFromUrl.current = true;
    if (typeof window !== "undefined") sessionStorage.setItem(storageKey, "1");
    replaceItems([]);
    for (const sid of packageTemplateRow.includedServiceIds) {
      const t = templates.find((x) => x.id === String(sid));
      if (t) addService(t, "monthly");
    }
    const n = packageTemplateRow.name.trim();
    setTitle(n ? `${n} — Proposal` : "New Proposal");
    toast.success(`Loaded package: ${packageTemplateRow.name}`);
    const params = new URLSearchParams();
    const cid = searchParams.get("clientId");
    if (cid) params.set("clientId", cid);
    router.replace(params.toString() ? `/proposals/new?${params.toString()}` : "/proposals/new");
  }, [
    packageIdParam,
    packageTemplateRow,
    templates,
    replaceItems,
    addService,
    router,
    searchParams,
  ]);

  useEffect(() => {
    if (searchParams.get("fromProposalId") || searchParams.get("editProposalId")) return;
    if (!templateIdParam) return;
    if (urlProposalTemplate === undefined) return;
    if (urlProposalTemplate === null) {
      toast.error("Proposal template not found");
      const params = new URLSearchParams();
      const cid = searchParams.get("clientId");
      if (cid) params.set("clientId", cid);
      const pkg = searchParams.get("packageId");
      if (pkg) params.set("packageId", pkg);
      router.replace(params.toString() ? `/proposals/new?${params.toString()}` : "/proposals/new");
      return;
    }
    const storageKey = `northpact-applied-tpl-${templateIdParam}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(storageKey)) {
      appliedTemplateFromUrl.current = true;
      const params = new URLSearchParams();
      const cid = searchParams.get("clientId");
      if (cid) params.set("clientId", cid);
      const pkg = searchParams.get("packageId");
      if (pkg) params.set("packageId", pkg);
      router.replace(params.toString() ? `/proposals/new?${params.toString()}` : "/proposals/new");
      return;
    }
    if (appliedTemplateFromUrl.current) return;
    appliedTemplateFromUrl.current = true;
    if (typeof window !== "undefined") sessionStorage.setItem(storageKey, "1");

    const t = urlProposalTemplate;
    const n = t.name.trim();
    setTitle(n ? `${n} — Proposal` : "New Proposal");
    setTemplatePreset({
      introText: t.introText ?? "",
      termsText: t.termsText ?? "",
      templateName: t.name,
    });
    const docs = t.documentsToSend ?? "";
    setEngagementLetterAfterAccept(docs !== "Proposal");

    toast.success(`Loaded template: ${t.name}`);

    const params = new URLSearchParams();
    const cid = searchParams.get("clientId");
    if (cid) params.set("clientId", cid);
    const pkg = searchParams.get("packageId");
    if (pkg) params.set("packageId", pkg);
    router.replace(params.toString() ? `/proposals/new?${params.toString()}` : "/proposals/new");
  }, [
    templateIdParam,
    urlProposalTemplate,
    router,
    searchParams,
    setEngagementLetterAfterAccept,
  ]);

  const contactOptions: ProposalBuilderContactOption[] = useMemo(() => {
    if (!proposalContacts) return [];
    return proposalContacts.map((c) => ({
      _id: c._id as string,
      companyName: c.companyName,
      contactName: c.contactName,
      email: c.email,
      contactType: c.contactType,
      xeroContactId: c.xeroContactId,
      taxNumber: c.taxNumber,
      companyNumber: c.companyNumber,
      notes: c.notes,
    }));
  }, [proposalContacts]);

  const lastAppliedClientRef = useRef<string | null>(null);
  /** Avoid duplicate "Proposal loaded" toasts when the effect re-runs (e.g. `allPackages` resolves after catalog). */
  const lastHydrateToastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const editId = editProposalIdParam;
    const fromId = fromProposalIdParam;
    const mode = editId ? ("edit" as const) : fromId ? ("copy" as const) : null;
    const id = editId || fromId;
    if (!mode || !id) {
      lastHydrateToastKeyRef.current = null;
      return;
    }
    if (sourceProposal === undefined) return;
    if (sourceProposal === null) {
      toast.error("Could not load proposal");
      const p = new URLSearchParams(searchParams.toString());
      p.delete("fromProposalId");
      p.delete("editProposalId");
      router.replace(p.toString() ? `/proposals/new?${p.toString()}` : "/proposals/new");
      return;
    }
    if (!templates.length) return;

    const h = hydrateDraftFromConvexProposal({
      proposal: sourceProposal as unknown as ConvexProposalHydrateInput,
      templates,
      firmId,
      mode: mode === "edit" ? "edit" : "new",
    });

    setClientId(sourceProposal.clientId as string);
    replaceEntities(h.entities);
    replaceItems(h.items);
    setTitle(h.title);
    if (h.templatePreset) setTemplatePreset(h.templatePreset);
    else setTemplatePreset(null);
    setEngagementLetterAfterAccept(h.engagementLetterAfterAccept);

    if (h.packageTemplateName && allPackages) {
      const want = h.packageTemplateName.trim().toLowerCase();
      const pkg = allPackages.find((p) => p.name.trim().toLowerCase() === want);
      setSelectedPackageId(pkg?._id ?? "");
    } else {
      setSelectedPackageId("");
    }

    /** Allow `linkedClient` effect to merge CRM fields into the primary entity (dropdown + tax fields). */
    lastAppliedClientRef.current = null;
    const toastKey = `${mode}-${id}`;
    if (lastHydrateToastKeyRef.current !== toastKey) {
      lastHydrateToastKeyRef.current = toastKey;
      toast.success(
        mode === "edit" ? "Proposal loaded for editing" : "Loaded client & proposal into builder"
      );
    }

    const p = new URLSearchParams();
    p.set("clientId", sourceProposal.clientId as string);
    if (mode === "edit") p.set("editProposalId", id);
    router.replace(`/proposals/new?${p.toString()}`);
  }, [
    editProposalIdParam,
    fromProposalIdParam,
    sourceProposal,
    templates,
    firmId,
    router,
    searchParams,
    allPackages,
    replaceItems,
    replaceEntities,
    setEngagementLetterAfterAccept,
  ]);

  const applyContactToPrimaryEntity = useCallback(
    (patch: Partial<ProposalBuilderEntity>) => {
      const first = proposal.entities[0];
      if (!first) return;
      proposal.updateEntity(first.id, patch);
    },
    [proposal.entities, proposal.updateEntity]
  );

  const handleSelectContact = useCallback(
    (id: string, option: ProposalBuilderContactOption | null) => {
      setClientId(id);
      if (!id || !option) {
        lastAppliedClientRef.current = null;
        return;
      }
      const first = proposal.entities[0];
      if (first) {
        applyContactToPrimaryEntity(mapContactToEntityFields(option));
        lastAppliedClientRef.current = id;
      } else {
        // First entity is created asynchronously in EntitySetupPanel; leave ref clear so getClient effect can fill.
        lastAppliedClientRef.current = null;
      }
    },
    [applyContactToPrimaryEntity, proposal.entities]
  );

  const handleSelectPackage = useCallback(
    (packageId: string) => {
      setSelectedPackageId(packageId);
      if (!packageId) {
        replaceItems([]);
        return;
      }
      const pkg = (allPackages ?? []).find((p) => p._id === packageId);
      if (!pkg) return;
      replaceItems([]);
      for (const sid of pkg.includedServiceIds) {
        const t = templates.find((x) => x.id === String(sid));
        if (t) addService(t, "monthly");
      }
      const n = pkg.name.trim();
      setTitle(n ? `${n} — Proposal` : "New Proposal");
      toast.success(`Loaded package: ${pkg.name}`);
    },
    [allPackages, templates, replaceItems, addService]
  );

  // Deep link ?clientId= — hydrate entity when client record loads (once per client id)
  useEffect(() => {
    if (!clientId || !proposal.entities[0] || !linkedClient) return;
    if (linkedClient._id !== clientId) return;
    if (lastAppliedClientRef.current === clientId) return;
    applyContactToPrimaryEntity(mapContactToEntityFields(linkedClient));
    lastAppliedClientRef.current = clientId;
  }, [clientId, linkedClient, proposal.entities[0]?.id, applyContactToPrimaryEntity]);

  // ── Drag end handler ─────────────────────────────────────────────────────
  const handleDragEnd = ({ source, destination, draggableId }: DropResult) => {
    if (!destination) return;

    const destParsed = parseBillingDroppableId(destination.droppableId);
    const srcParsed  = parseBillingDroppableId(source.droppableId);

    const isFromServiceLibrary =
      source.droppableId === "service-library" ||
      source.droppableId.startsWith("service-library-");
    if (isFromServiceLibrary) {
      if (!destParsed) return;
      const templateId = draggableId.replace("template:", "");
      const template   = templates.find((t) => t.id === templateId);
      if (!template) return;
      const newItem = proposal.addService(
        template,
        destParsed.category,
        destination.index,
        destParsed.entityId ? { targetEntityId: destParsed.entityId } : undefined
      );
      setEditingItem(newItem);
      return;
    }

    if (!srcParsed || !destParsed) return;

    if (srcParsed.entityId || destParsed.entityId) {
      if (
        srcParsed.category === destParsed.category &&
        srcParsed.entityId &&
        destParsed.entityId &&
        srcParsed.entityId !== destParsed.entityId
      ) {
        proposal.updateItem(parseProposalCanvasDraggableId(draggableId), {
          entityAssignmentMode: "selected_entities",
          assignedEntityIds:    [destParsed.entityId],
        });
      }
      return;
    }

    if (srcParsed.category !== destParsed.category) {
      proposal.moveItem(
        parseProposalCanvasDraggableId(draggableId),
        destParsed.category,
        destination.index
      );
      return;
    }
    if (source.index === destination.index) return;
    proposal.reorderItems(srcParsed.category, source.index, destination.index);
  };

  const handleRemoveEntity = (id: string) => {
    if (entityFilter === id) setEntityFilter("all");
    proposal.removeEntity(id);
  };

  const isEditMode = Boolean(editProposalIdParam);

  // ── Validation ───────────────────────────────────────────────────────────
  function getSubmitErrors(): string[] {
    const errors: string[] = [];

    if (!clientId) {
      errors.push("Select a client for this proposal");
    }

    if (proposal.items.length === 0) {
      errors.push("Add at least one service to the proposal");
    }

    if (proposal.clientGroupMode === "single_entity") {
      if (proposal.entities.length === 0) {
        errors.push("Complete your entity details — enter at least a name and type");
      } else if (!proposal.entities[0].name.trim()) {
        errors.push("Enter a name for your entity");
      }
    } else {
      // client_group
      if (proposal.entities.length === 0) {
        errors.push("Add at least one entity to the client group");
      } else if (proposal.entities.some((e) => !e.name.trim())) {
        errors.push("All entities in the group must have a name");
      }
    }

    const zeroPrice = proposal.items.filter((i) => !i.isOptional && i.unitPrice === 0);
    if (zeroPrice.length > 0) {
      errors.push(
        `${zeroPrice.length} service${zeroPrice.length > 1 ? "s have" : " has"} a R0.00 price — open Configure Service to set a price`
      );
    }

    return errors;
  }

  // ── Save handler ─────────────────────────────────────────────────────────
  async function handleSave(status: "draft" | "pending-approval" = "draft") {
    if (!userId) {
      toast.error("Not authenticated");
      return;
    }

    if (status === "pending-approval") {
      const errors = getSubmitErrors();
      if (errors.length > 0) {
        errors.forEach((err) => toast.error(err));
        return;
      }
    } else {
      // Draft: only require a client
      if (!clientId) {
        toast.error("Select a client before saving a draft");
        return;
      }
    }

    setSaving(true);
    try {
      const services = proposal.items.map((item) => {
        const hours = getItemTotalHours(item, proposal.entities);
        const scheduledMonth =
          item.scheduledWorkMonth?.trim() ||
          (item.commitmentDate ? item.commitmentDate.slice(0, 7) : undefined);
        const labels = getAssignedEntityNames(item, proposal.entities);
        return {
          serviceId: item.serviceTemplateId as Id<"services">,
          serviceName: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.totalPrice,
          description: item.description ?? undefined,
          estimatedHours: hours,
          ...(scheduledMonth ? { scheduledMonth } : {}),
          ...(labels.length > 0 ? { workPlanEntityLabels: labels } : {}),
          billingCategory: item.billingCategory,
          frequency: item.frequency,
        };
      });

      const mappedEntities =
        proposal.entities.length > 0
          ? proposal.entities.map((e, i) => ({
              id: i + 1,
              name: e.name || `Entity ${i + 1}`,
              type: e.entityType,
              revenueRange: e.revenueRange ?? "Not Applicable",
              incomeTaxRange: e.incomeTaxRange ?? "Not Applicable",
            }))
          : [];

      const selectedPkg = selectedPackageId
        ? (allPackages ?? []).find((p) => p._id === selectedPackageId)
        : undefined;

      const docType = proposal.engagementLetterAfterAccept
        ? "proposal_then_engagement_after_accept"
        : "proposal_only";

      const primaryEntity = proposal.entities[0];
      const fyeMonth = primaryEntity?.financialYearEndMonth || undefined;
      const fyeYear = primaryEntity?.financialYearEndYear || undefined;

      if (isEditMode) {
        const result = await updateProposalMutation({
          userId,
          proposalId: editProposalIdParam as Id<"proposals">,
          title: title.trim() || "Proposal",
          services,
          ...(status === "pending-approval"
            ? { status: "pending-approval" as const }
            : {}),
          entities: mappedEntities,
          clientId: clientId as Id<"clients">,
          ...(selectedPkg?.name ? { packageTemplate: selectedPkg.name.trim() } : {}),
          ...(templatePreset
            ? {
                introText: templatePreset.introText || undefined,
                termsText: templatePreset.termsText || undefined,
                template: templatePreset.templateName || undefined,
              }
            : {}),
          documentType: docType,
          financialYearEndMonth: fyeMonth,
          financialYearEndYear: fyeYear,
        });

        if (!result.success) {
          toast.error(result.error ?? "Failed to update proposal");
          return;
        }

        clearProposalDraft();
        try { sessionStorage.removeItem(PROPOSAL_META_KEY); } catch {}
        toast.success(
          status === "pending-approval"
            ? "Proposal updated and submitted for approval"
            : "Proposal updated"
        );
        router.push(`/proposals/${editProposalIdParam}`);
        return;
      }

      const result = await createProposalMutation({
        userId,
        clientId: clientId as Id<"clients">,
        title:    title.trim() || "New Proposal",
        services,
        ...(mappedEntities.length > 0 ? { entities: mappedEntities } : {}),
        ...(selectedPkg?.name ? { packageTemplate: selectedPkg.name.trim() } : {}),
        ...(templatePreset
          ? {
              introText: templatePreset.introText || undefined,
              termsText: templatePreset.termsText || undefined,
              template: templatePreset.templateName || undefined,
            }
          : {}),
        documentType: docType,
        financialYearEndMonth: fyeMonth,
        financialYearEndYear: fyeYear,
      });

      if (!result.success || !result.proposalId) {
        toast.error(result.error ?? "Failed to save proposal");
        return;
      }

      clearProposalDraft();
      try { sessionStorage.removeItem(PROPOSAL_META_KEY); } catch {}
      toast.success(
        status === "pending-approval"
          ? "Proposal submitted for approval"
          : "Proposal saved as draft"
      );
      router.push(`/proposals/${result.proposalId}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save proposal");
    } finally {
      setSaving(false);
    }
  }

  const currentEditingItem = editingItem
    ? proposal.items.find((i) => i.id === editingItem.id) ?? null
    : null;

  const activeEntityFilter =
    entityFilter === "all" || proposal.entities.some((e) => e.id === entityFilter)
      ? entityFilter
      : "all";

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex h-screen flex-col bg-background overflow-hidden">

        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-2.5 shrink-0">
          <Link
            href="/proposals"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <div className="flex flex-1 items-center gap-3 min-w-0">
            <input
              className="h-8 max-w-xs border-0 bg-transparent px-0 text-[14px] font-semibold text-slate-800 placeholder-slate-300 focus:outline-none"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Proposal title…"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleSave("draft")}
              disabled={saving}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg border border-slate-200 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />Save draft
            </button>
            <button
              onClick={() => handleSave("pending-approval")}
              disabled={saving}
              className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: "#C8A96E" }}
            >
              <Send className="h-3.5 w-3.5" />
              {isEditMode ? "Update proposal" : "Submit"}
            </button>
          </div>
        </div>

        {/* ── 3-Panel body ─────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left panel: Service Library */}
          {!showLibrary ? (
            <button
              type="button"
              onClick={() => setShowLibrary(true)}
              className="flex h-full w-10 shrink-0 flex-col items-center justify-start gap-2 border-r border-slate-100 bg-white pt-4 text-slate-400 transition-colors hover:text-slate-700"
              title="Open Service Library"
            >
              <PanelLeftOpen className="h-4 w-4" />
              <span className="text-[10px] font-medium [writing-mode:vertical-lr]">Service Library</span>
            </button>
          ) : (
            <div className="relative flex h-full shrink-0 flex-col">
              <button
                type="button"
                onClick={() => setShowLibrary(false)}
                className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                title="Close Service Library"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
              {loadingCatalog ? (
                <div className="w-[300px] p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                <ServiceLibrary
                  templates={templates}
                  sections={(catalogSections ?? []) as ServiceCatalogSection[]}
                  sectionNames={catalogSectionNames}
                />
              )}
            </div>
          )}

          {/* Centre: Proposal Canvas */}
          <ProposalCanvas
            items={proposal.items}
            entities={proposal.entities}
            entityFilter={activeEntityFilter}
            onEntityFilterChange={setEntityFilter}
            groupByEntity={groupByEntity}
            onGroupByEntityChange={setGroupByEntity}
            onAddEntity={proposal.addEntity}
            onUpdateEntity={proposal.updateEntity}
            onRemoveEntity={handleRemoveEntity}
            replaceEntities={proposal.replaceEntities}
            onEditItem={(item, contextEntityId) => {
                // If editing from a specific entity column and the service covers all entities,
                // split it: original keeps all OTHER entities, new copy is just for this entity.
                if (
                  contextEntityId &&
                  item.entityAssignmentMode === "all_entities" &&
                  proposal.entities.length > 1
                ) {
                  const otherEntityIds = proposal.entities
                    .map((e) => e.id)
                    .filter((id) => id !== contextEntityId);
                  const newId = `item_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                  const newItem: ProposalItem = {
                    ...item,
                    id: newId,
                    entityAssignmentMode: "selected_entities",
                    assignedEntityIds: [contextEntityId],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  proposal.replaceItems(
                    proposal.items.flatMap((i) =>
                      i.id !== item.id
                        ? [i]
                        : [
                            { ...i, entityAssignmentMode: "selected_entities", assignedEntityIds: otherEntityIds },
                            newItem,
                          ]
                    )
                  );
                  setEditingItem(newItem);
                  return;
                }
                setEditingItem(item);
              }}
            onRemoveItem={(id, contextEntityId) => {
                const item = proposal.items.find((i) => i.id === id);
                if (contextEntityId && item) {
                  if (item.entityAssignmentMode === "all_entities" && proposal.entities.length > 1) {
                    const otherEntityIds = proposal.entities.map((e) => e.id).filter((eid) => eid !== contextEntityId);
                    proposal.updateItem(id, { entityAssignmentMode: "selected_entities", assignedEntityIds: otherEntityIds });
                    return;
                  }
                  if (item.entityAssignmentMode === "selected_entities") {
                    const remaining = (item.assignedEntityIds ?? []).filter((eid) => eid !== contextEntityId);
                    if (remaining.length > 0) {
                      proposal.updateItem(id, { assignedEntityIds: remaining });
                      return;
                    }
                  }
                }
                proposal.removeItem(id);
              }}
            onDuplicateItem={(id, contextEntityId) => {
                const item = proposal.items.find((i) => i.id === id);
                if (contextEntityId && item?.entityAssignmentMode === "all_entities") {
                  const newId = `item_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                  const newItem: ProposalItem = {
                    ...item,
                    id: newId,
                    entityAssignmentMode: "selected_entities",
                    assignedEntityIds: [contextEntityId],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  };
                  proposal.replaceItems([...proposal.items, newItem]);
                } else {
                  proposal.duplicateItem(id);
                }
              }}
            onToggleOptional={(id) => {
              const item = proposal.items.find((i) => i.id === id);
              if (item) proposal.updateItem(id, { isOptional: !item.isOptional });
            }}
            clientGroupMode={proposal.clientGroupMode}
            onClientGroupModeChange={proposal.setClientGroupMode}
            clientGroup={proposal.clientGroup}
            onUpdateClientGroup={proposal.updateClientGroup}
            contactOptions={contactOptions}
            selectedClientId={clientId}
            onSelectContact={handleSelectContact}
            contactsLoading={proposalContacts === undefined}
            userId={userId}
            xeroConnected={!!xeroConnection?.tenantId}
            engagementLetterAfterAccept={proposal.engagementLetterAfterAccept}
            onEngagementLetterAfterAcceptChange={proposal.setEngagementLetterAfterAccept}
            packageOptions={(allPackages ?? []).map((p) => ({ _id: p._id, name: p.name }))}
            selectedPackageId={selectedPackageId}
            onSelectPackage={handleSelectPackage}
          />

          {/* Right panel: Live Summary */}
          {!showSummary ? (
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className="flex h-full w-10 shrink-0 flex-col items-center justify-start gap-2 border-l border-slate-100 bg-white pt-4 text-slate-400 transition-colors hover:text-slate-700"
              title="Open Live Summary"
            >
              <PanelRightOpen className="h-4 w-4" />
              <span className="text-[10px] font-medium [writing-mode:vertical-lr]">Live Summary</span>
            </button>
          ) : (
            <div className="relative flex h-full shrink-0 flex-col">
              <button
                type="button"
                onClick={() => setShowSummary(false)}
                className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                title="Close Live Summary"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
              <LiveSummary
                summary={proposal.summary}
                paymentFrequency={proposal.paymentFrequency}
                onPaymentFrequencyChange={proposal.setPaymentFrequency}
                cashFlowByMonth={proposal.cashFlowByMonth}
              />
            </div>
          )}
        </div>
      </div>

      {/* Service config drawer */}
      <ServiceConfigDrawer
        item={currentEditingItem}
        entities={proposal.entities}
        open={!!currentEditingItem}
        onClose={() => setEditingItem(null)}
        onUpdate={proposal.updateItem}
        pricingOptions={
          currentEditingItem?.serviceTemplateId
            ? servicePricingMap.get(currentEditingItem.serviceTemplateId)
            : undefined
        }
        calculations={
          currentEditingItem?.serviceTemplateId
            ? serviceCalculationsMap.get(currentEditingItem.serviceTemplateId)
            : undefined
        }
      />
    </DragDropContext>
  );
}

function mapContactToEntityFields(c: {
  companyName: string;
  contactType?: "organisation" | "individual";
  companyNumber?: string;
  taxNumber?: string;
  notes?: string;
}): Partial<ProposalBuilderEntity> {
  return {
    name: c.companyName,
    entityType: c.contactType === "individual" ? "individual" : "company",
    registrationNumber: c.companyNumber ?? "",
    taxNumber: c.taxNumber ?? "",
    notes: c.notes ?? "",
    revenueRange: "Not Applicable",
    incomeTaxRange: "Not Applicable",
  };
}

// ─── Export with Suspense ─────────────────────────────────────────────────────

export default function NewProposalPage() {
  return (
    <Suspense fallback={null}>
      <NewProposalInner />
    </Suspense>
  );
}
