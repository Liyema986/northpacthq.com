"use client";

import type {
  DraggableProvidedDragHandleProps,
  DraggableProvidedDraggableProps,
} from "@hello-pangea/dnd";
import type { ProposalItem, ProposalBuilderEntity } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { Edit3, Copy, Trash2, ToggleLeft, ToggleRight, GripVertical } from "lucide-react";
import { formatCurrency, formatHoursMinutesClock } from "@/lib/service-metrics";
import { cn } from "@/lib/utils";

interface ProposalCardProps {
  item: ProposalItem;
  assignmentLabel: string;
  pricingModeLabel: string;
  serviceValue: number;
  estimatedHours: number;
  onEdit: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onToggleOptional: () => void;
  innerRef?: (element: HTMLDivElement | null) => void;
  draggableProps?: DraggableProvidedDraggableProps;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  isDragging?: boolean;
}

export function ProposalCard({
  item,
  assignmentLabel,
  pricingModeLabel,
  serviceValue,
  estimatedHours,
  onEdit,
  onRemove,
  onDuplicate,
  onToggleOptional,
  innerRef,
  draggableProps,
  dragHandleProps,
  isDragging = false,
}: ProposalCardProps) {
  const effectiveRate = estimatedHours > 0 ? serviceValue / estimatedHours : 0;
  const canDrag = Boolean(dragHandleProps);

  return (
    <div
      ref={innerRef}
      {...draggableProps}
      className={cn(
        "group rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md",
        item.isOptional && "opacity-70",
        isDragging && "rotate-[1deg] border-primary shadow-lg"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          type="button"
          {...(dragHandleProps ?? {})}
          disabled={!canDrag}
          className={cn(
            "rounded-md p-1 pt-1 transition-colors",
            canDrag
              ? "cursor-grab text-muted-foreground hover:bg-secondary hover:text-foreground active:cursor-grabbing"
              : "cursor-default text-muted-foreground/30"
          )}
          aria-label={`Drag ${item.name}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          {/* Header row */}
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h4 className="text-sm font-semibold text-foreground truncate">{item.name}</h4>
              {item.isOptional && (
                <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Optional
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 shrink-0">
              <button
                type="button"
                onClick={onToggleOptional}
                className="rounded p-1 hover:bg-secondary"
                title="Toggle optional"
              >
                {item.isOptional
                  ? <ToggleLeft  className="h-3.5 w-3.5 text-muted-foreground" />
                  : <ToggleRight className="h-3.5 w-3.5 text-primary" />
                }
              </button>
              <button type="button" onClick={onEdit}      className="rounded p-1 hover:bg-secondary" title="Edit">
                <Edit3  className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button type="button" onClick={onDuplicate} className="rounded p-1 hover:bg-secondary" title="Duplicate">
                <Copy   className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button type="button" onClick={onRemove}    className="rounded p-1 hover:bg-secondary" title="Remove">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </button>
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
          )}

          {/* Summary chips grid */}
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
            <SummaryChip label="Billing"     value={CATEGORY_LABELS[item.billingCategory]} />
            <SummaryChip label="Applies to"  value={assignmentLabel} />
            <SummaryChip label="Pricing"     value={formatCurrency(serviceValue)} />
            <SummaryChip label="Est. Time"   value={formatHoursMinutesClock(estimatedHours)} />
          </div>

          {/* Meta tags */}
          <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-medium text-muted-foreground">
            <span className="rounded-full bg-secondary px-2 py-0.5">{pricingModeLabel}</span>
            {item.pricingDriver && (
              <span className="rounded-full bg-secondary px-2 py-0.5">{item.pricingDriver}</span>
            )}
            <span className="rounded-full bg-secondary px-2 py-0.5">
              Rate {effectiveRate > 0 ? formatCurrency(effectiveRate) : "R0.00"}
            </span>
            {item.frequency && (
              <span className="rounded-full bg-secondary px-2 py-0.5">
                {item.frequency.replace(/_/g, " ")}
              </span>
            )}
            {item.duePattern && (
              <span className="rounded-full bg-secondary px-2 py-0.5">{item.duePattern}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}
