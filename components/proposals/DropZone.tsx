"use client";

import type { BillingCategory } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const categoryStyles: Record<BillingCategory, string> = {
  monthly: "border-blue-300/50 bg-blue-50/40",
  yearly:  "border-violet-300/50 bg-violet-50/40",
  onceoff: "border-amber-300/50 bg-amber-50/40",
};

interface DropZoneProps {
  category: BillingCategory;
  isActive?: boolean;
}

export function DropZone({ category, isActive = false }: DropZoneProps) {
  return (
    <div
      className={cn(
        "flex min-h-[148px] flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-all",
        categoryStyles[category],
        isActive && "scale-[1.01] shadow-sm"
      )}
    >
      <div className="mb-3 rounded-full bg-secondary p-2.5">
        <Plus className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">Drag a service here</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Drop to add a {CATEGORY_LABELS[category].toLowerCase()} service
      </p>
    </div>
  );
}
