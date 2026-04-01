"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { generateId } from "@/lib/utils";
import { toast } from "sonner";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  HelpCircle,
  Layers3,
  Link2,
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import type {
  ProposalBuilderEntity,
  ProposalBuilderClientGroup,
  ProposalBuilderContactOption,
  ClientGroupMode,
} from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EntityType } from "@/types";
import {
  ENTITY_TYPE_OPTIONS,
  REVENUE_RANGE_OPTIONS,
  INCOME_TAX_RANGE_OPTIONS,
  coerceEntityTypeForSelect,
} from "@/lib/proposal-entity-field-options";

const SELECT_NONE = "__none__";
const SELECT_XERO_NONE = "__xero_none__";

function mapXeroEntityToBuilder(e: {
  name: string;
  type: string;
  revenueRange?: string;
  incomeTaxRange?: string;
}): ProposalBuilderEntity {
  return {
    id: generateId(),
    name: e.name?.trim() || "Entity",
    entityType: coerceEntityTypeForSelect(e.type ?? ""),
    registrationNumber: "",
    taxNumber: "",
    vatNumber: "",
    notes: "",
    revenueRange:       e.revenueRange ?? "Not Applicable",
    incomeTaxRange:     e.incomeTaxRange ?? "Not Applicable",
  };
}

function HelpHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Help"
        >
          <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[260px] text-left text-[12px] font-normal leading-relaxed"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function SectionHeader({ title, tooltip }: { title: string; tooltip?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {tooltip ? <HelpHint text={tooltip} /> : null}
    </div>
  );
}

export interface PackageOption {
  _id: string;
  name: string;
}

interface EntitySetupPanelProps {
  entities: ProposalBuilderEntity[];
  entityFilter: string;
  onEntityFilterChange: (value: string) => void;
  groupByEntity: boolean;
  onGroupByEntityChange: (value: boolean) => void;
  onAddEntity: () => void;
  onUpdateEntity: (id: string, updates: Partial<ProposalBuilderEntity>) => void;
  onRemoveEntity: (id: string) => void;
  /** Bulk replace entities (Xero group import) */
  replaceEntities?: (entities: ProposalBuilderEntity[]) => void;
  clientGroupMode: ClientGroupMode;
  onClientGroupModeChange: (mode: ClientGroupMode) => void;
  clientGroup: ProposalBuilderClientGroup;
  onUpdateClientGroup: (updates: Partial<ProposalBuilderClientGroup>) => void;
  contactOptions: ProposalBuilderContactOption[];
  selectedClientId: string;
  onSelectContact: (clientId: string, option: ProposalBuilderContactOption | null) => void;
  contactsLoading?: boolean;
  userId?: Id<"users">;
  /** Firm has Xero connected (tenant) */
  xeroConnected?: boolean;
  engagementLetterAfterAccept: boolean;
  onEngagementLetterAfterAcceptChange: (v: boolean) => void;
  /** Package selection */
  packageOptions?: PackageOption[];
  selectedPackageId?: string;
  onSelectPackage?: (packageId: string) => void;
}

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

const selectTriggerCls =
  "flex h-10 min-h-10 w-full items-center rounded-md border border-border bg-background px-3 text-left text-sm font-normal";

/** Uniform 2-column form grid (sm+); stacks on very narrow viewports */
const formGrid2 =
  "grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2";

export function EntitySetupPanel({
  entities,
  entityFilter,
  onEntityFilterChange,
  groupByEntity,
  onGroupByEntityChange,
  onAddEntity,
  onUpdateEntity,
  onRemoveEntity,
  replaceEntities,
  clientGroupMode,
  onClientGroupModeChange,
  clientGroup,
  onUpdateClientGroup,
  contactOptions,
  selectedClientId,
  onSelectContact,
  contactsLoading,
  userId,
  xeroConnected,
  engagementLetterAfterAccept,
  onEngagementLetterAfterAcceptChange,
  packageOptions,
  selectedPackageId,
  onSelectPackage,
}: EntitySetupPanelProps) {
  const isSingle = clientGroupMode === "single_entity";

  const { organisations, individuals } = useMemo(
    () => splitContactsForGroupedSelect(contactOptions),
    [contactOptions]
  );

  const selectValue = selectedClientId || SELECT_NONE;

  return (
    <TooltipProvider delayDuration={200}>
      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* ── Structure mode (inset) ───────────────────────────────────── */}
        <div className="px-5 pb-3 pt-5">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Structure
            </p>
            <HelpHint
              text={
                isSingle
                  ? "Single file / one main contact: use Single entity. Link a contact (optional), then open Entity details."
                  : "Multiple legal entities under one relationship: use Client group. Pick a primary contact, then set group name and entities below. Xero group import is optional."
              }
            />
          </div>
          <div className="mt-2 flex gap-1 rounded-lg bg-muted/60 p-1">
            {(["single_entity", "client_group"] as ClientGroupMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onClientGroupModeChange(mode)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  clientGroupMode === mode
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {mode === "single_entity" ? (
                  <>
                    <Building2 className="h-4 w-4 shrink-0" />
                    Single entity
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 shrink-0" />
                    Client group
                  </>
                )}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border-border"
                checked={engagementLetterAfterAccept}
                onChange={(e) => onEngagementLetterAfterAcceptChange(e.target.checked)}
              />
              <span className="leading-snug">Engagement letter after acceptance</span>
            </label>
            <HelpHint text="Proposal email goes first. When ticked, the engagement letter is queued only after the client accepts — not sent with the initial proposal." />
          </div>
        </div>

        {/* Full-bleed divider — touches left & right edges of the card */}
        <Separator className="h-px w-full bg-border/80" />

        <div className="space-y-5 px-5 pb-5 pt-3.5">
          {isSingle ? (
            <SingleEntityLayout
              organisations={organisations}
              individuals={individuals}
              entities={entities}
              onUpdateEntity={onUpdateEntity}
              selectValue={selectValue}
              onSelectChange={(v) => {
                if (v === SELECT_NONE) {
                  onSelectContact("", null);
                  return;
                }
                const opt =
                  organisations.find((c) => c._id === v) ??
                  individuals.find((c) => c._id === v) ??
                  null;
                onSelectContact(v, opt);
              }}
              contactsLoading={contactsLoading}
              packageOptions={packageOptions}
              selectedPackageId={selectedPackageId}
              onSelectPackage={onSelectPackage}
            />
          ) : (
            <ClientGroupLayout
              organisations={organisations}
              individuals={individuals}
              entities={entities}
              clientGroup={clientGroup}
              onUpdateClientGroup={onUpdateClientGroup}
              onUpdateEntity={onUpdateEntity}
              onRemoveEntity={onRemoveEntity}
              onAddEntity={onAddEntity}
              replaceEntities={replaceEntities}
              entityFilter={entityFilter}
              onEntityFilterChange={onEntityFilterChange}
              groupByEntity={groupByEntity}
              onGroupByEntityChange={onGroupByEntityChange}
              contactOptions={contactOptions}
              selectValue={selectValue}
              onSelectChange={(v) => {
                if (v === SELECT_NONE) {
                  onSelectContact("", null);
                  return;
                }
                const opt =
                  organisations.find((c) => c._id === v) ??
                  individuals.find((c) => c._id === v) ??
                  null;
                onSelectContact(v, opt);
              }}
              contactsLoading={contactsLoading}
              userId={userId}
              xeroConnected={xeroConnected}
              packageOptions={packageOptions}
              selectedPackageId={selectedPackageId}
              onSelectPackage={onSelectPackage}
            />
          )}
        </div>
      </section>
    </TooltipProvider>
  );
}

// ─── Shared: contact Select (Radix) ───────────────────────────────────────────

function ContactLinkSelect({
  organisations,
  individuals,
  selectValue,
  onSelectChange,
  contactsLoading,
}: {
  organisations: ProposalBuilderContactOption[];
  individuals: ProposalBuilderContactOption[];
  selectValue: string;
  onSelectChange: (v: string) => void;
  contactsLoading?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (contactsLoading) {
    return <div className="h-10 w-full animate-pulse rounded-md bg-muted" aria-hidden />;
  }

  const selectedContact =
    selectValue && selectValue !== SELECT_NONE
      ? [...organisations, ...individuals].find((c) => c._id === selectValue)
      : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("min-w-0 justify-between", selectTriggerCls)}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className={cn("truncate", !selectedContact && "text-muted-foreground")}>
              {selectedContact ? formatContactOptionLabel(selectedContact) : "Choose a contact…"}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search contacts…" />
          <CommandList>
            <CommandEmpty>No contacts found.</CommandEmpty>
            <CommandItem
              value="__no_contact__"
              onSelect={() => { onSelectChange(SELECT_NONE); setOpen(false); }}
              className="text-muted-foreground"
            >
              No contact linked
              {(!selectValue || selectValue === SELECT_NONE) && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </CommandItem>
            {organisations.length > 0 && (
              <CommandGroup heading="Organisations">
                {organisations.map((c) => (
                  <CommandItem
                    key={c._id}
                    value={formatContactOptionLabel(c)}
                    onSelect={() => { onSelectChange(c._id); setOpen(false); }}
                  >
                    {formatContactOptionLabel(c)}
                    {selectValue === c._id && <Check className="ml-auto h-4 w-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {organisations.length > 0 && individuals.length > 0 && <CommandSeparator />}
            {individuals.length > 0 && (
              <CommandGroup heading="Individuals">
                {individuals.map((c) => (
                  <CommandItem
                    key={c._id}
                    value={formatContactOptionLabel(c)}
                    onSelect={() => { onSelectChange(c._id); setOpen(false); }}
                  >
                    {formatContactOptionLabel(c)}
                    {selectValue === c._id && <Check className="ml-auto h-4 w-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Full-width collapsible panel ─────────────────────────────────────────────

function FullWidthCollapsible({
  title,
  tooltip,
  defaultOpen,
  headerRight,
  children,
}: {
  title: string;
  tooltip?: string;
  /** Only pass `true` to start expanded; omitted or `false` stays collapsed. */
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => defaultOpen === true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <div className="w-full overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex w-full min-w-0 items-stretch border-b border-border/80">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/35"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  open ? "rotate-180" : "rotate-0"
                )}
                aria-hidden
              />
              <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">{title}</p>
            </button>
          </CollapsibleTrigger>
          {tooltip ? (
            <div className="flex shrink-0 items-center border-l border-border/60 bg-muted/5 px-2">
              <HelpHint text={tooltip} />
            </div>
          ) : null}
          {headerRight ? (
            <div className="flex shrink-0 items-center justify-end border-l border-border/60 px-3 py-2">
              {headerRight}
            </div>
          ) : null}
        </div>
        <CollapsibleContent className="overflow-hidden">
          <div className="px-4 pb-4 pt-3">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Single entity: contact first (full width), entity details collapsible ───

const SELECT_PACKAGE_NONE = "__pkg_none__";

function PackageSelect({
  packageOptions,
  selectedPackageId,
  onSelectPackage,
}: {
  packageOptions: PackageOption[];
  selectedPackageId?: string;
  onSelectPackage: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedPkg = selectedPackageId
    ? packageOptions.find((p) => p._id === selectedPackageId)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("min-w-0 justify-between", selectTriggerCls)}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Layers3 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className={cn("truncate", !selectedPkg && "text-muted-foreground")}>
              {selectedPkg ? selectedPkg.name : "Choose a package…"}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search packages…" />
          <CommandList>
            <CommandEmpty>No packages found.</CommandEmpty>
            <CommandItem
              value="__no_package__"
              onSelect={() => { onSelectPackage(""); setOpen(false); }}
              className="text-muted-foreground"
            >
              No package
              {!selectedPackageId && <Check className="ml-auto h-4 w-4" />}
            </CommandItem>
            {packageOptions.length > 0 && <CommandSeparator />}
            {packageOptions.map((pkg) => (
              <CommandItem
                key={pkg._id}
                value={pkg.name}
                onSelect={() => { onSelectPackage(pkg._id); setOpen(false); }}
              >
                {pkg.name}
                {selectedPackageId === pkg._id && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function XeroGroupSearchSelect({
  xeroGroups,
  xeroSelectValue,
  xeroImportLoading,
  disabled,
  onSelect,
}: {
  xeroGroups: { contactGroupID: string; name: string; status: string }[];
  xeroSelectValue: string;
  xeroImportLoading: boolean;
  disabled: boolean;
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedGroup =
    xeroSelectValue !== SELECT_XERO_NONE
      ? xeroGroups.find((g) => g.contactGroupID === xeroSelectValue)
      : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={xeroImportLoading || disabled}
          className={cn("min-w-0 justify-between", selectTriggerCls, (xeroImportLoading || disabled) && "opacity-50 cursor-not-allowed")}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {xeroImportLoading ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className={cn("truncate", !selectedGroup && "text-muted-foreground")}>
              {selectedGroup ? selectedGroup.name : "Choose a Xero group to import entities…"}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search Xero groups…" />
          <CommandList>
            <CommandEmpty>No groups found.</CommandEmpty>
            <CommandItem
              value="__no_xero_group__"
              onSelect={() => { onSelect(SELECT_XERO_NONE); setOpen(false); }}
              className="text-muted-foreground"
            >
              No group (manual entities)
              {xeroSelectValue === SELECT_XERO_NONE && <Check className="ml-auto h-4 w-4" />}
            </CommandItem>
            {xeroGroups.map((g) => (
              <CommandItem
                key={g.contactGroupID}
                value={g.name}
                onSelect={() => { onSelect(g.contactGroupID); setOpen(false); }}
              >
                {g.name}
                {xeroSelectValue === g.contactGroupID && <Check className="ml-auto h-4 w-4" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SingleEntityLayout({
  organisations,
  individuals,
  entities,
  onUpdateEntity,
  selectValue,
  onSelectChange,
  contactsLoading,
  packageOptions,
  selectedPackageId,
  onSelectPackage,
}: {
  organisations: ProposalBuilderContactOption[];
  individuals: ProposalBuilderContactOption[];
  entities: ProposalBuilderEntity[];
  onUpdateEntity: (id: string, updates: Partial<ProposalBuilderEntity>) => void;
  selectValue: string;
  onSelectChange: (v: string) => void;
  contactsLoading?: boolean;
  packageOptions?: PackageOption[];
  selectedPackageId?: string;
  onSelectPackage?: (id: string) => void;
}) {
  const entity = entities[0];

  return (
    <div className="w-full space-y-5">
      <section className="w-full space-y-2">
        <SectionHeader
          title="Contact"
          tooltip="Optional. Fills name and registration from your directory (including Xero-linked contacts)."
        />
        <ContactLinkSelect
          organisations={organisations}
          individuals={individuals}
          selectValue={selectValue}
          onSelectChange={onSelectChange}
          contactsLoading={contactsLoading}
        />
      </section>

      {packageOptions && packageOptions.length > 0 && onSelectPackage && (
        <section className="w-full space-y-2">
          <SectionHeader
            title="Package"
            tooltip="Load a pre-built service package. Replaces the current services on the canvas."
          />
          <PackageSelect
            packageOptions={packageOptions}
            selectedPackageId={selectedPackageId}
            onSelectPackage={onSelectPackage}
          />
        </section>
      )}

      {entity ? (
        <FullWidthCollapsible
          title="Entity details"
          defaultOpen={false}
          tooltip="Legal name, entity type, revenue band, and tax references for the mandate."
        >
          <EntityFields entity={entity} onUpdateEntity={onUpdateEntity} />
        </FullWidthCollapsible>
      ) : (
        <p className="text-sm text-muted-foreground">Preparing entity…</p>
      )}
    </div>
  );
}

// ─── Client group: primary contact first (full width), then collapsibles ─────

function ClientGroupLayout({
  organisations,
  individuals,
  entities,
  clientGroup,
  onUpdateClientGroup,
  onUpdateEntity,
  onRemoveEntity,
  onAddEntity,
  replaceEntities,
  entityFilter,
  onEntityFilterChange,
  groupByEntity,
  onGroupByEntityChange,
  contactOptions,
  selectValue,
  onSelectChange,
  contactsLoading,
  userId,
  xeroConnected,
  packageOptions,
  selectedPackageId,
  onSelectPackage,
}: {
  organisations: ProposalBuilderContactOption[];
  individuals: ProposalBuilderContactOption[];
  entities: ProposalBuilderEntity[];
  clientGroup: ProposalBuilderClientGroup;
  onUpdateClientGroup: (u: Partial<ProposalBuilderClientGroup>) => void;
  onUpdateEntity: (id: string, updates: Partial<ProposalBuilderEntity>) => void;
  onRemoveEntity: (id: string) => void;
  onAddEntity: () => void;
  replaceEntities?: (entities: ProposalBuilderEntity[]) => void;
  entityFilter: string;
  onEntityFilterChange: (v: string) => void;
  groupByEntity: boolean;
  onGroupByEntityChange: (v: boolean) => void;
  contactOptions: ProposalBuilderContactOption[];
  selectValue: string;
  onSelectChange: (v: string) => void;
  contactsLoading?: boolean;
  userId?: Id<"users">;
  xeroConnected?: boolean;
  packageOptions?: PackageOption[];
  selectedPackageId?: string;
  onSelectPackage?: (id: string) => void;
}) {
  const getXeroGroups = useAction(api.integrations.getXeroContactGroups);
  const getXeroEntitiesForGroup = useAction(api.integrations.getXeroEntitiesForGroup);

  const [xeroGroups, setXeroGroups] = useState<{ contactGroupID: string; name: string; status: string }[]>([]);
  const [xeroGroupsLoading, setXeroGroupsLoading] = useState(false);
  const [xeroImportLoading, setXeroImportLoading] = useState(false);
  /** Xero ContactIDs belonging to the currently selected group — used to filter the Primary Contact dropdown */
  const [groupXeroContactIds, setGroupXeroContactIds] = useState<Set<string>>(new Set());

  const xeroSelectValue = clientGroup.xeroContactGroupId ?? SELECT_XERO_NONE;

  useEffect(() => {
    if (!userId || !xeroConnected) {
      setXeroGroups([]);
      return;
    }
    let cancelled = false;
    setXeroGroupsLoading(true);
    (async () => {
      try {
        const r = await getXeroGroups({ userId });
        if (cancelled) return;
        if ("groups" in r) setXeroGroups(r.groups);
        else setXeroGroups([]);
      } catch {
        if (!cancelled) setXeroGroups([]);
      } finally {
        if (!cancelled) setXeroGroupsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, xeroConnected, getXeroGroups]);

  const applyXeroGroup = useCallback(
    async (groupId: string) => {
      if (!userId || !replaceEntities) return;
      const meta = xeroGroups.find((g) => g.contactGroupID === groupId);
      setXeroImportLoading(true);
      try {
        const r = await getXeroEntitiesForGroup({ userId, contactGroupId: groupId });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        if (!r.entities.length) {
          toast.warning("This Xero group has no contacts yet.");
          return;
        }
        const mapped = r.entities.map(mapXeroEntityToBuilder);
        replaceEntities(mapped);
        setGroupXeroContactIds(new Set(r.xeroContactIds ?? []));
        onUpdateClientGroup({
          name: meta?.name ?? clientGroup.name,
          xeroContactGroupId: groupId,
        });
        if (r.primaryClientId) {
          onSelectChange(r.primaryClientId);
        } else {
          toast.info(
            "No matching Convex contact for this group yet — sync Xero contacts or pick a primary contact below."
          );
        }
      } catch {
        toast.error("Could not load entities from Xero");
      } finally {
        setXeroImportLoading(false);
      }
    },
    [
      userId,
      replaceEntities,
      getXeroEntitiesForGroup,
      xeroGroups,
      clientGroup.name,
      onUpdateClientGroup,
      onSelectChange,
    ]
  );

  const primaryName =
    selectValue !== SELECT_NONE
      ? contactOptions.find((c) => c._id === selectValue)?.companyName ?? ""
      : "";

  return (
    <div className="w-full space-y-5">
      {userId && xeroConnected && (
        <section className="w-full space-y-2">
          <SectionHeader
            title="Xero contact group"
            tooltip="Imports every contact in that Xero group as entities below. Choose a primary contact after import. Skip if you add entities manually."
          />
          {xeroGroupsLoading ? (
            <div className="flex h-10 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Xero groups…
            </div>
          ) : xeroGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active contact groups in Xero, or groups could not be loaded. Create groups in Xero, or add entities manually below.
            </p>
          ) : (
            <XeroGroupSearchSelect
              xeroGroups={xeroGroups}
              xeroSelectValue={xeroSelectValue}
              xeroImportLoading={xeroImportLoading}
              disabled={!replaceEntities}
              onSelect={(v) => {
                if (v === SELECT_XERO_NONE) {
                  onUpdateClientGroup({ xeroContactGroupId: undefined });
                  setGroupXeroContactIds(new Set());
                  return;
                }
                void applyXeroGroup(v);
              }}
            />
          )}
          {!replaceEntities && (
            <p className="text-xs text-amber-700">Entity replace is unavailable — refresh the page.</p>
          )}
        </section>
      )}

      <section className="w-full space-y-2">
        <SectionHeader
          title="Primary contact"
          tooltip="The client record this proposal is filed under. Separate from entity rows below."
        />
        <ContactLinkSelect
          organisations={groupXeroContactIds.size > 0 ? organisations.filter((c) => c.xeroContactId && groupXeroContactIds.has(c.xeroContactId)) : organisations}
          individuals={groupXeroContactIds.size > 0 ? individuals.filter((c) => c.xeroContactId && groupXeroContactIds.has(c.xeroContactId)) : individuals}
          selectValue={selectValue}
          onSelectChange={onSelectChange}
          contactsLoading={contactsLoading}
        />
        {selectValue !== SELECT_NONE && primaryName ? (
          <p className="text-xs text-muted-foreground">
            Linked to <span className="font-medium text-foreground">{primaryName}</span>
          </p>
        ) : null}
      </section>

      {packageOptions && packageOptions.length > 0 && onSelectPackage && (
        <section className="w-full space-y-2">
          <SectionHeader
            title="Package"
            tooltip="Load a pre-built service package. Replaces the current services on the canvas."
          />
          <PackageSelect
            packageOptions={packageOptions}
            selectedPackageId={selectedPackageId}
            onSelectPackage={onSelectPackage}
          />
        </section>
      )}

      <FullWidthCollapsible
        title="Group identity"
        tooltip="Umbrella name for this relationship (e.g. family or holding group). Not the same as individual entity names below."
      >
        <div className={formGrid2}>
          <Field label="Group name">
            <input
              className={inputCls}
              value={clientGroup.name}
              onChange={(e) => onUpdateClientGroup({ name: e.target.value })}
              placeholder="e.g. Van der Merwe Family Group"
            />
          </Field>
          <Field label="Group type">
            <input
              className={inputCls}
              value={clientGroup.groupType}
              onChange={(e) => onUpdateClientGroup({ groupType: e.target.value })}
              placeholder="e.g. Family, Farming, Holdings…"
            />
          </Field>
          <Field label="Group notes" className="md:col-span-2">
            <textarea
              className={`${inputCls} min-h-[72px] resize-none`}
              value={clientGroup.notes}
              onChange={(e) => onUpdateClientGroup({ notes: e.target.value })}
              placeholder="Shared context, billing assumptions, or scope notes for this group."
            />
          </Field>
        </div>
      </FullWidthCollapsible>

      <FullWidthCollapsible
        title="Entities in this group"
        defaultOpen={false}
        tooltip="One card per legal person or trust. You assign services to each entity on the canvas."
        headerRight={
          <Button type="button" size="sm" variant="secondary" onClick={onAddEntity} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add entity
          </Button>
        }
      >
        <div className="space-y-4">
          {entities.map((entity, index) => (
            <div
              key={entity.id}
              className="rounded-xl border border-border/80 bg-muted/[0.35] p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                  <span className="text-muted-foreground">Entity {index + 1}</span>
                  {entity.name ? (
                    <span className="font-medium text-foreground"> · {entity.name}</span>
                  ) : null}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  {entities.length > 1 && (
                    <>
                      <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => {
                          if (!replaceEntities || index === 0) return;
                          const next = [...entities];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          replaceEntities(next);
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === entities.length - 1}
                        onClick={() => {
                          if (!replaceEntities || index === entities.length - 1) return;
                          const next = [...entities];
                          [next[index], next[index + 1]] = [next[index + 1], next[index]];
                          replaceEntities(next);
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveEntity(entity.id)}
                    aria-label={`Remove entity ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <EntityFields entity={entity} onUpdateEntity={onUpdateEntity} />
            </div>
          ))}
          {entities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entities yet. Use Add entity to create the first one.</p>
          ) : null}
        </div>
      </FullWidthCollapsible>

      <FullWidthCollapsible
        title="Canvas view"
        tooltip="Optional. Group or filter how service rows appear while you drag into Monthly / Yearly / Once-off."
      >
        <div className={formGrid2}>
          <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers3 className="h-4 w-4 shrink-0 text-primary" />
              <span>List layout</span>
            </div>
            <Button
              type="button"
              variant={groupByEntity ? "default" : "outline"}
              size="sm"
              className="w-fit"
              onClick={() => onGroupByEntityChange(!groupByEntity)}
            >
              {groupByEntity ? "Grouped by entity" : "Flat list"}
            </Button>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Filter by entity
            </p>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={entityFilter === "all"}
                label="All entities"
                onClick={() => onEntityFilterChange("all")}
              />
              {entities.map((entity, index) => (
                <FilterChip
                  key={entity.id}
                  active={entityFilter === entity.id}
                  label={entity.name || `Entity ${index + 1}`}
                  onClick={() => onEntityFilterChange(entity.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </FullWidthCollapsible>
    </div>
  );
}

// ─── Shared entity form (always expanded) ─────────────────────────────────────

const YEAR_END_MONTH_OPTIONS = [
  "31 January",
  "28 February",
  "31 March",
  "30 April",
  "31 May",
  "30 June",
  "31 July",
  "31 August",
  "30 September",
  "31 October",
  "30 November",
  "31 December",
];

const SELECT_YE_NONE = "__ye_none__";

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  const years: string[] = [];
  for (let y = current - 2; y <= current + 5; y++) years.push(String(y));
  return years;
})();

function EntityFields({
  entity,
  onUpdateEntity,
}: {
  entity: ProposalBuilderEntity;
  onUpdateEntity: (id: string, updates: Partial<ProposalBuilderEntity>) => void;
}) {
  const typeValue = coerceEntityTypeForSelect(entity.entityType) as EntityType;
  const revenueVal = entity.revenueRange ?? "Not Applicable";
  const taxBandVal = entity.incomeTaxRange ?? "Not Applicable";
  const yeMonthVal = entity.financialYearEndMonth || SELECT_YE_NONE;

  return (
    <div className={formGrid2}>
      <Field label="Legal name">
        <input
          className={inputCls}
          value={entity.name}
          onChange={(e) => onUpdateEntity(entity.id, { name: e.target.value })}
          placeholder="e.g. ABC Farming (Pty) Ltd"
        />
      </Field>
      <Field
        label="Entity type"
        labelTooltip="Legal form — drives defaults and PDF wording where relevant."
      >
        <Select
          value={typeValue}
          onValueChange={(v) => onUpdateEntity(entity.id, { entityType: v })}
        >
          <SelectTrigger className={cn(selectTriggerCls)}>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            {ENTITY_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-sm">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Annual revenue"
        labelTooltip="Turnover band — used for scoping and some fee benchmarks."
      >
        <Select
          value={revenueVal}
          onValueChange={(v) => onUpdateEntity(entity.id, { revenueRange: v })}
        >
          <SelectTrigger className={cn(selectTriggerCls)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {REVENUE_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-sm">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Income tax class"
        labelTooltip="Optional size band (e.g. SARS / company category)."
      >
        <Select
          value={taxBandVal}
          onValueChange={(v) => onUpdateEntity(entity.id, { incomeTaxRange: v })}
        >
          <SelectTrigger className={cn(selectTriggerCls)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {INCOME_TAX_RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-sm">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Financial year-end"
        labelTooltip="Last day of the entity's financial year. Used in engagement letters and work planning."
      >
        <Select
          value={yeMonthVal}
          onValueChange={(v) =>
            onUpdateEntity(entity.id, {
              financialYearEndMonth: v === SELECT_YE_NONE ? undefined : v,
            })
          }
        >
          <SelectTrigger className={cn(selectTriggerCls)}>
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            <SelectItem value={SELECT_YE_NONE} className="text-muted-foreground">
              Not set
            </SelectItem>
            {YEAR_END_MONTH_OPTIONS.map((m) => (
              <SelectItem key={m} value={m} className="text-sm">
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Year-end year"
        labelTooltip="The calendar year of the current financial year-end."
      >
        <Select
          value={entity.financialYearEndYear || SELECT_YE_NONE}
          onValueChange={(v) =>
            onUpdateEntity(entity.id, {
              financialYearEndYear: v === SELECT_YE_NONE ? undefined : v,
            })
          }
        >
          <SelectTrigger className={cn(selectTriggerCls)}>
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-72">
            <SelectItem value={SELECT_YE_NONE} className="text-muted-foreground">
              Not set
            </SelectItem>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={y} className="text-sm">
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Registration no.">
        <input
          className={inputCls}
          value={entity.registrationNumber}
          onChange={(e) => onUpdateEntity(entity.id, { registrationNumber: e.target.value })}
          placeholder="CIPC / CK"
        />
      </Field>
      <Field label="Income tax reference">
        <input
          className={inputCls}
          value={entity.taxNumber}
          onChange={(e) => onUpdateEntity(entity.id, { taxNumber: e.target.value })}
          placeholder="Tax reference"
        />
      </Field>
      <Field label="VAT number" className="sm:col-span-2 sm:max-w-md">
        <input
          className={inputCls}
          value={entity.vatNumber}
          onChange={(e) => onUpdateEntity(entity.id, { vatNumber: e.target.value })}
          placeholder="If registered"
        />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <textarea
          className={`${inputCls} min-h-[72px] resize-none`}
          value={entity.notes}
          onChange={(e) => onUpdateEntity(entity.id, { notes: e.target.value })}
          placeholder="Assumptions or exclusions for this entity only"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
  className,
  labelTooltip,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  labelTooltip?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {labelTooltip ? <HelpHint text={labelTooltip} /> : null}
      </div>
      {children}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function splitContactsForGroupedSelect(options: ProposalBuilderContactOption[]) {
  const organisations: ProposalBuilderContactOption[] = [];
  const individuals: ProposalBuilderContactOption[] = [];
  for (const c of options) {
    const t = c.contactType ?? "organisation";
    if (t === "individual") individuals.push(c);
    else organisations.push(c);
  }
  organisations.sort((a, b) => a.companyName.localeCompare(b.companyName));
  individuals.sort((a, b) => a.companyName.localeCompare(b.companyName));
  return { organisations, individuals };
}

function formatContactOptionLabel(c: ProposalBuilderContactOption): string {
  const xero = c.xeroContactId ? " · Xero" : "";
  const primary = c.companyName.trim() || c.contactName.trim() || c.email;
  if (c.contactType === "individual" && c.contactName && c.contactName !== c.companyName) {
    return `${primary} (${c.contactName})${xero}`;
  }
  return `${primary}${xero}`;
}
