"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const statCardConfigs: Record<
  string,
  { bg: string; iconBg: string; iconColor: string; textColor: string; borderColor: string }
> = {
  default:       { bg: "bg-white", iconBg: "bg-slate-100",    iconColor: "text-slate-600",   textColor: "text-slate-900", borderColor: "border-slate-200" },
  FileText:      { bg: "bg-white", iconBg: "bg-slate-100",    iconColor: "text-slate-600",   textColor: "text-slate-900", borderColor: "border-slate-200" },
  Target:        { bg: "bg-white", iconBg: "bg-violet-50",    iconColor: "text-violet-600",  textColor: "text-slate-900", borderColor: "border-slate-200" },
  Banknote:      { bg: "bg-white", iconBg: "bg-emerald-50",   iconColor: "text-emerald-600", textColor: "text-slate-900", borderColor: "border-slate-200" },
  BarChart3:     { bg: "bg-white", iconBg: "bg-blue-50",      iconColor: "text-blue-600",    textColor: "text-slate-900", borderColor: "border-slate-200" },
  Clock:         { bg: "bg-white", iconBg: "bg-amber-50",     iconColor: "text-amber-600",   textColor: "text-slate-900", borderColor: "border-slate-200" },
  CheckCircle:   { bg: "bg-white", iconBg: "bg-emerald-50",   iconColor: "text-emerald-600", textColor: "text-slate-900", borderColor: "border-slate-200" },
  Package:       { bg: "bg-white", iconBg: "bg-slate-100",    iconColor: "text-slate-600",   textColor: "text-slate-900", borderColor: "border-slate-200" },
  ListFilter:    { bg: "bg-white", iconBg: "bg-blue-50",      iconColor: "text-blue-600",    textColor: "text-slate-900", borderColor: "border-slate-200" },
  Users:         { bg: "bg-white", iconBg: "bg-slate-100",    iconColor: "text-slate-600",   textColor: "text-slate-900", borderColor: "border-slate-200" },
  Building2:     { bg: "bg-white", iconBg: "bg-cyan-50",      iconColor: "text-cyan-600",    textColor: "text-slate-900", borderColor: "border-slate-200" },
  AlertTriangle: { bg: "bg-white", iconBg: "bg-amber-50",     iconColor: "text-amber-600",   textColor: "text-slate-900", borderColor: "border-slate-200" },
  XCircle:       { bg: "bg-white", iconBg: "bg-red-50",       iconColor: "text-red-600",     textColor: "text-slate-900", borderColor: "border-slate-200" },
  Layers:        { bg: "bg-white", iconBg: "bg-slate-100",    iconColor: "text-slate-600",   textColor: "text-slate-900", borderColor: "border-slate-200" },
  CheckSquare:   { bg: "bg-white", iconBg: "bg-slate-100",    iconColor: "text-slate-600",   textColor: "text-slate-900", borderColor: "border-slate-200" },
  ScrollText:    { bg: "bg-white", iconBg: "bg-teal-50",      iconColor: "text-teal-600",    textColor: "text-slate-900", borderColor: "border-slate-200" },
};

export interface StatsCardProps {
  title: string;
  value: string;
  comparison: string;
  icon: LucideIcon;
  iconVariant?: string;
  className?: string;
}

export function StatsCard({ title, value, comparison, icon: Icon, iconVariant, className }: StatsCardProps) {
  const variant = iconVariant ?? (Icon as { displayName?: string; name?: string }).displayName ?? (Icon as { name?: string }).name ?? "default";
  const colors = statCardConfigs[variant] ?? statCardConfigs.default;

  return (
    <div className={cn(colors.bg, "p-4 border rounded-md transition-all duration-150 hover:border-slate-300 cursor-default", colors.borderColor, className)}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={cn("w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0", colors.iconBg)}>
          <Icon size={15} className={colors.iconColor} strokeWidth={2} />
        </div>
        <p className="text-[11px] font-medium text-slate-700 truncate leading-tight">{title}</p>
      </div>
      <p className={cn("text-2xl font-semibold mb-1.5 leading-none tracking-tight", colors.textColor)}>{value}</p>
      <p className="text-[10px] font-normal text-slate-500 truncate leading-tight">{comparison}</p>
    </div>
  );
}
