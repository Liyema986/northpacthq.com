"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  HelpCircle,
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
  Link2,
  Building2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRICING_TOOL_SECTIONS = [
  { id: "revenue-ranges", label: "Revenue Ranges", icon: BarChart3 },
  { id: "fees-display", label: "Fees & Display", icon: Receipt },
  { id: "tax-rates", label: "Tax & Currency", icon: Percent },
  { id: "upsell-annualised", label: "Upsell & Annualised", icon: TrendingUp },
  { id: "alignment-fee", label: "Alignment Fee", icon: Link2 },
  { id: "multiple-entities", label: "Multiple Entities", icon: Building2 },
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

  // Revenue Ranges — local copies for inline editing
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
  const [addTaxOpen, setAddTaxOpen] = useState(false);
  const [newTaxName, setNewTaxName] = useState("");
  const [newTaxRate, setNewTaxRate] = useState("0");
  const [deleteTaxId, setDeleteTaxId] = useState<string | null>(null);
  const [editingTaxId, setEditingTaxId] = useState<string | null>(null);
  const [editingTaxName, setEditingTaxName] = useState("");
  const [editingTaxRate, setEditingTaxRate] = useState("");

  // Upsell & Annualised
  const [upsellSection, setUpsellSection] = useState<"consider" | "roadmap">("consider");
  const [displayFeesUpsell, setDisplayFeesUpsell] = useState<"always" | "never" | "optional">("always");
  const [enableAnnualised, setEnableAnnualised] = useState(true);
  const [discountOrIncrease, setDiscountOrIncrease] = useState<"discount" | "increase">("discount");
  const [annualisedDiscount, setAnnualisedDiscount] = useState("0");
  const [annualisedDiscountError, setAnnualisedDiscountError] = useState<string | null>(null);

  // Alignment Fee
  const [alignmentLineItems, setAlignmentLineItems] = useState("All Lines");
  const [alignmentProposals, setAlignmentProposals] = useState<string[]>(["New Client"]);
  const [alignmentTool, setAlignmentTool] = useState("");
  const [alignmentPdfMonthly, setAlignmentPdfMonthly] = useState("");
  const [alignmentPdfOneoff, setAlignmentPdfOneoff] = useState("");

  // Multiple Entities
  const [enableMultipleEntities, setEnableMultipleEntities] = useState(true);
  const [businessTypes, setBusinessTypes] = useState("Company\nSole Trader");
  const [businessTypesError, setBusinessTypesError] = useState<string | null>(null);

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
    setAlignmentLineItems(settings.alignmentLineItems);
    setAlignmentProposals(settings.alignmentProposals);
    setAlignmentTool(settings.alignmentTool);
    setAlignmentPdfMonthly(settings.alignmentPdfMonthly);
    setAlignmentPdfOneoff(settings.alignmentPdfOneoff);
    setEnableMultipleEntities(settings.enableMultipleEntities);
    setBusinessTypes(settings.businessTypes);
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

  // Add Range sheet
  const [addRangeDialog, setAddRangeDialog] = useState<"annual" | "second" | null>(null);
  const [newRangeDropdownValue, setNewRangeDropdownValue] = useState("");
  const [newRangeLabel, setNewRangeLabel] = useState("");

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async function moveRange(which: "annual" | "second", index: number, dir: "up" | "down") {
    const list = which === "annual" ? annualRanges : secondRanges;
    const next = dir === "up" ? index - 1 : index + 1;
    if (next < 0 || next >= list.length) return;
    const copy = [...list];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    if (which === "annual") { setAnnualRanges(copy); await save({ annualRevenueRanges: copy }); }
    else { setSecondRanges(copy); await save({ secondStyleRanges: copy }); }
  }

  async function removeRange(which: "annual" | "second", index: number) {
    if (which === "annual") {
      const next = annualRanges.filter((_, i) => i !== index);
      setAnnualRanges(next);
      await save({ annualRevenueRanges: next });
    } else {
      const next = secondRanges.filter((_, i) => i !== index);
      setSecondRanges(next);
      await save({ secondStyleRanges: next });
    }
  }

  function updateRangeLabel(which: "annual" | "second", index: number, value: string) {
    if (which === "annual") {
      setAnnualRanges((prev) => { const c = [...prev]; c[index] = value; return c; });
    } else {
      setSecondRanges((prev) => { const c = [...prev]; c[index] = value; return c; });
    }
  }

  async function handleAddRange() {
    const label = newRangeDropdownValue === RANGE_OTHER_VALUE
      ? newRangeLabel.trim()
      : newRangeDropdownValue;
    if (!label) { toast.error("Label is required"); return; }
    if (addRangeDialog === "annual") {
      const next = [...annualRanges, label];
      setAnnualRanges(next);
      await save({ annualRevenueRanges: next });
      toast.success("Annual revenue range added");
    } else {
      const next = [...secondRanges, label];
      setSecondRanges(next);
      await save({ secondStyleRanges: next });
      toast.success("Second style range added");
    }
    setAddRangeDialog(null);
    setNewRangeDropdownValue("");
    setNewRangeLabel("");
  }

  async function handleAddTax() {
    if (!userId) return;
    const name = newTaxName.trim();
    if (!name) { toast.error("Name is required"); return; }
    const rate = parseFloat(newTaxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) { toast.error("Rate must be between 0 and 100"); return; }
    try {
      await addTaxRateMutation({ userId, name, ratePercent: rate });
      toast.success("Tax rate added");
      setAddTaxOpen(false);
      setNewTaxName("");
      setNewTaxRate("0");
    } catch { toast.error("Failed to add tax rate"); }
  }

  async function handleDeleteTax(id: string) {
    if (!userId) return;
    try {
      await removeTaxRateMutation({ userId, taxRateId: id });
      toast.success("Tax rate deleted");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to delete"); }
    setDeleteTaxId(null);
  }

  async function handleSetDefault(id: string) {
    if (!userId) return;
    await setDefaultTaxRateMutation({ userId, taxRateId: id });
    toast.success("Default updated");
  }

  async function handleSaveTaxEdit(id: string) {
    if (!userId) return;
    const name = editingTaxName.trim();
    if (!name) { toast.error("Name is required"); return; }
    const rate = parseFloat(editingTaxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) { toast.error("Rate must be between 0 and 100"); return; }
    await updateTaxRateMutation({ userId, taxRateId: id, name, ratePercent: rate });
    toast.success("Tax rate updated");
    setEditingTaxId(null);
  }

  const addRangePredefinedOptions =
    addRangeDialog === "annual" ? PREDEFINED_ANNUAL_RANGES : PREDEFINED_SECOND_RANGES;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Header />
      <div className="px-6 py-6 space-y-5 max-w-[1600px]">

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Revenue Ranges */}
          <div className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(59,130,246,0.1)" }}>
                <BarChart3 className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">
              {annualRanges.length + secondRanges.length}
            </div>
            <div className="text-[11px] font-medium text-slate-500">Revenue Ranges</div>
            <div className="text-[10px] text-slate-400">{annualRanges.length} annual · {secondRanges.length} second</div>
          </div>

          {/* Tax Rates */}
          <div className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.1)" }}>
                <Percent className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">
              {taxRates.length}
            </div>
            <div className="text-[11px] font-medium text-slate-500">Tax Rates</div>
            <div className="text-[10px] text-slate-400">{taxRates.find((t) => t.isDefault)?.name ?? "None"} is default</div>
          </div>

          {/* Min Monthly Fee */}
          <div className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(254,93,51,0.1)" }}>
                <Receipt className="w-4 h-4" style={{ color: "#C8A96E" }} />
              </div>
            </div>
            <div className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">
              {applyMinFee ? `R${minMonthlyFee}` : "None"}
            </div>
            <div className="text-[11px] font-medium text-slate-500">Min Monthly Fee</div>
            <div className="text-[10px] text-slate-400">{applyMinFee ? "Applied to proposals" : "No minimum set"}</div>
          </div>

          {/* Currency */}
          <div className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.1)" }}>
                <Globe className="w-4 h-4 text-violet-600" />
              </div>
            </div>
            <div className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">
              {currency}
            </div>
            <div className="text-[11px] font-medium text-slate-500">Currency</div>
            <div className="text-[10px] text-slate-400">Default currency</div>
          </div>

          {/* Upsell Section */}
          <div className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(245,158,11,0.1)" }}>
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <div className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1 capitalize">
              {upsellSection}
            </div>
            <div className="text-[11px] font-medium text-slate-500">Upsell Section</div>
            <div className="text-[10px] text-slate-400">Upsell section label</div>
          </div>

          {/* Multiple Entities */}
          <div className="bg-white border border-slate-100 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(100,116,139,0.1)" }}>
                <Building2 className="w-4 h-4 text-slate-500" />
              </div>
            </div>
            <div className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">
              {enableMultipleEntities ? "On" : "Off"}
            </div>
            <div className="text-[11px] font-medium text-slate-500">Multiple Entities</div>
            <div className="text-[10px] text-slate-400">{enableMultipleEntities ? "Enabled for proposals" : "Disabled"}</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Select value={activeSection} onValueChange={(v) => setActiveSection(v as SectionId)}>
              <SelectTrigger className="h-8 w-[180px] min-w-[180px] text-[11px] font-normal text-slate-800 border-slate-200 bg-white hover:bg-slate-50 rounded transition-colors">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="bg-white border-slate-200 shadow-lg rounded p-1 min-w-[180px]">
                {PRICING_TOOL_SECTIONS.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-[11px] font-normal text-slate-800 rounded cursor-pointer hover:bg-slate-50">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeSection === "tax-rates" && (
              <>
                <Select value={currency} onValueChange={(v) => { setCurrency(v); void save({ currency: v }); }}>
                  <SelectTrigger className="h-8 w-[180px] min-w-[180px] text-[11px] font-normal text-slate-800 border-slate-200 bg-white hover:bg-slate-50 rounded transition-colors">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="bg-white border-slate-200 shadow-lg rounded p-1 min-w-[180px]">
                    <SelectItem value="ZAR" className="text-[11px] font-normal text-slate-800 rounded cursor-pointer hover:bg-slate-50">ZAR</SelectItem>
                    <SelectItem value="USD" className="text-[11px] font-normal text-slate-800 rounded cursor-pointer hover:bg-slate-50">USD</SelectItem>
                    <SelectItem value="GBP" className="text-[11px] font-normal text-slate-800 rounded cursor-pointer hover:bg-slate-50">GBP</SelectItem>
                    <SelectItem value="EUR" className="text-[11px] font-normal text-slate-800 rounded cursor-pointer hover:bg-slate-50">EUR</SelectItem>
                  </SelectContent>
                </Select>
                <button type="button" className="h-8 w-8 flex items-center justify-center flex-shrink-0 rounded text-slate-500">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            {activeSection === "tax-rates" && (
              <Button
                size="sm"
                className="h-8 px-3 text-[11px] font-medium text-white rounded transition-opacity hover:opacity-90" style={{ background: "#C8A96E" }}
                onClick={() => { setAddTaxOpen(true); setNewTaxName(""); setNewTaxRate("0"); }}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add New Tax Rate
              </Button>
            )}
            <button
              className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "#C8A96E" }}
              onClick={() => toast.info("New proposal")}
            >
              <Plus className="h-3.5 w-3.5" />
              New Proposal
            </button>
          </div>
        </div>

        {/* Section content */}
        <div className="w-full">

          {/* ── Revenue Ranges ─────────────────────────────────────────────── */}
          {activeSection === "revenue-ranges" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Annual ranges */}
              <section className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium text-slate-800">Annual Revenue Ranges</Label>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-xs text-slate-500">
                  The annual revenue ranges are used in the proposal tool when you add an annual revenue variation line item.
                </p>
                <ul className="space-y-2 border border-slate-200 rounded-lg bg-white divide-y divide-slate-200">
                  {annualRanges.map((r, i) => (
                    <li key={`annual-${i}`} className="flex items-center justify-between gap-2 py-2 px-3">
                      <Input
                        value={r}
                        onChange={(e) => updateRangeLabel("annual", i, e.target.value)}
                        onBlur={() => void save({ annualRevenueRanges: annualRanges })}
                        className="flex-1 min-w-0 h-8 text-sm border-slate-200"
                      />
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => removeRange("annual", i)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveRange("annual", i, "up")} disabled={i === 0}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveRange("annual", i, "down")} disabled={i === annualRanges.length - 1}>
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end">
                  <Button size="sm" className="text-white transition-opacity hover:opacity-90" style={{ background: "#C8A96E" }} onClick={() => { setAddRangeDialog("annual"); setNewRangeDropdownValue(""); setNewRangeLabel(""); }}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Range
                  </Button>
                </div>
              </section>

              {/* Second ranges */}
              <section className="space-y-3">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium text-slate-800">Second Revenue Style Price Ranges</Label>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-xs text-slate-500">
                  If you require a second set of revenue style price ranges then you can add them below.
                </p>
                <ul className="space-y-2 border border-slate-200 rounded-lg bg-white divide-y divide-slate-200">
                  {secondRanges.map((r, i) => (
                    <li key={`second-${i}`} className="flex items-center justify-between gap-2 py-2 px-3">
                      <Input
                        value={r}
                        onChange={(e) => updateRangeLabel("second", i, e.target.value)}
                        onBlur={() => void save({ secondStyleRanges: secondRanges })}
                        className="flex-1 min-w-0 h-8 text-sm border-slate-200"
                      />
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => removeRange("second", i)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveRange("second", i, "up")} disabled={i === 0}>
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveRange("second", i, "down")} disabled={i === secondRanges.length - 1}>
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end">
                  <Button size="sm" className="text-white transition-opacity hover:opacity-90" style={{ background: "#C8A96E" }} onClick={() => { setAddRangeDialog("second"); setNewRangeDropdownValue(""); setNewRangeLabel(""); }}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Add Range
                  </Button>
                </div>
              </section>
            </div>
          )}

          {/* ── Fees & Display ─────────────────────────────────────────────── */}
          {activeSection === "fees-display" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium text-slate-800">Showing Fees in the Proposal</Label>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-xs text-slate-500">In the proposal you can choose to show a full breakdown of the fees for each line item or to only show the proposal total.</p>
                <Select value={showFees} onValueChange={(v) => { setShowFees(v as "breakdown" | "total-only"); void save({ showFees: v as "breakdown" | "total-only" }); }}>
                  <SelectTrigger className="w-full max-w-[280px] h-9 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="breakdown">Show full breakdown in proposal</SelectItem>
                    <SelectItem value="total-only">Show proposal total only</SelectItem>
                  </SelectContent>
                </Select>
              </section>

              <section className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium text-slate-800">Section sub totals</Label>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-xs text-slate-500">This allows you to show the total for a section, instead of a full breakdown for each line item.</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="section-subtotals"
                    checked={sectionSubTotals}
                    onCheckedChange={(c) => { setSectionSubTotals(!!c); void save({ sectionSubTotals: !!c }); }}
                    className="rounded-sm border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <Label htmlFor="section-subtotals" className="text-sm font-normal cursor-pointer">Enable sub totals per section</Label>
                </div>
              </section>

              <section className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium text-slate-800">Price Rounding</Label>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-xs text-slate-500">As standard, the calculated price for each line item will be rounded to the nearest whole number.</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dont-round"
                    checked={dontRoundPrices}
                    onCheckedChange={(c) => { setDontRoundPrices(!!c); void save({ dontRoundPrices: !!c }); }}
                    className="rounded-sm border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <Label htmlFor="dont-round" className="text-sm font-normal cursor-pointer">Don&apos;t round prices?</Label>
                </div>
              </section>

              <section className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium text-slate-800">Minimum Monthly Fee</Label>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-xs text-slate-500">The minimum monthly fee will override proposal calculations falling below the set fee.</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="min-fee"
                      checked={applyMinFee}
                      onCheckedChange={(c) => { setApplyMinFee(!!c); void save({ applyMinFee: !!c }); }}
                      className="rounded-sm border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                    />
                    <Label htmlFor="min-fee" className="text-sm font-normal cursor-pointer">Apply a minimum monthly proposal fee</Label>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Input
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
                        className={cn("w-24 h-9 border-slate-200", minMonthlyFeeError && "border-red-500")}
                      />
                      <span className="text-sm text-slate-600 px-2 py-1.5 bg-slate-100 rounded-md">{currency}</span>
                    </div>
                    {minMonthlyFeeError && <p className="text-xs text-red-600">{minMonthlyFeeError}</p>}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ── Tax & Currency ─────────────────────────────────────────────── */}
          {activeSection === "tax-rates" && (
            <section className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-1.5">
                <Label className="text-sm font-medium text-slate-800">Tax Rates</Label>
                <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <ul className="space-y-2">
                {taxRates.map((rate) => (
                  <li key={rate.id} className="flex items-center justify-between gap-2 py-2 px-3 border border-slate-200 rounded-lg bg-white">
                    {editingTaxId === rate.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input value={editingTaxName} onChange={(e) => setEditingTaxName(e.target.value)} className="h-8 flex-1 max-w-[200px]" placeholder="Name" />
                        <Input type="number" min={0} max={100} value={editingTaxRate} onChange={(e) => setEditingTaxRate(e.target.value)} className="h-8 w-20" placeholder="%" />
                        <Button size="sm" onClick={() => handleSaveTaxEdit(rate.id)}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingTaxId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm text-slate-800">{rate.name} — {rate.rate}%</span>
                        <div className="flex items-center gap-2">
                          {rate.isDefault ? (
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8">✔ Default Rate</Button>
                          ) : (
                            <Button size="sm" variant="outline" className="text-xs h-8 border-slate-200" onClick={() => handleSetDefault(rate.id)}>Make Default</Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => { setEditingTaxId(rate.id); setEditingTaxName(rate.name); setEditingTaxRate(String(rate.rate)); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => setDeleteTaxId(rate.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Upsell & Annualised ────────────────────────────────────────── */}
          {activeSection === "upsell-annualised" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium text-slate-800">Upsell Section</Label>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-xs text-slate-500">On the proposal tool, you can choose to call the upsell section either &apos;Consider&apos; or &apos;Roadmap&apos;.</p>
                <div className="flex gap-6">
                  {(["consider", "roadmap"] as const).map((v) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="upsell-section"
                        value={v}
                        checked={upsellSection === v}
                        onChange={() => { setUpsellSection(v); void save({ upsellSection: v }); }}
                        className="accent-emerald-600"
                      />
                      <span className="text-sm font-normal capitalize">{v}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium text-slate-800">Display fees in the upsell section</Label>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <Select value={displayFeesUpsell} onValueChange={(v) => { setDisplayFeesUpsell(v as "always" | "never" | "optional"); void save({ displayFeesUpsell: v as "always" | "never" | "optional" }); }}>
                  <SelectTrigger className="w-full max-w-md h-9 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">ALWAYS show fees in the Additional Services section</SelectItem>
                    <SelectItem value="never">Never show fees</SelectItem>
                    <SelectItem value="optional">Let user choose per proposal</SelectItem>
                  </SelectContent>
                </Select>
              </section>

              <section className="space-y-3 p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium text-slate-800">Annualised Costs</Label>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="annualised"
                    checked={enableAnnualised}
                    onCheckedChange={(c) => { setEnableAnnualised(!!c); void save({ enableAnnualised: !!c }); }}
                    className="rounded-sm border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <Label htmlFor="annualised" className="text-sm font-normal cursor-pointer">Enable Annualised Costs?</Label>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Discount or Price Increase</Label>
                  <Select value={discountOrIncrease} onValueChange={(v) => { setDiscountOrIncrease(v as "discount" | "increase"); void save({ discountOrIncrease: v as "discount" | "increase" }); }}>
                    <SelectTrigger className="w-full max-w-[200px] h-9 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discount">Discount</SelectItem>
                      <SelectItem value="increase">Price Increase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Annualised Costs Discount</Label>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-0">
                      <Input
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
                        className={cn("w-20 h-9 rounded-r-none border-slate-200", annualisedDiscountError && "border-red-500")}
                      />
                      <span className="inline-flex items-center px-3 h-9 bg-slate-100 border border-l-0 border-slate-200 rounded-r-md text-sm text-slate-600">%</span>
                    </div>
                    {annualisedDiscountError && <p className="text-xs text-red-600">{annualisedDiscountError}</p>}
                  </div>
                </div>
                <p className="text-xs text-slate-500">Any services not included above will not have tax applied when you annualise costs in the proposal.</p>
              </section>

              <section className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
                <Label className="text-sm font-medium text-slate-700">Apply to which line items</Label>
                <div className="flex flex-wrap gap-2 p-2 border border-slate-200 rounded-lg bg-white min-h-10">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm text-slate-700">
                    All Lines
                    <button type="button" className="p-0.5 hover:text-slate-900">×</button>
                  </span>
                </div>
              </section>
            </div>
          )}

          {/* ── Alignment Fee ──────────────────────────────────────────────── */}
          {activeSection === "alignment-fee" && (
            <section className="space-y-4">
              <div className="flex items-center gap-1.5">
                <Label className="text-sm font-medium text-slate-800">Alignment Fee</Label>
                <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <p className="text-xs text-slate-500">
                The alignment fee ensures you get paid the full amount, for the services where payments are calculated over 12 months, but where you&apos;re onboarding the client part way through their year.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Apply to which line items:</Label>
                  <Input
                    value={alignmentLineItems}
                    onChange={(e) => setAlignmentLineItems(e.target.value)}
                    placeholder="Select line items"
                    className="w-full h-9 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Apply to which proposals:</Label>
                  <div className="flex flex-wrap gap-2 p-2 border border-slate-200 rounded-lg bg-white min-h-10">
                    {alignmentProposals.map((p, i) => (
                      <span key={p} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm text-slate-700">
                        {p}
                        <button type="button" className="p-0.5 hover:text-slate-900" onClick={() => setAlignmentProposals((prev) => prev.filter((_, j) => j !== i))}>×</button>
                      </span>
                    ))}
                  </div>
                  <Select value="" onValueChange={(v) => { if (!v || alignmentProposals.includes(v)) return; setAlignmentProposals((prev) => [...prev, v]); }}>
                    <SelectTrigger className="w-[200px] h-9 border-slate-200">
                      <SelectValue placeholder="Add proposal from templates" />
                    </SelectTrigger>
                    <SelectContent>
                      {["New Client", "Existing Client", "Virtual: New Client"].filter((t) => !alignmentProposals.includes(t)).map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {[
                  { title: "Alignment Fee Explanation on Tool", value: alignmentTool, set: setAlignmentTool, key: "alignmentTool" as const },
                  { title: "Alignment Fee Explanation in PDF (Monthly)", value: alignmentPdfMonthly, set: setAlignmentPdfMonthly, key: "alignmentPdfMonthly" as const },
                  { title: "Alignment Fee Explanation in PDF (Oneoff)", value: alignmentPdfOneoff, set: setAlignmentPdfOneoff, key: "alignmentPdfOneoff" as const },
                ].map(({ title, value, set, key }) => (
                  <div key={title} className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-sm font-medium text-slate-700">{title}</Label>
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <p className="text-xs text-slate-500">Suggested: Payment for [alignment_fee_services] are calculated over 12 months…</p>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <Textarea
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        onBlur={() => void save({ [key]: value })}
                        className="min-h-[100px] border-0 rounded-none focus-visible:ring-0 text-sm resize-y w-full"
                        placeholder="Enter explanation..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Multiple Entities ──────────────────────────────────────────── */}
          {activeSection === "multiple-entities" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium text-slate-800">Multiple Entities</Label>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="multi-entities"
                    checked={enableMultipleEntities}
                    onCheckedChange={(c) => { setEnableMultipleEntities(!!c); void save({ enableMultipleEntities: !!c }); }}
                    className="rounded-sm border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                  />
                  <Label htmlFor="multi-entities" className="text-sm font-normal cursor-pointer">Enable Multiple Entities on the tool</Label>
                </div>
              </section>

              <section className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-1.5">
                  <Label className="text-sm font-medium text-slate-800">Business Types</Label>
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <p className="text-xs text-slate-500">These show on the define entities section. Add one type per line.</p>
              </section>

              <section className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
                <Label className="text-sm font-medium text-slate-800">List of business types</Label>
                <div className="space-y-1">
                  <div className={cn("relative flex rounded-lg overflow-hidden bg-white", businessTypesError ? "ring-2 ring-red-500" : "border border-slate-200")}>
                    <Textarea
                      value={businessTypes}
                      onChange={(e) => { setBusinessTypes(e.target.value); if (businessTypesError) setBusinessTypesError(null); }}
                      onBlur={() => {
                        const lines = businessTypes.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
                        if (lines.length === 0) {
                          setBusinessTypesError("Add at least one business type (one per line)");
                          return;
                        }
                        setBusinessTypesError(null);
                        void save({ businessTypes: businessTypes.trim() });
                      }}
                      className="min-h-[100px] border-0 rounded-lg focus-visible:ring-0 text-sm resize-y pr-12 bg-white"
                      placeholder={"Company\nSole Trader"}
                    />
                    <div className="absolute right-2 top-2 flex flex-col gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><ArrowUp className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><ArrowDown className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500"><Pencil className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                  {businessTypesError && <p className="text-xs text-red-600">{businessTypesError}</p>}
                </div>
              </section>

              <section className="space-y-2 p-4 rounded-lg border border-slate-200 bg-white">
                <Label className="text-sm font-medium text-slate-800">Entity display</Label>
                <p className="text-xs text-slate-500">Options for how entities are shown in proposals can be added here.</p>
              </section>
            </div>
          )}

        </div>
      </div>

      {/* ── Add Range Sheet ─────────────────────────────────────────────────── */}
      <Sheet open={addRangeDialog !== null} onOpenChange={(open) => { if (!open) { setAddRangeDialog(null); setNewRangeDropdownValue(""); setNewRangeLabel(""); } }}>
        <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[520px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
          <SheetTitle className="sr-only">{addRangeDialog === "annual" ? "Add Annual Revenue Range" : "Add Second Style Range"}</SheetTitle>
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-14 w-14 min-h-[3.5rem] min-w-[3.5rem] rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: "rgba(254,93,51,0.08)" }}>
                    <BarChart3 className="h-7 w-7" style={{ color: "#C8A96E" }} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 leading-tight">Add Range</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {addRangeDialog === "annual" ? "Add an annual revenue range used in proposals" : "Add a second style range for alternative revenue tiers"}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setAddRangeDialog(null); setNewRangeDropdownValue(""); setNewRangeLabel(""); }} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-[13px]">Range</Label>
                <Select value={newRangeDropdownValue} onValueChange={(v) => { setNewRangeDropdownValue(v); if (v !== RANGE_OTHER_VALUE) setNewRangeLabel(""); }}>
                  <SelectTrigger className="w-full h-10 text-[13px] border-slate-200 rounded">
                    <SelectValue placeholder="Select a range or choose Other" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start" sideOffset={4} className="bg-white border-slate-200">
                    {addRangePredefinedOptions.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-[13px]">{opt}</SelectItem>
                    ))}
                    <SelectItem value={RANGE_OTHER_VALUE} className="text-[13px] font-medium">Other</SelectItem>
                  </SelectContent>
                </Select>
                {newRangeDropdownValue === RANGE_OTHER_VALUE && (
                  <div className="space-y-1.5 pt-2">
                    <Label className="text-[13px]">Custom label</Label>
                    <Input
                      value={newRangeLabel}
                      onChange={(e) => setNewRangeLabel(e.target.value)}
                      placeholder="e.g. R200M - R500M"
                      onKeyDown={(e) => e.key === "Enter" && handleAddRange()}
                      className="w-full h-10 text-[13px] border-slate-200 rounded"
                    />
                  </div>
                )}
                <p className="text-[11px] text-slate-500">Used in the proposal tool when adding revenue variation line items</p>
              </div>
            </div>
            <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
              <button onClick={() => { setAddRangeDialog(null); setNewRangeDropdownValue(""); setNewRangeLabel(""); }} className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 transition-colors">Cancel</button>
              <button onClick={handleAddRange} className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: "#C8A96E" }}>Add Range</button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Add Tax Rate Sheet ──────────────────────────────────────────────── */}
      <Sheet open={addTaxOpen} onOpenChange={setAddTaxOpen}>
        <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[520px] p-0 border-l border-slate-200 shadow-2xl overflow-hidden flex flex-col bg-white">
          <SheetTitle className="sr-only">Add New Tax Rate</SheetTitle>
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-14 w-14 min-h-[3.5rem] min-w-[3.5rem] rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: "rgba(37,99,235,0.08)" }}>
                    <Percent className="h-7 w-7 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 leading-tight">Add New Tax Rate</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Configure a new tax rate for your proposals</p>
                  </div>
                </div>
                <button onClick={() => setAddTaxOpen(false)} className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[13px]">Tax Name <span className="text-red-500">*</span></Label>
                <Input value={newTaxName} onChange={(e) => setNewTaxName(e.target.value)} placeholder="e.g. VAT" className="w-full h-10 text-[13px] border-slate-200 rounded" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px]">Rate (%) <span className="text-red-500">*</span></Label>
                <div className="flex items-center gap-0">
                  <Input type="number" min={0} max={100} value={newTaxRate} onChange={(e) => setNewTaxRate(e.target.value)} className="w-24 h-10 text-[13px] border-slate-200 rounded-r-none" />
                  <span className="inline-flex items-center px-3 h-10 bg-slate-100 border border-l-0 border-slate-200 rounded-r-md text-sm text-slate-600">%</span>
                </div>
              </div>
            </div>
            <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
              <button onClick={() => setAddTaxOpen(false)} className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 transition-colors">Cancel</button>
              <button onClick={handleAddTax} className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: "#C8A96E" }}>Add Tax Rate</button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Delete Tax Rate Confirm ─────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTaxId} onOpenChange={(o) => !o && setDeleteTaxId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tax Rate</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this tax rate? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => deleteTaxId && handleDeleteTax(deleteTaxId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
