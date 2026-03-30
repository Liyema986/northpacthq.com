"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Sheet, SheetContent, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  ArrowUp,
  ArrowDown,
  Pencil,
  Plus,
  X,
  BarChart3,
  Receipt,
  Percent,
  TrendingUp,
  Globe,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ACCENT = "#C8A96E";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRICING_TOOL_SECTIONS = [
  { id: "revenue-ranges", label: "Revenue Ranges", icon: BarChart3 },
  { id: "fees-display", label: "Fees & Display", icon: Receipt },
  { id: "tax-rates", label: "Tax & Currency", icon: Percent },
  { id: "upsell-annualised", label: "Upsell & Annualised", icon: TrendingUp },
] as const;

type SectionId = (typeof PRICING_TOOL_SECTIONS)[number]["id"];

const PREDEFINED_ANNUAL_RANGES = [
  "Nil",
  "Up to R1M",
  "R1M - R2,5M",
  "R2.5M - R5M",
  "R5M - R10M",
  "R10M - R20M",
  "R20M - R50M",
  "R50M - R80M",
  "R80M - R120M",
  "R120M - R180M",
  "R180M - R5B",
];

const PREDEFINED_SECOND_RANGES = [
  "Income tax total/income ranges",
  "Less than R1m",
  "R1m - R20m",
  "R20m - R50m",
  "R50m - R100m",
  "More than R100m",
];

const RANGE_OTHER_VALUE = "__other__";

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingToolPage() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  const settings = useQuery(api.pricingTool.getSettings, userId ? { userId } : "skip");
  const updateSettings = useMutation(api.pricingTool.updateSettings);
  const addTaxRateMutation = useMutation(api.pricingTool.addTaxRate);
  const removeTaxRateMutation = useMutation(api.pricingTool.removeTaxRate);
  const setDefaultTaxRateMutation = useMutation(api.pricingTool.setDefaultTaxRate);
  const updateTaxRateMutation = useMutation(api.pricingTool.updateTaxRate);

  const [activeSection, setActiveSection] = useState<SectionId>("revenue-ranges");

  // Revenue Ranges
  const [annualRanges, setAnnualRanges] = useState<string[]>([]);
  const [secondRanges, setSecondRanges] = useState<string[]>([]);

  // Fees & Display
  const [showFees, setShowFees] = useState<"breakdown" | "total-only">("breakdown");
  const [sectionSubTotals, setSectionSubTotals] = useState(false);
  const [dontRoundPrices, setDontRoundPrices] = useState(false);
  const [applyMinFee, setApplyMinFee] = useState(true);
  const [minMonthlyFee, setMinMonthlyFee] = useState("350");
  const [minMonthlyFeeError, setMinMonthlyFeeError] = useState<string | null>(null);

  // Tax & Currency
  const [currency, setCurrency] = useState("ZAR");
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);

  // Add Tax Rate Sheet
  const [addTaxOpen, setAddTaxOpen] = useState(false);
  const [newTaxName, setNewTaxName] = useState("");
  const [newTaxRate, setNewTaxRate] = useState("0");
  const [newTaxNameError, setNewTaxNameError] = useState("");
  const [newTaxRateError, setNewTaxRateError] = useState("");
  const [savingTax, setSavingTax] = useState(false);

  // Edit Tax Rate Sheet
  const [editTaxSheetId, setEditTaxSheetId] = useState<string | null>(null);
  const [editingTaxName, setEditingTaxName] = useState("");
  const [editingTaxRate, setEditingTaxRate] = useState("");
  const [editTaxNameError, setEditTaxNameError] = useState("");
  const [editTaxRateError, setEditTaxRateError] = useState("");
  const [savingEditTax, setSavingEditTax] = useState(false);

  // Delete Tax
  const [deleteTaxId, setDeleteTaxId] = useState<string | null>(null);

  // Upsell & Annualised
  const [upsellSection, setUpsellSection] = useState<"consider" | "roadmap">("consider");
  const [displayFeesUpsell, setDisplayFeesUpsell] = useState<"always" | "never" | "optional">("always");
  const [enableAnnualised, setEnableAnnualised] = useState(true);
  const [discountOrIncrease, setDiscountOrIncrease] = useState<"discount" | "increase">("discount");
  const [annualisedDiscount, setAnnualisedDiscount] = useState("0");
  const [annualisedDiscountError, setAnnualisedDiscountError] = useState<string | null>(null);

  // Add Range Sheet
  const [addRangeDialog, setAddRangeDialog] = useState<"annual" | "second" | null>(null);
  const [newRangeDropdownValue, setNewRangeDropdownValue] = useState("");
  const [newRangeLabel, setNewRangeLabel] = useState("");

  // Seed local state from Convex on load
  useEffect(() => {
    if (!settings) return;
    setAnnualRanges(settings.annualRevenueRanges);
    setSecondRanges(settings.secondStyleRanges);
    setShowFees(settings.showFees);
    setSectionSubTotals(settings.sectionSubTotals);
    setDontRoundPrices(settings.dontRoundPrices);
    setApplyMinFee(settings.applyMinFee);
    setMinMonthlyFee(String(settings.minMonthlyFee));
    setCurrency(settings.currency);
    setTaxRates(settings.taxRates.map((r) => ({ id: r.id, name: r.name, rate: r.ratePercent, isDefault: r.isDefault })));
    setUpsellSection(settings.upsellSection);
    setDisplayFeesUpsell(settings.displayFeesUpsell);
    setEnableAnnualised(settings.enableAnnualised);
    setDiscountOrIncrease(settings.discountOrIncrease);
    setAnnualisedDiscount(settings.annualisedDiscount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?._id]);

  async function save(patch: Parameters<typeof updateSettings>[0]["patch"]) {
    if (!userId) return;
    try {
      await updateSettings({ userId, patch });
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    }
  }

  // ─── Revenue Range helpers ─────────────────────────────────────────────────

  async function moveRange(which: "annual" | "second", index: number, dir: "up" | "down") {
    const list = which === "annual" ? annualRanges : secondRanges;
    const next = dir === "up" ? index - 1 : index + 1;
    if (next < 0 || next >= list.length) return;
    const copy = [...list];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    if (which === "annual") {
      setAnnualRanges(copy);
      await save({ annualRevenueRanges: copy });
    } else {
      setSecondRanges(copy);
      await save({ secondStyleRanges: copy });
    }
  }

  async function removeRange(which: "annual" | "second", index: number) {
    const list = which === "annual" ? [...annualRanges] : [...secondRanges];
    list.splice(index, 1);
    if (which === "annual") {
      setAnnualRanges(list);
      await save({ annualRevenueRanges: list });
    } else {
      setSecondRanges(list);
      await save({ secondStyleRanges: list });
    }
  }

  function updateRangeLabel(which: "annual" | "second", index: number, value: string) {
    if (which === "annual") {
      const copy = [...annualRanges];
      copy[index] = value;
      setAnnualRanges(copy);
    } else {
      const copy = [...secondRanges];
      copy[index] = value;
      setSecondRanges(copy);
    }
  }

  async function handleAddRange() {
    const label = newRangeDropdownValue === RANGE_OTHER_VALUE ? newRangeLabel.trim() : newRangeDropdownValue;
    if (!label) return;
    if (addRangeDialog === "annual") {
      const next = [...annualRanges, label];
      setAnnualRanges(next);
      await save({ annualRevenueRanges: next });
    } else {
      const next = [...secondRanges, label];
      setSecondRanges(next);
      await save({ secondStyleRanges: next });
    }
    setAddRangeDialog(null);
    setNewRangeDropdownValue("");
    setNewRangeLabel("");
  }

  // ─── Tax rate handlers ─────────────────────────────────────────────────────

  async function handleAddTaxRate() {
    const name = newTaxName.trim();
    let hasError = false;
    if (!name) { setNewTaxNameError("Name is required"); hasError = true; }
    const rate = parseFloat(newTaxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) { setNewTaxRateError("Rate must be between 0 and 100"); hasError = true; }
    if (hasError) return;
    setSavingTax(true);
    try {
      await addTaxRateMutation({ userId: userId!, name, ratePercent: rate });
      toast.success("Tax rate added");
      setAddTaxOpen(false);
      setNewTaxName("");
      setNewTaxRate("0");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add tax rate");
    } finally {
      setSavingTax(false);
    }
  }

  function handleOpenEditTax(rate: TaxRate) {
    setEditTaxSheetId(rate.id);
    setEditingTaxName(rate.name);
    setEditingTaxRate(String(rate.rate));
    setEditTaxNameError("");
    setEditTaxRateError("");
  }

  async function handleSaveTaxEdit() {
    if (!editTaxSheetId || !userId) return;
    const name = editingTaxName.trim();
    let hasError = false;
    if (!name) { setEditTaxNameError("Name is required"); hasError = true; }
    const rate = parseFloat(editingTaxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) { setEditTaxRateError("Rate must be between 0 and 100"); hasError = true; }
    if (hasError) return;
    setSavingEditTax(true);
    try {
      await updateTaxRateMutation({ userId, taxRateId: editTaxSheetId, name, ratePercent: rate });
      toast.success("Tax rate updated");
      setEditTaxSheetId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSavingEditTax(false);
    }
  }

  async function handleSetDefault(id: string) {
    if (!userId) return;
    await setDefaultTaxRateMutation({ userId, taxRateId: id });
    toast.success("Default updated");
  }

  async function handleDeleteTax() {
    if (!deleteTaxId || !userId) return;
    try {
      await removeTaxRateMutation({ userId, taxRateId: deleteTaxId });
      toast.success("Tax rate removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setDeleteTaxId(null);
    }
  }

  const addRangePredefinedOptions =
    addRangeDialog === "annual" ? PREDEFINED_ANNUAL_RANGES : PREDEFINED_SECOND_RANGES;

  const loading = settings === undefined;

  // ─── Stat tiles ───────────────────────────────────────────────────────────

  const STAT_TILES = [
    {
      id: "revenue-ranges" as SectionId,
      label: "Revenue Ranges",
      value: loading ? null : String(annualRanges.length + secondRanges.length),
      sublabel: loading ? "" : `${annualRanges.length} annual · ${secondRanges.length} second`,
      icon: BarChart3,
      iconBg: "bg-blue-50",
      iconColor: "#3b82f6",
    },
    {
      id: "fees-display" as SectionId,
      label: "Fees & Display",
      value: loading ? null : showFees === "breakdown" ? "Breakdown" : "Total",
      sublabel: loading ? "" : applyMinFee ? `Min. R${minMonthlyFee}/mo` : "No minimum",
      icon: Receipt,
      iconBg: "bg-[#C8A96E]/10",
      iconColor: ACCENT,
    },
    {
      id: "tax-rates" as SectionId,
      label: "Tax Rates",
      value: loading ? null : String(taxRates.length),
      sublabel: loading ? "" : (taxRates.find((t) => t.isDefault)?.name ?? "None default"),
      icon: Percent,
      iconBg: "bg-emerald-50",
      iconColor: "#10b981",
    },
    {
      id: "tax-rates" as SectionId,
      label: "Currency",
      value: loading ? null : currency,
      sublabel: "Default currency",
      icon: Globe,
      iconBg: "bg-violet-50",
      iconColor: "#8b5cf6",
    },
    {
      id: "upsell-annualised" as SectionId,
      label: "Upsell Section",
      value: loading ? null : upsellSection.charAt(0).toUpperCase() + upsellSection.slice(1),
      sublabel: loading ? "" : enableAnnualised ? "Annualised on" : "Annualised off",
      icon: TrendingUp,
      iconBg: "bg-amber-50",
      iconColor: "#f59e0b",
    },
  ] as const;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Header />
      <div className="px-6 py-6 space-y-5 max-w-[1600px]">

        {/* ── Stat tiles ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STAT_TILES.map(({ id, label, value, sublabel, icon: Icon, iconBg, iconColor }, i) => (
            <button
              key={`${label}-${i}`}
              onClick={() => setActiveSection(id)}
              className={cn(
                "bg-white border rounded-xl p-4 text-left transition-all cursor-pointer hover:border-slate-200",
                activeSection === id ? "border-[#C8A96E]/40 ring-1 ring-[#C8A96E]/20" : "border-slate-100"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 leading-none">{label}</span>
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
                  <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
                </div>
              </div>
              {value === null ? (
                <Skeleton className="h-7 w-12 mt-1" />
              ) : (
                <p className="text-[26px] font-bold text-slate-900 leading-none tabular-nums truncate">{value}</p>
              )}
              <p className="text-[11px] text-slate-400 mt-1 leading-tight truncate">{sublabel}</p>
            </button>
          ))}
        </div>

        {/* ── Section selector + contextual actions ─────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Select value={activeSection} onValueChange={(v) => setActiveSection(v as SectionId)}>
              <SelectTrigger className="h-9 w-[200px] text-[13px] font-normal text-slate-800 border-slate-200 bg-white hover:bg-slate-50 rounded-lg transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="bg-white border-slate-200 shadow-lg rounded-lg p-1 min-w-[200px]">
                {PRICING_TOOL_SECTIONS.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-[13px] font-normal text-slate-800 rounded-md cursor-pointer hover:bg-slate-50">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeSection === "revenue-ranges" && (
              <>
                <button
                  onClick={() => { setAddRangeDialog("annual"); setNewRangeDropdownValue(""); setNewRangeLabel(""); }}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Annual Range
                </button>
                <button
                  onClick={() => { setAddRangeDialog("second"); setNewRangeDropdownValue(""); setNewRangeLabel(""); }}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: ACCENT }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Second Range
                </button>
              </>
            )}
            {activeSection === "tax-rates" && (
              <button
                onClick={() => { setAddTaxOpen(true); setNewTaxName(""); setNewTaxRate("0"); setNewTaxNameError(""); setNewTaxRateError(""); }}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: ACCENT }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Tax Rate
              </button>
            )}
          </div>
        </div>

        {/* ── Revenue Ranges ─────────────────────────────────────────────── */}
        {activeSection === "revenue-ranges" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Annual ranges */}
            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <span className="text-[14px] font-semibold text-slate-900">Annual Revenue Ranges</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Used in proposals for annual revenue variation line items</p>
                </div>
                {!loading && <span className="text-[11px] text-slate-400 shrink-0">{annualRanges.length} ranges</span>}
              </div>
              {loading ? (
                <div className="p-5 space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : annualRanges.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                    <BarChart3 className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-700">No annual ranges yet</p>
                  <button
                    onClick={() => { setAddRangeDialog("annual"); setNewRangeDropdownValue(""); setNewRangeLabel(""); }}
                    className="mt-3 flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: ACCENT }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Range
                  </button>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-50">
                    {annualRanges.map((r, i) => (
                      <div key={`annual-${i}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
                        <span className="text-[11px] font-medium tabular-nums text-slate-300 w-5 shrink-0 text-center">{i + 1}</span>
                        <input
                          value={r}
                          onChange={(e) => updateRangeLabel("annual", i, e.target.value)}
                          onBlur={() => void save({ annualRevenueRanges: annualRanges })}
                          className="flex-1 min-w-0 h-8 px-2 rounded-md border border-transparent bg-transparent text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] focus:bg-white transition-colors"
                        />
                        <div className="flex items-center gap-0 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveRange("annual", i, "up")}
                            disabled={i === 0}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRange("annual", i, "down")}
                            disabled={i === annualRanges.length - 1}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRange("annual", i)}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-slate-100">
                    <button
                      onClick={() => { setAddRangeDialog("annual"); setNewRangeDropdownValue(""); setNewRangeLabel(""); }}
                      className="flex items-center gap-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                      style={{ color: ACCENT }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Range
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Second style ranges */}
            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <span className="text-[14px] font-semibold text-slate-900">Second Style Ranges</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Alternative revenue tiers for proposals</p>
                </div>
                {!loading && <span className="text-[11px] text-slate-400 shrink-0">{secondRanges.length} ranges</span>}
              </div>
              {loading ? (
                <div className="p-5 space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
                </div>
              ) : secondRanges.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                    <BarChart3 className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-700">No second style ranges yet</p>
                  <button
                    onClick={() => { setAddRangeDialog("second"); setNewRangeDropdownValue(""); setNewRangeLabel(""); }}
                    className="mt-3 flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: ACCENT }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Range
                  </button>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-50">
                    {secondRanges.map((r, i) => (
                      <div key={`second-${i}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50/60 transition-colors">
                        <span className="text-[11px] font-medium tabular-nums text-slate-300 w-5 shrink-0 text-center">{i + 1}</span>
                        <input
                          value={r}
                          onChange={(e) => updateRangeLabel("second", i, e.target.value)}
                          onBlur={() => void save({ secondStyleRanges: secondRanges })}
                          className="flex-1 min-w-0 h-8 px-2 rounded-md border border-transparent bg-transparent text-[13px] text-slate-800 focus:outline-none focus:border-[#C8A96E] focus:bg-white transition-colors"
                        />
                        <div className="flex items-center gap-0 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveRange("second", i, "up")}
                            disabled={i === 0}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRange("second", i, "down")}
                            disabled={i === secondRanges.length - 1}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRange("second", i)}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-slate-100">
                    <button
                      onClick={() => { setAddRangeDialog("second"); setNewRangeDropdownValue(""); setNewRangeLabel(""); }}
                      className="flex items-center gap-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
                      style={{ color: ACCENT }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Range
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Fees & Display ─────────────────────────────────────────────── */}
        {activeSection === "fees-display" && (
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <span className="text-[14px] font-semibold text-slate-900">Fees & Display</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Control how fees are presented in your proposals</p>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Fee display mode */}
              <div className="space-y-3">
                <div>
                  <p className="text-[13px] font-medium text-slate-800">Fee display mode</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Choose to show a full fee breakdown or just the proposal total</p>
                </div>
                <div className="flex flex-col gap-2">
                  {([
                    { value: "breakdown", label: "Show full breakdown", desc: "All line items with individual fees" },
                    { value: "total-only", label: "Show total only", desc: "Single total without line-item detail" },
                  ] as const).map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        showFees === opt.value ? "border-[#C8A96E]/40 bg-[#C8A96E]/5" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <input
                        type="radio"
                        name="show-fees"
                        value={opt.value}
                        checked={showFees === opt.value}
                        onChange={() => { setShowFees(opt.value); void save({ showFees: opt.value }); }}
                        className="mt-0.5"
                        style={{ accentColor: ACCENT }}
                      />
                      <div>
                        <p className="text-[13px] font-medium text-slate-800">{opt.label}</p>
                        <p className="text-[11px] text-slate-400">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section sub totals */}
              <div className="space-y-3">
                <div>
                  <p className="text-[13px] font-medium text-slate-800">Section sub totals</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Show a subtotal for each service section in the proposal</p>
                </div>
                <label className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  sectionSubTotals ? "border-[#C8A96E]/40 bg-[#C8A96E]/5" : "border-slate-200 hover:border-slate-300"
                )}>
                  <input
                    type="checkbox"
                    checked={sectionSubTotals}
                    onChange={(e) => { setSectionSubTotals(e.target.checked); void save({ sectionSubTotals: e.target.checked }); }}
                    className="mt-0.5"
                    style={{ accentColor: ACCENT }}
                  />
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">Enable section sub totals</p>
                    <p className="text-[11px] text-slate-400">Sub totals shown per section instead of a full breakdown</p>
                  </div>
                </label>
              </div>

              {/* Price rounding */}
              <div className="space-y-3">
                <div>
                  <p className="text-[13px] font-medium text-slate-800">Price rounding</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">By default, calculated prices are rounded to the nearest whole number</p>
                </div>
                <label className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  dontRoundPrices ? "border-[#C8A96E]/40 bg-[#C8A96E]/5" : "border-slate-200 hover:border-slate-300"
                )}>
                  <input
                    type="checkbox"
                    checked={dontRoundPrices}
                    onChange={(e) => { setDontRoundPrices(e.target.checked); void save({ dontRoundPrices: e.target.checked }); }}
                    className="mt-0.5"
                    style={{ accentColor: ACCENT }}
                  />
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">Don&apos;t round prices</p>
                    <p className="text-[11px] text-slate-400">Keep decimal precision in calculated prices</p>
                  </div>
                </label>
              </div>

              {/* Minimum monthly fee */}
              <div className="space-y-3">
                <div>
                  <p className="text-[13px] font-medium text-slate-800">Minimum monthly fee</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Override proposal calculations that fall below this amount</p>
                </div>
                <div className="flex items-start gap-3">
                  <label className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors flex-1 min-w-0",
                    applyMinFee ? "border-[#C8A96E]/40 bg-[#C8A96E]/5" : "border-slate-200 hover:border-slate-300"
                  )}>
                    <input
                      type="checkbox"
                      checked={applyMinFee}
                      onChange={(e) => { setApplyMinFee(e.target.checked); void save({ applyMinFee: e.target.checked }); }}
                      className="mt-0.5"
                      style={{ accentColor: ACCENT }}
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-800">Apply a minimum monthly fee</p>
                      <p className="text-[11px] text-slate-400">Proposals below this amount are bumped up to the minimum</p>
                    </div>
                  </label>
                  {applyMinFee && (
                    <div className="space-y-1 shrink-0">
                      <p className="text-[12px] font-medium text-slate-700">Minimum amount</p>
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-3 h-10 bg-slate-50 border border-r-0 border-slate-200 rounded-l-lg text-[13px] text-slate-500 shrink-0">{currency}</span>
                        <input
                          type="text"
                          value={minMonthlyFee}
                          onChange={(e) => { setMinMonthlyFee(e.target.value); if (minMonthlyFeeError) setMinMonthlyFeeError(null); }}
                          onBlur={() => {
                            const parsed = parseInt(minMonthlyFee.trim(), 10);
                            if (minMonthlyFee.trim() !== "" && (isNaN(parsed) || parsed < 0 || parsed > 999999)) {
                              setMinMonthlyFeeError("Enter a number between 0 and 999,999");
                              return;
                            }
                            setMinMonthlyFeeError(null);
                            const clamped = Math.max(0, Math.min(999999, parsed || 0));
                            setMinMonthlyFee(String(clamped));
                            void save({ minMonthlyFee: clamped });
                          }}
                          className={cn(
                            "w-24 h-10 px-3 rounded-r-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white",
                            minMonthlyFeeError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                          )}
                          placeholder="350"
                        />
                      </div>
                      {minMonthlyFeeError && <p className="text-[11px] text-red-600">{minMonthlyFeeError}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Tax & Currency ─────────────────────────────────────────────── */}
        {activeSection === "tax-rates" && (
          <div className="space-y-4">
            {/* Currency */}
            <div className="bg-white border border-slate-100 rounded-xl p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[14px] font-semibold text-slate-900">Default Currency</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Used across all proposals and pricing for this firm</p>
                </div>
                <div className="space-y-1.5 shrink-0">
                  <p className="text-[12px] font-medium text-slate-700 text-right">Currency</p>
                  <Select value={currency} onValueChange={(v) => { setCurrency(v); void save({ currency: v }); }}>
                    <SelectTrigger className="h-10 w-32 text-[13px] border-slate-200 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {["ZAR", "USD", "GBP", "EUR"].map((c) => (
                        <SelectItem key={c} value={c} className="text-[13px]">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Tax rates table */}
            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <span className="text-[14px] font-semibold text-slate-900">Tax Rates</span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Rates used in proposals and pricing calculations</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!loading && (
                    <span className="text-[11px] text-slate-400">{taxRates.length} rate{taxRates.length !== 1 ? "s" : ""}</span>
                  )}
                  <button
                    onClick={() => { setAddTaxOpen(true); setNewTaxName(""); setNewTaxRate("0"); setNewTaxNameError(""); setNewTaxRateError(""); }}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: ACCENT }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Tax Rate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[2rem_1fr_5rem_7.5rem_5rem] px-4 py-2.5 border-b border-slate-50 bg-slate-50/60 gap-3">
                {["#", "Name", "Rate", "Status", ""].map((h, i) => (
                  <span
                    key={i}
                    className={cn(
                      "text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 whitespace-nowrap",
                      i === 0 && "text-center",
                      i === 4 && "text-right"
                    )}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {loading ? (
                <div className="divide-y divide-slate-50">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="grid grid-cols-[2rem_1fr_5rem_7.5rem_5rem] px-4 py-4 gap-3 items-center">
                      <Skeleton className="h-3 w-4 mx-auto" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-10" />
                      <Skeleton className="h-5 w-20 rounded" />
                      <Skeleton className="h-6 w-14 ml-auto" />
                    </div>
                  ))}
                </div>
              ) : taxRates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                    <Percent className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-700">No tax rates yet</p>
                  <button
                    onClick={() => { setAddTaxOpen(true); setNewTaxName(""); setNewTaxRate("0"); }}
                    className="mt-3 flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: ACCENT }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Tax Rate
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {taxRates.map((rate, idx) => (
                    <div
                      key={rate.id}
                      className="grid grid-cols-[2rem_1fr_5rem_7.5rem_5rem] px-4 py-3.5 gap-3 items-center hover:bg-slate-50/60 transition-colors"
                    >
                      <span className="text-[11px] font-medium tabular-nums text-slate-300 text-center">{idx + 1}</span>
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{rate.name}</p>
                      <span className="text-[13px] text-slate-600 tabular-nums">{rate.rate}%</span>
                      {rate.isDefault ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700 whitespace-nowrap w-fit">
                          <CheckCircle2 className="h-3 w-3" /> Default
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetDefault(rate.id)}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 border border-slate-200 text-slate-500 hover:border-[#C8A96E]/40 hover:text-slate-700 transition-colors whitespace-nowrap w-fit"
                        >
                          Set default
                        </button>
                      )}
                      <div className="flex items-center gap-0.5 justify-end">
                        <button
                          onClick={() => handleOpenEditTax(rate)}
                          className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTaxId(rate.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Upsell & Annualised ────────────────────────────────────────── */}
        {activeSection === "upsell-annualised" && (
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <span className="text-[14px] font-semibold text-slate-900">Upsell & Annualised</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Configure how upsell and annualised costs appear in proposals</p>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Upsell section label */}
              <div className="space-y-3">
                <div>
                  <p className="text-[13px] font-medium text-slate-800">Upsell section label</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Name shown for the additional services section in the proposal tool</p>
                </div>
                <div className="flex flex-col gap-2">
                  {(["consider", "roadmap"] as const).map((v) => (
                    <label
                      key={v}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        upsellSection === v ? "border-[#C8A96E]/40 bg-[#C8A96E]/5" : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <input
                        type="radio"
                        name="upsell-section"
                        value={v}
                        checked={upsellSection === v}
                        onChange={() => { setUpsellSection(v); void save({ upsellSection: v }); }}
                        style={{ accentColor: ACCENT }}
                      />
                      <span className="text-[13px] font-medium text-slate-800 capitalize">{v}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Display fees in upsell */}
              <div className="space-y-3">
                <div>
                  <p className="text-[13px] font-medium text-slate-800">Display fees in upsell section</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Control whether pricing shows in the additional services area</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[12px] font-medium text-slate-700">Visibility</p>
                  <Select
                    value={displayFeesUpsell}
                    onValueChange={(v) => { setDisplayFeesUpsell(v as "always" | "never" | "optional"); void save({ displayFeesUpsell: v as "always" | "never" | "optional" }); }}
                  >
                    <SelectTrigger className="h-10 w-full text-[13px] border-slate-200 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="always" className="text-[13px]">Always show fees</SelectItem>
                      <SelectItem value="never" className="text-[13px]">Never show fees</SelectItem>
                      <SelectItem value="optional" className="text-[13px]">Let user choose per proposal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Annualised costs */}
              <div className="space-y-3">
                <div>
                  <p className="text-[13px] font-medium text-slate-800">Annualised costs</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Allow monthly fees to be annualised with a discount or price increase</p>
                </div>
                <label className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  enableAnnualised ? "border-[#C8A96E]/40 bg-[#C8A96E]/5" : "border-slate-200 hover:border-slate-300"
                )}>
                  <input
                    type="checkbox"
                    checked={enableAnnualised}
                    onChange={(e) => { setEnableAnnualised(e.target.checked); void save({ enableAnnualised: e.target.checked }); }}
                    className="mt-0.5"
                    style={{ accentColor: ACCENT }}
                  />
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">Enable annualised costs</p>
                    <p className="text-[11px] text-slate-400">Show an annualised total in proposals</p>
                  </div>
                </label>
              </div>

              {/* Discount / increase (only when annualised is on) */}
              {enableAnnualised && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">Annualised adjustment</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Apply a discount or price increase when annualising fees</p>
                  </div>
                  {/* Type + Rate side-by-side */}
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div className="space-y-1.5">
                      <p className="text-[12px] font-medium text-slate-700">Type</p>
                      <Select
                        value={discountOrIncrease}
                        onValueChange={(v) => { setDiscountOrIncrease(v as "discount" | "increase"); void save({ discountOrIncrease: v as "discount" | "increase" }); }}
                      >
                        <SelectTrigger className="h-10 w-full text-[13px] border-slate-200 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="discount" className="text-[13px]">Discount</SelectItem>
                          <SelectItem value="increase" className="text-[13px]">Price Increase</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[12px] font-medium text-slate-700">
                        {discountOrIncrease === "discount" ? "Discount" : "Increase"} rate
                      </p>
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={annualisedDiscount}
                          onChange={(e) => { setAnnualisedDiscount(e.target.value); if (annualisedDiscountError) setAnnualisedDiscountError(null); }}
                          onBlur={() => {
                            const s = annualisedDiscount.trim();
                            if (s && isNaN(parseFloat(s))) {
                              setAnnualisedDiscountError("Enter a valid number");
                              setAnnualisedDiscount("0");
                              return;
                            }
                            setAnnualisedDiscountError(null);
                            void save({ annualisedDiscount: annualisedDiscount.trim() });
                          }}
                          className={cn(
                            "flex-1 min-w-0 h-10 px-3 rounded-l-lg border text-[13px] text-slate-800 focus:outline-none transition-colors bg-white",
                            annualisedDiscountError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                          )}
                          placeholder="0"
                        />
                        <span className="inline-flex items-center px-3 h-10 bg-slate-50 border border-l-0 border-slate-200 rounded-r-lg text-[13px] text-slate-500 shrink-0">%</span>
                      </div>
                      {annualisedDiscountError && <p className="text-[11px] text-red-600">{annualisedDiscountError}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Add Range Sheet ─────────────────────────────────────────────────── */}
      <Sheet open={addRangeDialog !== null} onOpenChange={(open) => { if (!open) { setAddRangeDialog(null); setNewRangeDropdownValue(""); setNewRangeLabel(""); } }}>
        <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[460px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
          <SheetTitle className="sr-only">{addRangeDialog === "annual" ? "Add Annual Revenue Range" : "Add Second Style Range"}</SheetTitle>
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-14 w-14 min-h-[3.5rem] min-w-[3.5rem] rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                    <BarChart3 className="h-7 w-7" style={{ color: ACCENT }} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 leading-tight">Add Range</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {addRangeDialog === "annual" ? "Add an annual revenue range" : "Add a second style range"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setAddRangeDialog(null); setNewRangeDropdownValue(""); setNewRangeLabel(""); }}
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-700">Range <span className="text-red-500">*</span></label>
                <Select value={newRangeDropdownValue} onValueChange={(v) => { setNewRangeDropdownValue(v); if (v !== RANGE_OTHER_VALUE) setNewRangeLabel(""); }}>
                  <SelectTrigger className="w-full h-10 text-[13px] border-slate-200 rounded-lg">
                    <SelectValue placeholder="Select a range or choose Other" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" sideOffset={4}>
                    {addRangePredefinedOptions.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-[13px]">{opt}</SelectItem>
                    ))}
                    <SelectItem value={RANGE_OTHER_VALUE} className="text-[13px] font-medium">Other (custom)</SelectItem>
                  </SelectContent>
                </Select>
                {newRangeDropdownValue === RANGE_OTHER_VALUE && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[13px] font-medium text-slate-700">Custom label <span className="text-red-500">*</span></label>
                    <input
                      value={newRangeLabel}
                      onChange={(e) => setNewRangeLabel(e.target.value)}
                      placeholder="e.g. R200M – R500M"
                      onKeyDown={(e) => e.key === "Enter" && handleAddRange()}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white"
                    />
                  </div>
                )}
                <p className="text-[11px] text-slate-400">Used in the proposal tool when adding revenue variation line items</p>
              </div>
            </div>
            <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
              <button
                onClick={() => { setAddRangeDialog(null); setNewRangeDropdownValue(""); setNewRangeLabel(""); }}
                className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRange}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: ACCENT }}
              >
                Add Range
              </button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Add Tax Rate Sheet ──────────────────────────────────────────────── */}
      <Sheet open={addTaxOpen} onOpenChange={(open) => { if (!open) { setAddTaxOpen(false); setNewTaxName(""); setNewTaxRate("0"); setNewTaxNameError(""); setNewTaxRateError(""); } }}>
        <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[460px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
          <SheetTitle className="sr-only">Add Tax Rate</SheetTitle>
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-14 w-14 min-h-[3.5rem] min-w-[3.5rem] rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                    <Percent className="h-7 w-7" style={{ color: ACCENT }} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 leading-tight">Add Tax Rate</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Create a new tax rate for proposals</p>
                  </div>
                </div>
                <button
                  onClick={() => setAddTaxOpen(false)}
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
                <input
                  value={newTaxName}
                  onChange={(e) => { setNewTaxName(e.target.value); if (newTaxNameError) setNewTaxNameError(""); }}
                  placeholder="e.g. VAT (15%)"
                  disabled={savingTax}
                  className={cn(
                    "w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white",
                    newTaxNameError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                  )}
                />
                {newTaxNameError
                  ? <p className="text-[11px] text-red-600">{newTaxNameError}</p>
                  : <p className="text-[11px] text-slate-400">A descriptive name for this tax rate</p>
                }
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-700">Rate <span className="text-red-500">*</span></label>
                <div className="flex items-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={newTaxRate}
                    onChange={(e) => { setNewTaxRate(e.target.value); if (newTaxRateError) setNewTaxRateError(""); }}
                    disabled={savingTax}
                    className={cn(
                      "w-28 h-10 px-3 rounded-l-lg border text-[13px] text-slate-800 focus:outline-none transition-colors bg-white",
                      newTaxRateError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                    )}
                  />
                  <span className="inline-flex items-center px-3 h-10 bg-slate-50 border border-l-0 border-slate-200 rounded-r-lg text-[13px] text-slate-500">%</span>
                </div>
                {newTaxRateError
                  ? <p className="text-[11px] text-red-600">{newTaxRateError}</p>
                  : <p className="text-[11px] text-slate-400">Between 0 and 100</p>
                }
              </div>
            </div>
            <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
              <button
                onClick={() => setAddTaxOpen(false)}
                disabled={savingTax}
                className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTaxRate}
                disabled={savingTax}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5"
                style={{ background: ACCENT }}
              >
                {savingTax ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Adding…</> : "Add Tax Rate"}
              </button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Edit Tax Rate Sheet ─────────────────────────────────────────────── */}
      <Sheet open={editTaxSheetId !== null} onOpenChange={(open) => { if (!open) setEditTaxSheetId(null); }}>
        <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[460px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
          <SheetTitle className="sr-only">Edit Tax Rate</SheetTitle>
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-14 w-14 min-h-[3.5rem] min-w-[3.5rem] rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                    <Pencil className="h-7 w-7" style={{ color: ACCENT }} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 leading-tight">Edit Tax Rate</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Update the name or percentage rate</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditTaxSheetId(null)}
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
                <input
                  value={editingTaxName}
                  onChange={(e) => { setEditingTaxName(e.target.value); if (editTaxNameError) setEditTaxNameError(""); }}
                  disabled={savingEditTax}
                  className={cn(
                    "w-full h-10 px-3 rounded-lg border text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none transition-colors bg-white",
                    editTaxNameError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                  )}
                />
                {editTaxNameError && <p className="text-[11px] text-red-600">{editTaxNameError}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-700">Rate <span className="text-red-500">*</span></label>
                <div className="flex items-center">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={editingTaxRate}
                    onChange={(e) => { setEditingTaxRate(e.target.value); if (editTaxRateError) setEditTaxRateError(""); }}
                    disabled={savingEditTax}
                    className={cn(
                      "w-28 h-10 px-3 rounded-l-lg border text-[13px] text-slate-800 focus:outline-none transition-colors bg-white",
                      editTaxRateError ? "border-red-500" : "border-slate-200 focus:border-[#C8A96E]"
                    )}
                  />
                  <span className="inline-flex items-center px-3 h-10 bg-slate-50 border border-l-0 border-slate-200 rounded-r-lg text-[13px] text-slate-500">%</span>
                </div>
                {editTaxRateError && <p className="text-[11px] text-red-600">{editTaxRateError}</p>}
              </div>
            </div>
            <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
              <button
                onClick={() => setEditTaxSheetId(null)}
                disabled={savingEditTax}
                className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTaxEdit}
                disabled={savingEditTax}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5"
                style={{ background: ACCENT }}
              >
                {savingEditTax ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Changes"}
              </button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Delete Tax Rate Alert ───────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTaxId} onOpenChange={(open) => { if (!open) setDeleteTaxId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove tax rate?</AlertDialogTitle>
            <AlertDialogDescription>
              This tax rate will be permanently removed. You must keep at least one tax rate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTax} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
