"use client";

import { useState } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import type {
  ProposalItem,
  ProposalBuilderEntity,
  ProposalBuilderClientGroup,
  ProposalBuilderContactOption,
  BillingCategory,
  ClientGroupMode,
} from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { DropZone } from "./DropZone";
import { ProposalCard } from "./ProposalCard";
import { EntitySetupPanel, type PackageOption } from "./EntitySetupPanel";
import {
  getEntityAssignmentLabel,
  getItemGroupingLabel,
  getItemPricingModeLabel,
  getItemContributionForEntity,
  getItemHoursContributionForEntity,
  getItemTotalHours,
  getItemTotalPrice,
  billingDroppableId,
  matchesEntityFilter,
  resolveAssignedEntityIds,
} from "@/lib/proposal-entities";
import { formatCurrency } from "@/lib/service-metrics";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Id } from "@/convex/_generated/dataModel";

/** Grid view lists the same item under multiple entity columns; keys and DnD ids must be unique per cell. */
export const PROPOSAL_GRID_DRAG_PREFIX = "gridcell:";

export function parseProposalCanvasDraggableId(draggableId: string): string {
  if (!draggableId.startsWith(PROPOSAL_GRID_DRAG_PREFIX)) return draggableId;
  const rest = draggableId.slice(PROPOSAL_GRID_DRAG_PREFIX.length);
  const sep = "::";
  const at = rest.indexOf(sep);
  if (at === -1) return rest;
  return rest.slice(0, at);
}

const CATEGORIES: BillingCategory[] = ["monthly", "yearly", "onceoff"];

const categoryStyles: Record<BillingCategory, { border: string; bg: string; dot: string; text: string }> = {
  monthly: { border: "border-blue-200/60",   bg: "bg-blue-50/40",    dot: "bg-blue-500",   text: "text-blue-600" },
  yearly:  { border: "border-violet-200/60", bg: "bg-violet-50/40",  dot: "bg-violet-500", text: "text-violet-600" },
  onceoff: { border: "border-amber-200/60",  bg: "bg-amber-50/40",   dot: "bg-amber-500",  text: "text-amber-600" },
};

interface ProposalCanvasProps {
  items:                  ProposalItem[];
  entities:               ProposalBuilderEntity[];
  entityFilter:           string;
  onEntityFilterChange:   (v: string) => void;
  groupByEntity:          boolean;
  onGroupByEntityChange:  (v: boolean) => void;
  onAddEntity:            () => void;
  onUpdateEntity:         (id: string, u: Partial<ProposalBuilderEntity>) => void;
  onRemoveEntity:         (id: string) => void;
  replaceEntities?:       (entities: ProposalBuilderEntity[]) => void;
  onEditItem:             (item: ProposalItem) => void;
  onRemoveItem:           (id: string) => void;
  onDuplicateItem:        (id: string) => void;
  onToggleOptional:       (id: string) => void;
  clientGroupMode:        ClientGroupMode;
  onClientGroupModeChange:(mode: ClientGroupMode) => void;
  clientGroup:            ProposalBuilderClientGroup;
  onUpdateClientGroup:    (u: Partial<ProposalBuilderClientGroup>) => void;
  contactOptions:         ProposalBuilderContactOption[];
  selectedClientId:       string;
  onSelectContact:        (clientId: string, option: ProposalBuilderContactOption | null) => void;
  contactsLoading?:       boolean;
  userId?:                Id<"users">;
  xeroConnected?:         boolean;
  engagementLetterAfterAccept: boolean;
  onEngagementLetterAfterAcceptChange: (v: boolean) => void;
  packageOptions?: PackageOption[];
  selectedPackageId?: string;
  onSelectPackage?: (packageId: string) => void;
}

export function ProposalCanvas({
  items, entities, entityFilter, onEntityFilterChange,
  groupByEntity, onGroupByEntityChange,
  onAddEntity, onUpdateEntity, onRemoveEntity, replaceEntities,
  onEditItem, onRemoveItem, onDuplicateItem, onToggleOptional,
  clientGroupMode, onClientGroupModeChange, clientGroup, onUpdateClientGroup,
  contactOptions, selectedClientId, onSelectContact, contactsLoading,
  userId, xeroConnected,
  engagementLetterAfterAccept, onEngagementLetterAfterAcceptChange,
  packageOptions, selectedPackageId, onSelectPackage,
}: ProposalCanvasProps) {
  const useGridLayout = entities.length > 1 && entityFilter === "all";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-1.5">
            <h2 className="text-[16px] font-semibold text-slate-800">Proposal Builder</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#C8A96E]/40"
                  aria-label="How the Proposal Builder works"
                >
                  <HelpCircle className="h-4 w-4" strokeWidth={2} />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                className="max-w-[320px] text-left text-[13px] font-normal leading-relaxed text-slate-700"
              >
                Set up entities, then drag services into each billing section. In the multi-entity
                grid, drop on a column to assign that service to that entity only.
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      <EntitySetupPanel
        entities={entities}
        entityFilter={entityFilter}
        onEntityFilterChange={onEntityFilterChange}
        groupByEntity={groupByEntity}
        onGroupByEntityChange={onGroupByEntityChange}
        onAddEntity={onAddEntity}
        onUpdateEntity={onUpdateEntity}
        onRemoveEntity={onRemoveEntity}
        replaceEntities={replaceEntities}
        clientGroupMode={clientGroupMode}
        onClientGroupModeChange={onClientGroupModeChange}
        clientGroup={clientGroup}
        onUpdateClientGroup={onUpdateClientGroup}
        contactOptions={contactOptions}
        selectedClientId={selectedClientId}
        onSelectContact={onSelectContact}
        contactsLoading={contactsLoading}
        userId={userId}
        xeroConnected={xeroConnected}
        engagementLetterAfterAccept={engagementLetterAfterAccept}
        onEngagementLetterAfterAcceptChange={onEngagementLetterAfterAcceptChange}
        packageOptions={packageOptions}
        selectedPackageId={selectedPackageId}
        onSelectPackage={onSelectPackage}
      />

      {useGridLayout ? (
        <EntityGridView
          items={items}
          entities={entities}
          onEditItem={onEditItem}
          onRemoveItem={onRemoveItem}
          onDuplicateItem={onDuplicateItem}
          onToggleOptional={onToggleOptional}
        />
      ) : (
        <SingleColumnView
          items={items}
          entities={entities}
          entityFilter={entityFilter}
          groupByEntity={groupByEntity}
          onEditItem={onEditItem}
          onRemoveItem={onRemoveItem}
          onDuplicateItem={onDuplicateItem}
          onToggleOptional={onToggleOptional}
        />
      )}
    </div>
  );
}

// ── Grid view: entities as columns, billing categories as rows ────────────────

function EntityGridView({
  items, entities, onEditItem, onRemoveItem, onDuplicateItem, onToggleOptional,
}: {
  items: ProposalItem[]; entities: ProposalBuilderEntity[];
  onEditItem: (i: ProposalItem) => void; onRemoveItem: (id: string) => void;
  onDuplicateItem: (id: string) => void; onToggleOptional: (id: string) => void;
}) {
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());
  const toggleCard = (key: string) => setCollapsedCards((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  return (
    <div className="space-y-6">
      {CATEGORIES.map((cat) => {
        const style = categoryStyles[cat];
        return (
          <section
            key={cat}
            className={cn(
              "rounded-2xl border p-4 transition-colors",
              style.border,
              "bg-white"
            )}
          >
            <div className="mb-4 flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", style.dot)} />
              <h3 className={cn("text-sm font-semibold", style.text)}>
                {CATEGORY_LABELS[cat]} Services
              </h3>
            </div>

            {/* One Droppable per entity column so drops target that entity only */}
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(${entities.length}, minmax(0, 1fr))` }}
            >
              {entities.map((entity) => {
                const entityItems = items.filter(
                  (i) =>
                    i.billingCategory === cat &&
                    resolveAssignedEntityIds(i, entities).includes(entity.id)
                );
                const entityTotal = entityItems
                  .filter((i) => !i.isOptional)
                  .reduce(
                    (s, i) => s + getItemContributionForEntity(i, entity.id, entities),
                    0
                  );

                return (
                  <Droppable
                    key={entity.id}
                    droppableId={billingDroppableId(cat, entity.id)}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "min-w-0 rounded-xl p-1 transition-colors -m-1",
                          snapshot.isDraggingOver && style.bg
                        )}
                      >
                        <div className="mb-3 rounded-lg bg-slate-100 px-3 py-2">
                          <h4 className="truncate text-xs font-semibold text-slate-800">
                            {entity.name || "Untitled"}
                          </h4>
                          {entityTotal > 0 && (
                            <p className="mt-0.5 text-[10px] font-medium text-emerald-600">
                              {formatCurrency(entityTotal)}
                              {cat === "monthly" ? "/mo" : cat === "yearly" ? "/yr" : ""}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          {entityItems.length === 0 ? (
                            <div className="flex min-h-[80px] items-center justify-center rounded-xl border border-dashed border-slate-200 p-4 text-center">
                              <p className="text-[10px] text-slate-400">Drop services here</p>
                            </div>
                          ) : (
                            entityItems.map((item, index) => {
                              const stableItemId = item.id || `idx-${entity.id}-${index}`;
                              const cardKey = `${stableItemId}|${entity.id}`;
                              const cellDndId = `${PROPOSAL_GRID_DRAG_PREFIX}${stableItemId}::${entity.id}`;
                              const isCollapsed = collapsedCards.has(cardKey);
                              const cellPrice = getItemContributionForEntity(
                                item,
                                entity.id,
                                entities
                              );
                              const cellHours = getItemHoursContributionForEntity(
                                item,
                                entity.id,
                                entities
                              );
                              return (
                                <Draggable
                                  key={cellDndId}
                                  draggableId={cellDndId}
                                  index={index}
                                  isDragDisabled
                                >
                                  {(dp) => (
                                    <div
                                      ref={dp.innerRef}
                                      {...dp.draggableProps}
                                      className={cn(
                                        "group rounded-lg border border-slate-100 bg-white shadow-sm transition-all hover:shadow-md hover:border-slate-200",
                                        item.isOptional && "opacity-70"
                                      )}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => toggleCard(cardKey)}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-left"
                                      >
                                        {isCollapsed
                                          ? <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                                          : <ChevronDown  className="h-3 w-3 shrink-0 text-muted-foreground" />
                                        }
                                        <h4 className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                                          {item.name}
                                        </h4>
                                        <span className="shrink-0 text-[10px] font-medium text-foreground">
                                          {formatCurrency(cellPrice)}
                                        </span>
                                      </button>
                                      {!isCollapsed && (
                                        <div className="border-t border-slate-100 px-3 pb-2 pt-1.5">
                                          <div className="text-[10px] text-muted-foreground">
                                            {cellHours}h
                                            {item.isOptional && " · Optional"}
                                          </div>
                                          <div className="mt-1.5 flex items-center gap-1">
                                            <button type="button" onClick={() => onEditItem(item)} className="rounded p-0.5 hover:bg-slate-100 text-[10px] text-slate-400" title="Edit">✎</button>
                                            <button type="button" onClick={() => onDuplicateItem(item.id)} className="rounded p-0.5 hover:bg-slate-100 text-[10px] text-slate-400" title="Duplicate">⧉</button>
                                            <button type="button" onClick={() => onToggleOptional(item.id)} className="rounded p-0.5 hover:bg-slate-100 text-[10px] text-slate-400" title="Toggle optional">{item.isOptional ? "☐" : "☑"}</button>
                                            <button type="button" onClick={() => onRemoveItem(item.id)} className="rounded p-0.5 hover:bg-red-50 text-[10px] text-red-500" title="Remove">✕</button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })
                          )}
                        </div>
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ── Single column view ────────────────────────────────────────────────────────

function SingleColumnView({
  items, entities, entityFilter, groupByEntity,
  onEditItem, onRemoveItem, onDuplicateItem, onToggleOptional,
}: {
  items: ProposalItem[]; entities: ProposalBuilderEntity[];
  entityFilter: string; groupByEntity: boolean;
  onEditItem: (i: ProposalItem) => void; onRemoveItem: (id: string) => void;
  onDuplicateItem: (id: string) => void; onToggleOptional: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {CATEGORIES.map((cat) => {
        const filteredItems = items.filter(
          (i) =>
            i.billingCategory === cat &&
            matchesEntityFilter(i, entityFilter, entities)
        );
        const style = categoryStyles[cat];
        const total = filteredItems
          .filter((i) => !i.isOptional)
          .reduce((s, i) => s + getItemTotalPrice(i, entities), 0);

        const visibleItems = groupByEntity
          ? [...filteredItems].sort((a, b) =>
              getItemGroupingLabel(a, entities).localeCompare(getItemGroupingLabel(b, entities))
            )
          : filteredItems;

        return (
          <Droppable droppableId={cat} key={cat}>
            {(provided, snapshot) => (
              <section
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "rounded-2xl border p-4 transition-colors",
                  style.border,
                  snapshot.isDraggingOver ? style.bg : "bg-white"
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                    <h3 className={cn("text-sm font-semibold", style.text)}>
                      {CATEGORY_LABELS[cat]} Services
                    </h3>
                    <span className="text-[12px] text-slate-400">({filteredItems.length})</span>
                  </div>
                  {total > 0 && (
                    <span className="text-sm font-semibold text-emerald-600">
                      {formatCurrency(total)}
                      {cat === "monthly" ? "/mo" : cat === "yearly" ? "/yr" : ""}
                    </span>
                  )}
                </div>

                <div className="min-h-[148px] space-y-3">
                  {filteredItems.length === 0 ? (
                    <DropZone category={cat} isActive={snapshot.isDraggingOver} />
                  ) : (
                    visibleItems.filter((item) => item?.id).map((item, index) => {
                      const showGroupLabel =
                        groupByEntity &&
                        (index === 0 ||
                          getItemGroupingLabel(visibleItems[index - 1], entities) !==
                            getItemGroupingLabel(item, entities));

                      return (
                        <div key={`${item.id}-${index}`} className="space-y-2">
                          {showGroupLabel && (
                            <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              {getItemGroupingLabel(item, entities)}
                            </div>
                          )}
                          <Draggable draggableId={item.id} index={index} isDragDisabled={groupByEntity}>
                            {(dp, ds) => (
                              <ProposalCard
                                item={item}
                                assignmentLabel={getEntityAssignmentLabel(item, entities)}
                                pricingModeLabel={getItemPricingModeLabel(item.entityPricingMode)}
                                serviceValue={getItemTotalPrice(item, entities)}
                                estimatedHours={getItemTotalHours(item, entities)}
                                onEdit={() => onEditItem(item)}
                                onRemove={() => onRemoveItem(item.id)}
                                onDuplicate={() => onDuplicateItem(item.id)}
                                onToggleOptional={() => onToggleOptional(item.id)}
                                innerRef={dp.innerRef}
                                draggableProps={dp.draggableProps}
                                dragHandleProps={groupByEntity ? null : dp.dragHandleProps}
                                isDragging={ds.isDragging}
                              />
                            )}
                          </Draggable>
                        </div>
                      );
                    })
                  )}
                  {provided.placeholder}
                </div>
              </section>
            )}
          </Droppable>
        );
      })}
    </div>
  );
}
