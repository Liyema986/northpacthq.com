"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Loader2, Mail, Trash2, UserCog, UserPlus, Save,
  Zap, Layers, Building2, Check, Search, MoreHorizontal,
  Upload, Pencil, ArrowRight, X, User,
} from "lucide-react";
import { toast } from "sonner";
import { getInitials, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Subscription plans ───────────────────────────────────────────────────────

type SubscriptionPlan = "starter" | "professional" | "enterprise";

const PRICING_PLANS: {
  id: SubscriptionPlan;
  name: string;
  icon: typeof Zap;
  priceMonthly: number;
  priceAnnualTotal: number;
  description: string;
  features: string[];
  highlight?: boolean;
  badge?: string;
}[] = [
  {
    id: "starter",
    name: "Starter",
    icon: Zap,
    priceMonthly: 0,
    priceAnnualTotal: 0,
    description:
      "Everything you need to send your first proposal and see what NorthPact can do.",
    features: [
      "Up to 3 proposals per month",
      "5 professional templates",
      "Basic e-signatures",
      "Client management (up to 5)",
      "Email support",
    ],
  },
  {
    id: "professional",
    name: "Pro",
    icon: Layers,
    priceMonthly: 9,
    priceAnnualTotal: 86.4,
    description:
      "For growing firms that need unlimited proposals, deeper analytics, and integrations.",
    features: [
      "Unlimited proposals",
      "50+ professional templates",
      "Legally binding e-signatures",
      "Unlimited clients & contacts",
      "Integrations (Xero, etc.)",
      "Priority support",
      "Advanced analytics",
      "Export to PDF",
    ],
    highlight: true,
    badge: "Most Popular",
  },
  {
    id: "enterprise",
    name: "Business",
    icon: Building2,
    priceMonthly: 19,
    priceAnnualTotal: 192,
    description:
      "Built for teams. Custom branding, collaboration, API access, and enterprise security.",
    features: [
      "Everything in Pro",
      "Team collaboration",
      "Custom branding",
      "Dedicated account manager",
      "Custom fields",
      "Advanced security",
      "API access",
      "SLA guarantee",
    ],
  },
];

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  owner:       { label: "Owner",     dot: "bg-violet-400", text: "text-violet-700" },
  admin:       { label: "Admin",     dot: "bg-blue-400",   text: "text-blue-700"   },
  senior:      { label: "Senior",    dot: "bg-cyan-400",   text: "text-cyan-700"   },
  staff:       { label: "Staff",     dot: "bg-emerald-400",text: "text-emerald-700"},
  "view-only": { label: "View Only", dot: "bg-slate-300",  text: "text-slate-500"  },
};

type MembershipStatus = "inactive" | "pending_invite" | "invite_expired" | "active";

const MEMBERSHIP_STATUS_CONFIG: Record<
  MembershipStatus,
  { label: string; dot: string; text: string }
> = {
  inactive: { label: "Inactive", dot: "bg-slate-300", text: "text-slate-500" },
  pending_invite: { label: "Pending", dot: "bg-amber-400", text: "text-amber-800" },
  invite_expired: { label: "Invite expired", dot: "bg-orange-400", text: "text-orange-800" },
  active: { label: "Active", dot: "bg-emerald-400", text: "text-emerald-700" },
};

type InvitableRole = "admin" | "senior" | "staff" | "view-only";

/** Labels must match `notifPrefs` keys — laid out 2×3 like Workflow. */
const NOTIFICATION_ITEMS: { label: string; desc: string }[] = [
  { label: "Proposal accepted", desc: "When a client accepts a proposal" },
  { label: "Proposal rejected", desc: "When a client declines a proposal" },
  { label: "Proposal viewed", desc: "When a client views a proposal" },
  { label: "Engagement letter signed", desc: "When a client signs an engagement letter" },
  { label: "Approval required", desc: "When a proposal needs your approval" },
  { label: "Work plan due", desc: "When a work plan task is due soon" },
];

// ─── Inner component ──────────────────────────────────────────────────────────

function normalizeSettingsTab(tab: string | null) {
  if (tab === "overview") return "org";
  return tab ?? "org";
}

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(() => normalizeSettingsTab(searchParams.get("tab")));

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw === "overview") {
      router.replace("/settings?tab=org", { scroll: false });
    }
    setActiveTab(normalizeSettingsTab(raw));
  }, [searchParams, router]);

  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;
  const canManageMembers = user?.role === "owner" || user?.role === "admin";

  // ─── Convex queries ───────────────────────────────────────────────────────
  const firmSettings = useQuery(api.firms.getFirmSettings, userId ? { userId } : "skip");
  const convexUsers  = useQuery(api.users.listUsers,        userId ? { userId } : "skip");
  const userProfile  = useQuery(api.users.getUserProfile,   userId ? { userId } : "skip");

  // ─── Convex mutations ─────────────────────────────────────────────────────
  const updateFirmSettingsMut          = useMutation(api.firms.updateFirmSettings);
  const inviteUserMut                  = useMutation(api.users.inviteUser);
  const updateUserRoleMut              = useMutation(api.users.updateUserRole);
  const removeUserMut                  = useMutation(api.users.removeUser);
  const updateProfileMut               = useMutation(api.users.updateProfile);
  const updateNotifPrefsMut            = useMutation(api.users.updateNotificationPreferences);
  const createCheckoutAction           = useAction(api.stripe.createCheckoutSession);
  const createPortalAction             = useAction(api.stripe.createCustomerPortalSession);
  const clearFirmLogoMut               = useMutation(api.authFunctions.clearFirmLogo);
  const generateLogoUploadUrl          = useMutation(api.authFunctions.generateLogoUploadUrl);
  const updateFirmMut                  = useMutation(api.authFunctions.updateFirm);
  const updateUserAvatarMut            = useMutation(api.users.updateUserAvatar);
  const clearUserAvatarMut             = useMutation(api.users.clearUserAvatar);

  const loading = firmSettings === undefined || convexUsers === undefined;
  const members = convexUsers ?? [];
  const firmId = firmSettings?._id;
  const currentPlan: SubscriptionPlan = (firmSettings?.subscriptionPlan as SubscriptionPlan | undefined) ?? "starter";
  const isPro      = currentPlan === "professional" || currentPlan === "enterprise";
  const isBusiness = currentPlan === "enterprise";

  // Redirect non-business users away from the org tab (business-only) to account
  useEffect(() => {
    if (firmSettings === undefined) return;
    if (!isBusiness && activeTab === "org") {
      router.replace("/settings?tab=account", { scroll: false });
    }
  }, [firmSettings, isBusiness, activeTab, router]);

  const [saving, setSaving] = useState(false);
  const [defaultTaxRate, setDefaultTaxRate] = useState("15");
  const [defaultPayFreq, setDefaultPayFreq] = useState<"monthly" | "quarterly" | "annually" | "as_delivered">("monthly");
  const [defaultExpiryDays, setDefaultExpiryDays] = useState("30");
  const [proposalPrefix, setProposalPrefix] = useState("PROP-");
  const [requireApproval, setRequireApproval] = useState(false);

  const [firmName, setFirmName] = useState("Your Firm");
  const [firmLogoUrl, setFirmLogoUrl] = useState<string | null>(null);
  const firmLogoInputRef = useRef<HTMLInputElement>(null);
  /** True after user picks/removes a logo locally; avoids overwriting preview before save. */
  const firmLogoDirtyRef = useRef(false);
  /** True when logo preview changed but not yet saved to Convex (sidebar reads saved data). */
  const [logoNeedsApply, setLogoNeedsApply] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [profileEmail, setProfileEmail] = useState(user?.email ?? "");
  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarNeedsApply, setAvatarNeedsApply] = useState(false);
  const avatarDirtyRef = useRef(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [savingFirm, setSavingFirm] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableRole>("staff");
  const [inviting, setInviting] = useState(false);
  const [memberFilter, setMemberFilter] = useState<"all" | "invitations" | "collaborators" | "requests">("all");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberRoleFilter, setMemberRoleFilter] = useState("all");
  const [accessRequests] = useState<{ id: string; name: string; email: string; project: string; role: string; requestedAgo: string }[]>([]);

  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    "Proposal accepted": true, "Proposal rejected": true, "Proposal viewed": true,
    "Engagement letter signed": true, "Approval required": true, "Work plan due": true,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);


  // Pricing settings
  const [currency, setCurrency] = useState("ZAR");
  const [jurisdiction, setJurisdiction] = useState("ZA");
  const [showTaxInclusive, setShowTaxInclusive] = useState(false);
  const [roundPrices, setRoundPrices] = useState(true);
  const [savingPricing, setSavingPricing] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("annual");
  const [savingPlan, setSavingPlan] = useState<SubscriptionPlan | null>(null);

  // Workflow settings
  const [sendReminders, setSendReminders] = useState(true);
  const [reminderDays, setReminderDays] = useState("3");
  const [autoExpire, setAutoExpire] = useState(true);
  const [requireSignature, setRequireSignature] = useState(false);
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  // Sync firm settings from Convex when loaded
  useEffect(() => {
    if (firmSettings) {
      setProposalPrefix(firmSettings.proposalNumberPrefix ?? "PROP-");
      setDefaultExpiryDays(String(firmSettings.defaultProposalValidityDays ?? 30));
      setRequireApproval(firmSettings.requireApprovalBeforeSend ?? false);
      setFirmName(firmSettings.name ?? "Your Firm");
      setContactEmail(firmSettings.billingEmail ?? "");
      setPhone(firmSettings.phone ?? "");
      setCurrency(firmSettings.currency ?? "ZAR");
      setJurisdiction(firmSettings.jurisdiction ?? "ZA");
      // Workflow
      setAutoExpire(firmSettings.autoExpireProposals ?? true);
      setDefaultExpiryDays(String(firmSettings.autoExpireDays ?? firmSettings.defaultProposalValidityDays ?? 30));
      setSendReminders(firmSettings.sendFollowUpReminders ?? true);
      setReminderDays(String(firmSettings.followUpReminderDays ?? 3));
      setRequireSignature(firmSettings.requireClientSignature ?? false);
      // Proposals
      setDefaultPayFreq((firmSettings.defaultPaymentFrequency ?? "monthly") as typeof defaultPayFreq);
      // Pricing
      setShowTaxInclusive(firmSettings.showTaxInclusive ?? false);
      setRoundPrices(firmSettings.roundPrices ?? true);
      setDefaultTaxRate(String(firmSettings.defaultTaxRate ?? 15));
    }
  }, [firmSettings?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Firm logo preview: mirror Convex until the user edits locally (then save writes removal/upload).
  useEffect(() => {
    if (firmSettings == null) return;
    if (!firmLogoDirtyRef.current) {
      setFirmLogoUrl(firmSettings.firmLogoUrl ?? null);
    }
  }, [firmSettings?.firmLogoUrl]);

  // Sync profile from Convex when loaded
  useEffect(() => {
    if (userProfile) {
      setProfileName(userProfile.name ?? "");
      setProfileEmail(userProfile.email ?? "");
      if (!avatarDirtyRef.current) {
        setAvatarPreview(userProfile.avatar ?? null);
      }
    }
  }, [userProfile?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync notification preferences from Convex when loaded
  useEffect(() => {
    if (userProfile?.notificationPreferences) {
      const prefs = userProfile.notificationPreferences;
      setNotifPrefs({
        "Proposal accepted":        prefs.proposalAccepted        ?? true,
        "Proposal rejected":        prefs.proposalRejected        ?? true,
        "Proposal viewed":          prefs.proposalViewed          ?? true,
        "Engagement letter signed": prefs.engagementLetterSigned  ?? true,
        "Approval required":        prefs.approvalRequired        ?? true,
        "Work plan due":            prefs.workPlanDue             ?? true,
      });
    }
  }, [userProfile?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveFirm() {
    if (!userId) return;
    setSavingFirm(true);
    try {
      await updateFirmSettingsMut({
        userId,
        name: firmName.trim() || undefined,
        billingEmail: contactEmail.trim() || undefined,
        phone: phone.trim() || undefined,
      });

      // Persist firm logo to Convex (`firm.logo`) — sidebar, proposals, and emails read this.
      if (firmLogoUrl === null) {
        await clearFirmLogoMut({ userId });
      } else if (firmLogoUrl.startsWith("data:")) {
        const res = await fetch(firmLogoUrl);
        const blob = await res.blob();
        if (blob.size > 2 * 1024 * 1024) {
          toast.error("Logo must be 2MB or smaller.");
          return;
        }
        const uploadUrl = await generateLogoUploadUrl({ userId });
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type || "application/octet-stream" },
          body: blob,
        });
        if (!uploadRes.ok) {
          toast.error("Logo upload failed");
          return;
        }
        const json = (await uploadRes.json()) as { storageId?: Id<"_storage"> };
        if (!json.storageId) {
          toast.error("Logo upload failed");
          return;
        }
        await updateFirmMut({ userId, logo: json.storageId });
      }

      firmLogoDirtyRef.current = false;
      setLogoNeedsApply(false);
      toast.success("Firm details saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingFirm(false);
    }
  }

  function onFirmLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image (PNG, JPG, or WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be 2MB or smaller.");
      return;
    }
    firmLogoDirtyRef.current = true;
    const reader = new FileReader();
    reader.onload = () => {
      setFirmLogoUrl(reader.result as string);
      setLogoNeedsApply(true);
      toast.success("Logo preview ready", {
        description: "Click Save logo below, or Save changes at the bottom of this section.",
      });
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsDataURL(file);
  }

  function clearFirmLogoLocal() {
    firmLogoDirtyRef.current = true;
    setFirmLogoUrl(null);
    setLogoNeedsApply(true);
    if (firmLogoInputRef.current) firmLogoInputRef.current.value = "";
    toast.success("Logo removed from preview", {
      description: "Click Save logo below, or Save changes at the bottom to update the sidebar.",
    });
  }

  function onAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, or WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Avatar must be 2 MB or smaller.");
      return;
    }
    avatarDirtyRef.current = true;
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
      setAvatarNeedsApply(true);
      toast.success("Avatar ready — click Save profile to apply.");
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsDataURL(file);
  }

  function clearAvatarLocal() {
    avatarDirtyRef.current = true;
    setAvatarPreview(null);
    setAvatarNeedsApply(true);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
    toast.info("Avatar removed — click Save profile to apply.");
  }

  async function saveProposalSettings() {
    if (!userId) return;
    setSaving(true);
    try {
      await updateFirmSettingsMut({
        userId,
        proposalNumberPrefix: proposalPrefix.trim() || "PROP-",
        defaultProposalValidityDays: parseInt(defaultExpiryDays) || 30,
        requireApprovalBeforeSend: requireApproval,
        defaultPaymentFrequency: defaultPayFreq,
        defaultTaxRate: parseFloat(defaultTaxRate) || 15,
      });
      toast.success("Settings saved");
    } catch { toast.error("Failed to save settings"); }
    finally { setSaving(false); }
  }

  async function saveNotifications() {
    if (!userId) return;
    setSavingNotifs(true);
    try {
      await updateNotifPrefsMut({
        userId,
        notificationPreferences: {
          proposalAccepted:        notifPrefs["Proposal accepted"]        ?? true,
          proposalRejected:        notifPrefs["Proposal rejected"]        ?? true,
          proposalViewed:          notifPrefs["Proposal viewed"]          ?? true,
          engagementLetterSigned:  notifPrefs["Engagement letter signed"] ?? true,
          approvalRequired:        notifPrefs["Approval required"]        ?? true,
          workPlanDue:             notifPrefs["Work plan due"]            ?? true,
        },
      });
      toast.success("Notification preferences saved");
    } catch { toast.error("Failed to save preferences"); }
    finally { setSavingNotifs(false); }
  }

  async function changeRole(memberId: string, newRole: string) {
    if (!userId) return;
    const target = members.find((m) => m._id === memberId);
    try {
      await updateUserRoleMut({
        adminId: userId,
        targetUserId: memberId as Id<"users">,
        newRole: newRole as "admin" | "senior" | "staff" | "view-only",
      });
      toast.success(`${target?.name ?? "User"} is now ${ROLE_CONFIG[newRole]?.label ?? newRole}`);
    } catch { toast.error("Failed to update role"); }
  }

  async function sendInvite() {
    const name = inviteName.trim();
    const email = inviteEmail.trim().toLowerCase();
    if (!name) { toast.error("Please enter a name"); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address"); return;
    }
    if (members.some((m) => m.email.toLowerCase() === email)) {
      toast.error("A member with this email already exists"); return;
    }
    if (!userId) return;
    setInviting(true);
    try {
      await inviteUserMut({ inviterId: userId, name, email, role: inviteRole });
      toast.success(`We emailed an invite link to ${email}`);
      setInviteOpen(false);
      setInviteName("");
      setInviteEmail("");
      setInviteRole("staff");
    } catch { toast.error("Failed to send invite"); }
    finally { setInviting(false); }
  }

  async function handleSelectPlan(planId: SubscriptionPlan) {
    if (!userId || !firmId) return;
    if (planId === "starter") {
      toast.info("Contact support to downgrade to the Starter plan.");
      return;
    }
    setSavingPlan(planId);
    try {
      const result = await createCheckoutAction({
        userId,
        firmId,
        planId: planId as "professional" | "enterprise",
        billingPeriod,
      });
      if (result.error) {
        toast.error(result.error);
      } else if (result.url) {
        window.location.href = result.url;
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to start checkout");
    } finally {
      setSavingPlan(null);
    }
  }

  async function handleManageSubscription() {
    if (!userId || !firmId) return;
    setSavingPlan("professional");
    try {
      const result = await createPortalAction({ userId, firmId });
      if (result.error) {
        toast.error(result.error);
      } else if (result.url) {
        window.location.href = result.url;
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to open billing portal");
    } finally {
      setSavingPlan(null);
    }
  }

  return (
    <>
      <Header />

      <div className="p-6 space-y-5">

        {/* ── Org profile (2-col grid like Workflow) ─────────────────── */}
        {activeTab === "org" && (
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <input
              ref={firmLogoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              onChange={onFirmLogoFileChange}
            />

            <div className="px-6 pt-6 pb-1 border-b border-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Organization profile
              </p>
              <p className="text-[12px] text-slate-500 mt-1">
                Firm details on proposals, engagement letters, and client emails.
              </p>
            </div>

            {/* Row 1 — Firm name | Firm logo */}
            <div className="border-b border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100">
                <div className="px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b md:border-b-0 border-slate-100">
                  <div className="min-w-0 sm:max-w-[240px]">
                    <p className="text-[13px] font-medium text-slate-800">Firm name</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Legal or trading name clients see on documents.
                    </p>
                  </div>
                  <div className="w-full sm:w-[min(100%,280px)] sm:shrink-0">
                    <Input
                      value={firmName}
                      onChange={(e) => setFirmName(e.target.value)}
                      placeholder="Apex Accounting & Advisory"
                      className="h-9 text-[13px] border-slate-200"
                    />
                  </div>
                </div>
                <div className="px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 lg:max-w-[200px]">
                    <p className="text-[13px] font-medium text-slate-800">Firm logo</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      PNG, JPG, WebP or SVG · max 2&nbsp;MB
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 items-start shrink-0 lg:justify-end">
                    <div
                      className={cn(
                        "relative flex h-[100px] w-[140px] shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50",
                        firmLogoUrl ? "border-slate-200" : "border-dashed border-slate-200"
                      )}
                    >
                      {firmLogoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URL
                        <img src={firmLogoUrl} alt="Firm logo" className="max-h-full max-w-full object-contain p-2" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 px-2 text-center">
                          <Building2 className="h-8 w-8 text-slate-300" />
                          <span className="text-[10px] text-slate-400">No logo</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => firmLogoInputRef.current?.click()}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          {firmLogoUrl ? (
                            <>
                              <Pencil className="h-3.5 w-3.5" />
                              Replace
                            </>
                          ) : (
                            <>
                              <Upload className="h-3.5 w-3.5" />
                              Upload
                            </>
                          )}
                        </button>
                        {firmLogoUrl && (
                          <button
                            type="button"
                            onClick={clearFirmLogoLocal}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-snug max-w-[240px]">
                        Used on proposals, the sidebar, and outbound emails. After upload or remove, click{" "}
                        <span className="font-medium text-slate-600">Save logo</span> here or{" "}
                        <span className="font-medium text-slate-600">Save changes</span> at the bottom.
                      </p>
                      {logoNeedsApply && (
                        <button
                          type="button"
                          onClick={saveFirm}
                          disabled={savingFirm}
                          className="inline-flex h-8 w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-white disabled:opacity-50 hover:opacity-95 transition-opacity shadow-sm"
                          style={{ background: "#C8A96E" }}
                        >
                          {savingFirm ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Save logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2 — Contact email | Phone */}
            <div className="border-b border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100">
                <div className="px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b md:border-b-0 border-slate-100">
                  <div className="min-w-0 sm:max-w-[240px]">
                    <p className="text-[13px] font-medium text-slate-800">Contact email</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Public reply-to on sent documents.</p>
                  </div>
                  <div className="w-full sm:w-[min(100%,280px)] sm:shrink-0">
                    <Input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="info@apexaccounting.co.za"
                      className="h-9 text-[13px] border-slate-200"
                    />
                  </div>
                </div>
                <div className="px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 sm:max-w-[240px]">
                    <p className="text-[13px] font-medium text-slate-800">Phone</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Main line (optional).</p>
                  </div>
                  <div className="w-full sm:w-[min(100%,280px)] sm:shrink-0">
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+27 11 000 0000"
                      className="h-9 text-[13px] border-slate-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 px-6 py-4 border-t border-slate-100">
              {logoNeedsApply && (
                <p className="text-[11px] text-amber-700/90 mb-0.5 text-right max-w-md">
                  Logo changes are not saved yet — use Save logo above or the button here.
                </p>
              )}
              <button
                type="button"
                onClick={saveFirm}
                disabled={savingFirm}
                className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: "#C8A96E" }}
              >
                {savingFirm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save changes
              </button>
            </div>
          </div>
        )}

        {/* ── Account (layout matches Workflow: 2-col rows + divide-x) ─ */}
        {activeTab === "account" && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={onAvatarFileChange}
              />

              <div className="px-6 pt-6 pb-1 border-b border-slate-100">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Personal account
                </p>
                <p className="text-[12px] text-slate-500 mt-1">
                  Your profile, email, and password for this workspace.
                </p>
              </div>

              {/* Row 1 — Avatar | Full name */}
              <div className="border-b border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100">
                  {/* Avatar upload */}
                  <div className="px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between border-b md:border-b-0 border-slate-100">
                    <div className="min-w-0 lg:max-w-[200px]">
                      <p className="text-[13px] font-medium text-slate-800">Avatar</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        PNG, JPG or WebP · max 2&nbsp;MB
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 items-start shrink-0 lg:justify-end">
                      {/* Preview */}
                      <div
                        className={cn(
                          "relative flex h-[80px] w-[80px] shrink-0 items-center justify-center overflow-hidden rounded-xl border",
                          avatarPreview ? "border-slate-200" : "border-dashed border-slate-200 bg-slate-50"
                        )}
                      >
                        {avatarPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 px-2 text-center">
                            <div
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-[13px] font-bold text-[#243E63]"
                              style={{ background: "#C8A96E" }}
                            >
                              {getInitials(profileName || (user?.name ?? "U"))}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex flex-col gap-2 min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                          >
                            {avatarPreview ? (
                              <><Pencil className="h-3.5 w-3.5" />Replace</>
                            ) : (
                              <><Upload className="h-3.5 w-3.5" />Upload</>
                            )}
                          </button>
                          {avatarPreview && (
                            <button
                              type="button"
                              onClick={clearAvatarLocal}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />Remove
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-snug max-w-[220px]">
                          Shown on your profile and visible to team members. Click{" "}
                          <span className="font-medium text-slate-600">Save profile</span> below to apply.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-5 flex flex-col gap-3">
                    <div>
                      <p className="text-[13px] font-medium text-slate-800">Full name</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">As visible to team members.</p>
                    </div>
                    <div className="w-full max-w-md md:ml-auto md:max-w-[280px]">
                      <Input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        placeholder="Your full name"
                        className="h-9 text-[13px] border-slate-200"
                      />
                      <p className="text-[11px] text-slate-400 text-right mt-1">{profileName.length} / 50</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2 — Email | Delete account */}
              <div className="border-b border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100">
                  <div className="px-6 py-5 flex flex-col gap-3 border-b md:border-b-0 border-slate-100">
                    <div>
                      <p className="text-[13px] font-medium text-slate-800">Email address</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Used for login and notifications.</p>
                    </div>
                    <div className="w-full max-w-md md:max-w-[280px]">
                      <Input
                        type="email"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        placeholder="you@firm.co.za"
                        className="h-9 text-[13px] border-slate-200"
                      />
                    </div>
                  </div>
                  <div className="px-6 py-5 flex flex-col gap-3">
                    <div>
                      <p className="text-[13px] font-medium text-red-600">Delete account</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Permanently delete your account and associated data. This cannot be undone.</p>
                    </div>
                    <div className="w-full max-w-md md:ml-auto md:max-w-[280px]">
                      <button
                        type="button"
                        onClick={() => toast.error("Please contact support to delete your account.")}
                        className="h-9 px-4 rounded-lg text-[12px] font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                      >
                        Delete account
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end px-6 py-4 border-t border-slate-100">
                <button
                  onClick={async () => {
                    if (!userId) return;
                    setSavingFirm(true);
                    try {
                      // Save avatar if it was changed
                      if (avatarDirtyRef.current) {
                        if (avatarPreview === null) {
                          await clearUserAvatarMut({ userId });
                        } else if (avatarPreview.startsWith("data:")) {
                          const res = await fetch(avatarPreview);
                          const blob = await res.blob();
                          const uploadUrl = await generateLogoUploadUrl({ userId });
                          const uploadRes = await fetch(uploadUrl, {
                            method: "POST",
                            headers: { "Content-Type": blob.type || "application/octet-stream" },
                            body: blob,
                          });
                          if (!uploadRes.ok) throw new Error("Avatar upload failed");
                          const json = (await uploadRes.json()) as { storageId?: Id<"_storage"> };
                          if (!json.storageId) throw new Error("No storage ID returned");
                          const result = await updateUserAvatarMut({ userId, storageId: json.storageId });
                          if (result.avatarUrl) setAvatarPreview(result.avatarUrl);
                        }
                        avatarDirtyRef.current = false;
                        setAvatarNeedsApply(false);
                      }
                      // Save name
                      await updateProfileMut({ userId, name: profileName.trim() || undefined });
                      toast.success("Profile saved");
                    } catch { toast.error("Failed to save profile"); }
                    finally { setSavingFirm(false); }
                  }}
                  disabled={savingFirm}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                  style={{ background: "#C8A96E" }}
                >
                  {savingFirm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save profile
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ── People ─────────────────────────────────────────────────── */}
        {activeTab === "people" && (
          <>
            {/* Invite — slide-over (matches Work planning / other panels) */}
            <Sheet
              open={inviteOpen}
              onOpenChange={(open) => {
                setInviteOpen(open);
                if (!open) {
                  setInviteName("");
                  setInviteEmail("");
                  setInviteRole("staff");
                }
              }}
            >
              <SheetContent
                side="right"
                hideClose
                className="w-full sm:max-w-none sm:w-[460px] p-0 border-l border-slate-200 shadow-2xl flex flex-col bg-white"
              >
                <SheetTitle className="sr-only">Invite Team Member</SheetTitle>
                <div className="flex flex-col h-full max-h-[100dvh]">
                  <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0"
                          style={{ background: "rgba(200, 169, 110, 0.12)" }}
                        >
                          <UserPlus className="h-7 w-7" style={{ color: "#C8A96E" }} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-base font-semibold text-slate-900 leading-tight">Invite Team Member</h2>
                          <p className="text-sm text-slate-500 mt-0.5">Send an invite to join your workspace</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInviteOpen(false)}
                        disabled={inviting}
                        className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="invite-name" className="text-[13px]">
                        Full name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="invite-name"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Sarah Mitchell"
                        disabled={inviting}
                        onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                        className="h-10 text-[13px] border-slate-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invite-email" className="text-[13px]">
                        Work email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="invite-email"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="sarah@yourfirm.co.za"
                        disabled={inviting}
                        onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                        className="h-10 text-[13px] border-slate-200"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[13px]">Role</Label>
                      <Select
                        value={inviteRole}
                        onValueChange={(v) => setInviteRole(v as InvitableRole)}
                        disabled={inviting}
                      >
                        <SelectTrigger className="h-10 text-[13px] border-slate-200">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {user?.role === "owner" && (
                            <SelectItem value="admin">Admin</SelectItem>
                          )}
                          <SelectItem value="senior">Senior</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="view-only">View Only</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        They join with this role; you can change it anytime from the team table.
                      </p>
                    </div>
                  </div>

                  <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2 flex-row justify-end">
                    <button
                      type="button"
                      onClick={() => setInviteOpen(false)}
                      disabled={inviting}
                      className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={sendInvite}
                      disabled={inviting}
                      className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                      style={{ background: "#C8A96E" }}
                    >
                      {inviting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Mail className="h-3.5 w-3.5" />
                      )}
                      Send invite
                    </button>
                  </SheetFooter>
                </div>
              </SheetContent>
            </Sheet>

            {/* Main members card — overflow-visible so row action menus aren’t visually clipped */}
            <div className="bg-white border border-slate-100 rounded-xl overflow-visible">

              {/* Filter tabs */}
              <div className="px-5 pt-4 pb-0 flex items-center gap-1 border-b border-slate-100">
                {([
                  { id: "all",          label: `All (${members.length})` },
                  { id: "invitations",  label: "Invitations" },
                  { id: "collaborators",label: "Collaborators" },
                  { id: "requests",     label: accessRequests.length > 0 ? `Access requests (${accessRequests.length})` : "Access requests" },
                ] as const).map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setMemberFilter(id)}
                    className={cn(
                      "h-8 px-3 text-[13px] font-medium rounded-t-lg transition-colors border-b-2 -mb-px whitespace-nowrap",
                      memberFilter === id
                        ? "border-[#C8A96E] text-[#C8A96E]"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Toolbar */}
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-[280px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/20 focus:border-[#C8A96E]/40 bg-white"
                  />
                </div>
                {/* Role filter */}
                <Select value={memberRoleFilter} onValueChange={setMemberRoleFilter}>
                  <SelectTrigger className="h-9 w-[130px] text-[13px] border-slate-200">
                    <SelectValue placeholder="All roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="view-only">View Only</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex-1" />

                {canManageMembers && (
                  <button
                    onClick={() => setInviteOpen(true)}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-lg text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: "#C8A96E" }}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Invite members
                  </button>
                )}
              </div>

              {/* Access requests panel */}
              {memberFilter === "requests" && (
                <>
                  <div className="grid grid-cols-[1fr_130px_110px_140px_180px] bg-slate-50/60 border-b border-slate-100 px-5 py-2.5 gap-2">
                    {["User", "Project", "Role", "Requested", "Actions"].map((h) => (
                      <span key={h} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider last:text-right">{h}</span>
                    ))}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {accessRequests.length === 0 ? (
                      <p className="px-5 py-8 text-[13px] text-slate-400 text-center">No pending access requests.</p>
                    ) : accessRequests.map((req) => (
                      <div key={req.id} className="grid grid-cols-[1fr_130px_110px_140px_180px] px-5 py-3.5 gap-2 items-center hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: "#C8A96E" }}>
                            {getInitials(req.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">{req.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">{req.email}</p>
                          </div>
                        </div>
                        <span className="text-[13px] text-slate-600 font-medium underline underline-offset-2 cursor-pointer">{req.project}</span>
                        <span className="text-[13px] text-slate-700">{req.role}</span>
                        <span className="text-[13px] text-slate-500">{req.requestedAgo}</span>
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => toast.success("Request denied")}
                            className="h-8 px-3 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                            Deny
                          </button>
                          <button onClick={() => toast.success(`${req.name} approved`)}
                            className="h-8 px-3 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Members table — hidden when on requests tab */}
              {memberFilter !== "requests" && (
              <>
              {/* Table header */}
              <div className="grid grid-cols-[minmax(0,1fr)_160px_140px_140px_130px] bg-slate-50/60 border-b border-slate-100 px-5 py-2.5 gap-2">
                {(["Name", "Role", "Date added", "Status", "Actions"] as const).map((h) => (
                  <span
                    key={h}
                    className={cn(
                      "text-[11px] font-semibold text-slate-400 uppercase tracking-wider",
                      h === "Actions" && "text-right"
                    )}
                  >
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-100">
                {members
                  .filter((m) => {
                    const matchSearch = !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase());
                    const matchRole = memberRoleFilter === "all" || m.role === memberRoleFilter;
                    const ms = m.membershipStatus as MembershipStatus;
                    const matchMemberTab =
                      memberFilter === "all" ||
                      (memberFilter === "invitations" &&
                        (ms === "pending_invite" || ms === "invite_expired")) ||
                      (memberFilter === "collaborators" && ms === "active");
                    return matchSearch && matchRole && matchMemberTab;
                  })
                  .map((m) => {
                    const roleCfg = ROLE_CONFIG[m.role] ?? { label: m.role, dot: "bg-slate-300", text: "text-slate-500" };
                    const statusCfg =
                      MEMBERSHIP_STATUS_CONFIG[m.membershipStatus as MembershipStatus] ??
                      MEMBERSHIP_STATUS_CONFIG.active;
                    const isCurrentUser = m._id === user?.id;
                    const canEditRole = canManageMembers && !isCurrentUser && m.role !== "owner";
                    const canChangeRole =
                      canEditRole && !(user?.role !== "owner" && m.role === "admin");
                    const canRemove = canManageMembers && !isCurrentUser && m.role !== "owner";
                    /** Show ⋯ whenever you can manage members (owner/admin); row may only show a “why empty” note. */
                    const showDotsMenu = canManageMembers;
                    const hasRowActions = canChangeRole || canRemove;
                    return (
                      <div
                        key={m._id}
                        className={cn(
                          "grid grid-cols-[minmax(0,1fr)_160px_140px_140px_130px] px-5 py-3.5 gap-2 items-center group",
                          isCurrentUser ? "bg-[#C8A96E]/[0.02]" : "hover:bg-slate-50/50 transition-colors"
                        )}
                      >
                        {/* Name + email */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                            style={{ background: "#C8A96E" }}
                          >
                            {getInitials(m.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">
                              {m.name}{isCurrentUser && <span className="ml-1.5 text-[11px] font-semibold" style={{ color: "#C8A96E" }}>(you)</span>}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{m.email}</p>
                          </div>
                        </div>

                        {/* Role (read-only; change via Actions) */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${roleCfg.dot}`} />
                          <span className={`text-[13px] font-medium truncate ${roleCfg.text}`}>{roleCfg.label}</span>
                        </div>

                        {/* Joined date */}
                        <p className="text-[13px] text-slate-500">{formatDate(m.createdAt)}</p>

                        {/* Status */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusCfg.dot}`} />
                          <span className={`text-[13px] font-medium truncate ${statusCfg.text}`} title={statusCfg.label}>
                            {statusCfg.label}
                          </span>
                        </div>

                        {/* Actions — ⋯ for every row when you’re owner/admin (incl. owner row + your row, with help text when locked) */}
                        <div className="flex justify-end min-w-0">
                          {showDotsMenu ? (
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={cn(
                                    "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center transition-colors",
                                    "border-0 bg-transparent text-slate-500",
                                    "hover:bg-slate-100/80 hover:text-[#243E63]",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E]/35 focus-visible:ring-offset-2"
                                  )}
                                  aria-label={`Actions for ${m.name}`}
                                  title="Actions"
                                >
                                  <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                sideOffset={6}
                                className="z-[300] w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
                              >
                                {hasRowActions ? (
                                  <>
                                    {canChangeRole && (
                                      <>
                                        <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                          Change role
                                        </DropdownMenuLabel>
                                        {user?.role === "owner" && (
                                          <DropdownMenuItem
                                            disabled={m.role === "admin"}
                                            className="text-[13px] cursor-pointer"
                                            onClick={() => changeRole(m._id, "admin")}
                                          >
                                            Admin
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                          disabled={m.role === "senior"}
                                          className="text-[13px] cursor-pointer"
                                          onClick={() => changeRole(m._id, "senior")}
                                        >
                                          Senior
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          disabled={m.role === "staff"}
                                          className="text-[13px] cursor-pointer"
                                          onClick={() => changeRole(m._id, "staff")}
                                        >
                                          Staff
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          disabled={m.role === "view-only"}
                                          className="text-[13px] cursor-pointer"
                                          onClick={() => changeRole(m._id, "view-only")}
                                        >
                                          View Only
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    {canChangeRole && canRemove && <DropdownMenuSeparator />}
                                    {canRemove && (
                                      <DropdownMenuItem
                                        className="text-[13px] text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer flex items-center gap-2"
                                        onClick={async () => {
                                          if (!userId) return;
                                          try {
                                            await removeUserMut({
                                              adminId: userId,
                                              targetUserId: m._id as Id<"users">,
                                            });
                                            toast.success(`${m.name} removed`);
                                          } catch {
                                            toast.error("Failed to remove user");
                                          }
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                        Remove from workspace
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                      {m.role === "owner" ? "Workspace owner" : "Actions"}
                                    </DropdownMenuLabel>
                                    <div className="px-2 pb-2 text-[12px] text-slate-600 leading-relaxed">
                                      {m.role === "owner"
                                        ? "The organization owner can’t be reassigned or removed from this table. Transfer ownership is a separate process."
                                        : isCurrentUser
                                          ? "You can’t change your own role or remove your own account here. Ask another owner or admin if needed."
                                          : "No actions are available for this member with your current permissions."}
                                    </div>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-[11px] text-slate-300 select-none tabular-nums" title="Only owners and admins can manage members">
                              —
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2">
                <UserCog className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <p className="text-[11px] text-slate-400">
                  Role permissions are enforced across the entire workspace.
                  {!canManageMembers && " Only Owners and Admins can manage member roles."}
                </p>
              </div>
              </>
              )}
            </div>
          </>
        )}

        {/* ── Proposals (2-col grid like Workflow) ─────────────────────── */}
        {activeTab === "proposals" && (
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-6 pt-6 pb-1 border-b border-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Proposal defaults
              </p>
              <p className="text-[12px] text-slate-500 mt-1">
                Numbers, billing rhythm, and approval rules for new proposals.
              </p>
            </div>

            {loading ? (
              <div className="px-6 py-8">
                <Skeleton className="h-44 w-full rounded-lg" />
              </div>
            ) : (
              <>
                {/* Row 1 — VAT | Payment frequency */}
                <div className="border-b border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100">
                    <div className="px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b md:border-b-0 border-slate-100">
                      <div className="min-w-0 sm:max-w-[240px]">
                        <p className="text-[13px] font-medium text-slate-800">Default VAT rate (%)</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">When no line-item rate is set.</p>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={defaultTaxRate}
                        onChange={(e) => setDefaultTaxRate(e.target.value)}
                        className="h-9 w-full sm:w-24 text-[13px] border-slate-200 text-right"
                      />
                    </div>
                    <div className="px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 sm:max-w-[220px]">
                        <p className="text-[13px] font-medium text-slate-800">Default payment frequency</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Recurring billing default for fees.</p>
                      </div>
                      <div className="w-full sm:w-[min(100%,220px)] sm:shrink-0">
                        <Select value={defaultPayFreq} onValueChange={(v) => setDefaultPayFreq(v as "monthly" | "quarterly" | "annually" | "as_delivered")}>
                          <SelectTrigger className="h-9 text-[13px] border-slate-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="annually">Annually</SelectItem>
                            <SelectItem value="as_delivered">As Delivered</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2 — Expiry | Prefix */}
                <div className="border-b border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100">
                    <div className="px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b md:border-b-0 border-slate-100">
                      <div className="min-w-0 sm:max-w-[240px]">
                        <p className="text-[13px] font-medium text-slate-800">Default expiry (days)</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Days until the proposal expires.</p>
                      </div>
                      <Input
                        type="number"
                        min="1"
                        value={defaultExpiryDays}
                        onChange={(e) => setDefaultExpiryDays(e.target.value)}
                        className="h-9 w-full sm:w-24 text-[13px] border-slate-200 text-right"
                      />
                    </div>
                    <div className="px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 sm:max-w-[240px]">
                        <p className="text-[13px] font-medium text-slate-800">Proposal number prefix</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">e.g. PROP- for PROP-1001.</p>
                      </div>
                      <Input
                        value={proposalPrefix}
                        onChange={(e) => setProposalPrefix(e.target.value)}
                        placeholder="PROP-"
                        className="h-9 w-full sm:w-[min(100%,200px)] text-[13px] border-slate-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3 — Approval (full width) */}
                <div className="border-b border-slate-100">
                  <div className="px-6 py-5 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-800">Require approval before sending</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Proposals must be approved before they can be sent to clients.
                      </p>
                    </div>
                    <Switch className="shrink-0" checked={requireApproval} onCheckedChange={setRequireApproval} />
                  </div>
                </div>

                <div className="flex justify-end px-6 py-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={saveProposalSettings}
                    disabled={saving}
                    className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                    style={{ background: "#C8A96E" }}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save proposals
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Notifications (2-col grid like Workflow) ─────────────────── */}
        {activeTab === "notifications" && (
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-6 pt-6 pb-1 border-b border-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Notifications
              </p>
              <p className="text-[12px] text-slate-500 mt-1">
                Choose which events send you email or in-app alerts.
              </p>
            </div>

            {[
              [NOTIFICATION_ITEMS[0], NOTIFICATION_ITEMS[1]],
              [NOTIFICATION_ITEMS[2], NOTIFICATION_ITEMS[3]],
              [NOTIFICATION_ITEMS[4], NOTIFICATION_ITEMS[5]],
            ].map((pair, rowIdx) => (
              <div
                key={rowIdx}
                className={cn(
                  "border-b border-slate-100",
                  rowIdx === 2 && "border-b-0"
                )}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100">
                  {pair.map(({ label, desc }, i) => (
                    <div
                      key={label}
                      className={cn(
                        "px-6 py-5 flex items-start justify-between gap-4",
                        i === 0 && "border-b md:border-b-0 border-slate-100"
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-[13px] font-medium text-slate-800">{label}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                      </div>
                      <Switch
                        className="shrink-0"
                        checked={notifPrefs[label] ?? true}
                        onCheckedChange={(v) => setNotifPrefs((prev) => ({ ...prev, [label]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-end px-6 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={saveNotifications}
                disabled={savingNotifs}
                className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: "#C8A96E" }}
              >
                {savingNotifs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save preferences
              </button>
            </div>
          </div>
        )}

        {/* ── Billing — filters + plan cards ──────────────────────────── */}
        {activeTab === "billing" && (
          <div className="space-y-6">
            {/* Filters: currency + region left; Billing (Monthly/Annual) far right, same line */}
            <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-3 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-9 text-[13px] border-slate-200 bg-white rounded-lg min-w-[120px] w-[min(100%,140px)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: "ZAR", label: "ZAR" },
                      { value: "USD", label: "USD" },
                      { value: "GBP", label: "GBP" },
                      { value: "EUR", label: "EUR" },
                      { value: "AUD", label: "AUD" },
                      { value: "NZD", label: "NZD" },
                    ].map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={jurisdiction} onValueChange={setJurisdiction}>
                  <SelectTrigger className="h-9 text-[13px] border-slate-200 bg-white rounded-lg min-w-[150px] w-[min(100%,200px)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: "ZA", label: "South Africa" },
                      { value: "US", label: "United States" },
                      { value: "UK", label: "United Kingdom" },
                      { value: "CA", label: "Canada" },
                      { value: "AU", label: "Australia" },
                      { value: "NZ", label: "New Zealand" },
                    ].map((j) => (
                      <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-[12px] font-medium text-slate-600 whitespace-nowrap">Billing:</span>
                <div className="flex rounded-md p-0.5 bg-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setBillingPeriod("monthly")}
                    className={cn(
                      "h-9 px-3.5 text-[12px] font-medium rounded transition-colors",
                      billingPeriod === "monthly"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingPeriod("annual")}
                    className={cn(
                      "h-9 px-3.5 text-[12px] font-medium rounded transition-colors",
                      billingPeriod === "annual"
                        ? "text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                    style={billingPeriod === "annual" ? { background: "#C8A96E" } : {}}
                  >
                    Annual
                  </button>
                </div>
              </div>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {PRICING_PLANS.map((plan) => {
                const isCurrent = currentPlan === plan.id;
                const isAnnual = billingPeriod === "annual";
                const priceUsd = isAnnual && plan.priceAnnualTotal > 0 ? plan.priceAnnualTotal : plan.priceMonthly;
                const priceUnit = isAnnual && plan.priceAnnualTotal > 0 ? "per year" : "per month";
                const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "EUR" ? "€" : "R";
                const price = currency === "ZAR" ? Math.round(priceUsd * 18) : priceUsd;
                const displayPrice = plan.priceMonthly === 0 ? "Free" : `${symbol}${price}`;
                const subLabel = plan.priceMonthly === 0 ? "Forever" : priceUnit;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col rounded-2xl p-5",
                      plan.highlight ? "text-white" : "bg-white border border-slate-200"
                    )}
                    style={plan.highlight ? { backgroundColor: "#243E63" } : {}}
                  >
                    {plan.badge && (
                      <span className="absolute top-4 right-4 text-[10px] font-bold tracking-[0.15em] uppercase px-2.5 py-0.5 rounded-full text-north-gold bg-north-gold/15 border border-north-gold/25">
                        {plan.badge}
                      </span>
                    )}

                    <span
                      className={cn(
                        "text-[11px] font-bold tracking-[0.18em] uppercase mb-3",
                        plan.highlight ? "text-white/50" : "text-slate-400"
                      )}
                    >
                      {plan.name}
                    </span>

                    <div className="flex items-baseline gap-1.5 mb-1">
                      <span
                        className={cn("font-bold leading-none", plan.highlight ? "text-white" : "text-slate-900")}
                        style={{ fontSize: "clamp(1.75rem, 3vw, 36px)" }}
                      >
                        {displayPrice}
                      </span>
                      <span
                        className={cn("text-[12px]", plan.highlight ? "text-white/50" : "text-slate-400")}
                      >
                        {subLabel}
                      </span>
                    </div>

                    <p
                      className={cn(
                        "text-[12px] leading-relaxed mb-4 mt-2",
                        plan.highlight ? "text-white/60" : "text-slate-500"
                      )}
                    >
                      {plan.description}
                    </p>

                    <div
                      className={cn("h-px w-full mb-4", plan.highlight ? "bg-white/10" : "bg-slate-100")}
                    />

                    <ul className="flex flex-col gap-2.5 flex-1 mb-5">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-north-gold" />
                          <span
                            className={cn(
                              "text-[12px] leading-snug",
                              plan.highlight ? "text-white/80" : "text-slate-600"
                            )}
                          >
                            {f}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      disabled={savingPlan !== null}
                      onClick={() => {
                        if (isCurrent && (plan.id === "professional" || plan.id === "enterprise"))
                          handleManageSubscription();
                        else if (!isCurrent) handleSelectPlan(plan.id);
                      }}
                      className={cn(
                        "group w-full h-[48px] rounded-full font-semibold text-[14px] mt-auto transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2",
                        plan.highlight
                          ? "bg-white text-north-navy hover:opacity-90"
                          : isCurrent
                            ? "bg-slate-100 text-slate-500 cursor-default"
                            : "bg-white border border-slate-200 text-slate-900 hover:border-north-gold hover:text-north-gold"
                      )}
                    >
                      {savingPlan === plan.id ? (
                        "Redirecting…"
                      ) : (
                        <>
                          <span>
                            {isCurrent && (plan.id === "professional" || plan.id === "enterprise")
                              ? "Manage subscription"
                              : isCurrent
                                ? "Current plan"
                                : plan.id === "starter"
                                  ? "Get started free"
                                  : plan.id === "professional"
                                    ? "Start Pro"
                                    : "Start Business"}
                          </span>
                          {!(isCurrent && plan.id === "starter") && (
                            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 shrink-0 opacity-90" />
                          )}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="text-slate-400 text-[13px] text-center">
              All plans include a 14-day Pro trial &nbsp;·&nbsp; No credit card required &nbsp;·&nbsp; Cancel any time
            </p>
          </div>
        )}

        {/* ── Workflow ────────────────────────────────────────────────── */}
        {activeTab === "workflow" && (
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">

            {/* Row 1 */}
            <div className="border-b border-slate-100">
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="px-6 py-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">Require approval before sending</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Proposals must be approved by an authorised member before they can be sent</p>
                  </div>
                  <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
                </div>
                <div className="px-6 py-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">Auto-expire proposals</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Automatically mark proposals as expired after the set number of days</p>
                  </div>
                  <Switch checked={autoExpire} onCheckedChange={setAutoExpire} />
                </div>
              </div>
            </div>

            {/* Row 2 */}
            <div className="border-b border-slate-100">
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="px-6 py-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">Default expiry days</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Number of days after sending before a proposal expires</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input value={defaultExpiryDays} onChange={(e) => setDefaultExpiryDays(e.target.value)} className="h-8 w-20 text-[13px] text-right border-slate-200" />
                    <span className="text-[12px] text-slate-500">days</span>
                  </div>
                </div>
                <div className="px-6 py-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">Send follow-up reminders</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Automatically email clients who haven't responded</p>
                  </div>
                  <Switch checked={sendReminders} onCheckedChange={setSendReminders} />
                </div>
              </div>
            </div>

            {/* Row 3 */}
            <div className="border-b border-slate-100">
              <div className="grid grid-cols-2 divide-x divide-slate-100">
                <div className="px-6 py-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">Reminder interval</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Days between reminder emails</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Input value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} disabled={!sendReminders} className="h-8 w-20 text-[13px] text-right border-slate-200 disabled:opacity-40" />
                    <span className="text-[12px] text-slate-500">days</span>
                  </div>
                </div>
                <div className="px-6 py-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">Require client signature</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Client must sign the engagement letter before proposal is considered accepted</p>
                  </div>
                  <Switch checked={requireSignature} onCheckedChange={setRequireSignature} />
                </div>
              </div>
            </div>

            {/* Save */}
            <div className="flex justify-end px-6 py-4">
              <button
                onClick={async () => {
                  if (!userId) return;
                  setSavingWorkflow(true);
                  try {
                    await updateFirmSettingsMut({
                      userId,
                      requireApprovalBeforeSend: requireApproval,
                      autoExpireProposals: autoExpire,
                      autoExpireDays: parseInt(defaultExpiryDays) || 30,
                      sendFollowUpReminders: sendReminders,
                      followUpReminderDays: parseInt(reminderDays) || 3,
                      requireClientSignature: requireSignature,
                    });
                    toast.success("Workflow settings saved");
                  } catch { toast.error("Failed to save workflow"); }
                  finally { setSavingWorkflow(false); }
                }}
                disabled={savingWorkflow}
                className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: "#C8A96E" }}
              >
                {savingWorkflow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Workflow
              </button>
            </div>
          </div>
        )}

        {/* ── Pricing defaults (2-col grid like Workflow) ──────────────── */}
        {activeTab === "pricing" && (
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-6 pt-6 pb-1 border-b border-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Pricing defaults
              </p>
              <p className="text-[12px] text-slate-500 mt-1">
                Currency, jurisdiction, and how tax and prices appear to clients.
              </p>
            </div>

            {/* Row 1 — Currency | Jurisdiction */}
            <div className="border-b border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100">
                <div className="px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b md:border-b-0 border-slate-100">
                  <div className="min-w-0 sm:max-w-[220px]">
                    <p className="text-[13px] font-medium text-slate-800">Default currency</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Billing and proposal currency.</p>
                  </div>
                  <div className="w-full sm:w-[min(100%,260px)] sm:shrink-0">
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="h-9 text-[13px] border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[{ value: "ZAR", label: "ZAR — South African Rand" }, { value: "USD", label: "USD — US Dollar" }, { value: "GBP", label: "GBP — British Pound" }, { value: "EUR", label: "EUR — Euro" }, { value: "AUD", label: "AUD — Australian Dollar" }, { value: "NZD", label: "NZD — New Zealand Dollar" }].map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="px-6 py-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 sm:max-w-[200px]">
                    <p className="text-[13px] font-medium text-slate-800">Jurisdiction</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tax and compliance region.</p>
                  </div>
                  <div className="w-full sm:w-[min(100%,240px)] sm:shrink-0">
                    <Select value={jurisdiction} onValueChange={setJurisdiction}>
                      <SelectTrigger className="h-9 text-[13px] border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[{ value: "ZA", label: "South Africa" }, { value: "US", label: "United States" }, { value: "UK", label: "United Kingdom" }, { value: "CA", label: "Canada" }, { value: "AU", label: "Australia" }, { value: "NZ", label: "New Zealand" }].map((j) => (
                          <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2 — Tax inclusive | Round prices */}
            <div className="border-b border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-slate-100">
                <div className="px-6 py-5 flex items-start justify-between gap-4 border-b md:border-b-0 border-slate-100">
                  <div className="min-w-0 pr-2">
                    <p className="text-[13px] font-medium text-slate-800">Show tax-inclusive prices</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Display all prices including tax to clients.</p>
                  </div>
                  <Switch className="shrink-0" checked={showTaxInclusive} onCheckedChange={setShowTaxInclusive} />
                </div>
                <div className="px-6 py-5 flex items-start justify-between gap-4">
                  <div className="min-w-0 pr-2">
                    <p className="text-[13px] font-medium text-slate-800">Round prices to whole numbers</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Hide decimal places on displayed amounts.</p>
                  </div>
                  <Switch className="shrink-0" checked={roundPrices} onCheckedChange={setRoundPrices} />
                </div>
              </div>
            </div>

            {/* Row 3 — Default tax rate (full width) */}
            <div className="border-b border-slate-100">
              <div className="px-6 py-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-800">Default tax rate</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">When no rate is set on a service line.</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Input
                    value={defaultTaxRate}
                    onChange={(e) => setDefaultTaxRate(e.target.value)}
                    className="h-8 w-20 text-[13px] text-right border-slate-200"
                  />
                  <span className="text-[12px] text-slate-500">%</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end px-6 py-4 border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  if (!userId) return;
                  setSavingPricing(true);
                  try {
                    await updateFirmSettingsMut({
                      userId,
                      currency,
                      jurisdiction: jurisdiction as "ZA" | "US" | "UK" | "CA" | "AU" | "NZ",
                      showTaxInclusive,
                      roundPrices,
                      defaultTaxRate: parseFloat(defaultTaxRate) || 15,
                    });
                    toast.success("Pricing settings saved");
                  } catch { toast.error("Failed to save pricing settings"); }
                  finally { setSavingPricing(false); }
                }}
                disabled={savingPricing}
                className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ background: "#C8A96E" }}
              >
                {savingPricing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save pricing
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <><Header /><div className="p-6 space-y-4">
        <div className="h-8 w-80 bg-slate-100 animate-pulse rounded-lg mb-5" />
        <div className="h-64 w-full bg-slate-100 animate-pulse rounded-xl" />
      </div></>
    }>
      <SettingsPageInner />
    </Suspense>
  );
}
