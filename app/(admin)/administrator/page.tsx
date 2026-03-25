"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { formatDate, formatCurrency, getInitials, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import {
  Shield, Users, CheckCircle2, FileText, Building2, Package,
  Trash2, Activity, DollarSign, BarChart3, Loader2, Mail,
  TrendingUp, MoreHorizontal, UserPlus, CheckCircle, X,
  AlertCircle, Clock, Key, Settings, Eye, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

const ACCENT = "#C8A96E";
const NAVY  = "#243E63";

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  owner:       { label: "Owner",     dot: "#8b5cf6", bg: "bg-violet-50 border border-violet-200", text: "text-violet-700" },
  admin:       { label: "Admin",     dot: "#3b82f6", bg: "bg-blue-50 border border-blue-200",     text: "text-blue-700" },
  senior:      { label: "Senior",    dot: "#06b6d4", bg: "bg-cyan-50 border border-cyan-200",     text: "text-cyan-700" },
  staff:       { label: "Staff",     dot: "#10b981", bg: "bg-emerald-50 border border-emerald-200", text: "text-emerald-700" },
  "view-only": { label: "View Only", dot: "#94a3b8", bg: "bg-slate-50 border border-slate-200",   text: "text-slate-500" },
};

const PERMISSIONS_MATRIX = [
  { label: "Manage Users",       roles: ["owner", "admin"] },
  { label: "Manage Settings",    roles: ["owner", "admin"] },
  { label: "Create Proposals",   roles: ["owner", "admin", "senior", "staff"] },
  { label: "Approve Proposals",  roles: ["owner", "admin"] },
  { label: "Send Proposals",     roles: ["owner", "admin", "senior"] },
  { label: "Delete Proposals",   roles: ["owner", "admin"] },
  { label: "Manage Clients",     roles: ["owner", "admin", "senior", "staff"] },
  { label: "Manage Services",    roles: ["owner", "admin", "senior"] },
  { label: "View Financials",    roles: ["owner", "admin", "senior"] },
  { label: "Manage Letters",     roles: ["owner", "admin", "senior"] },
  { label: "Sign Letters",       roles: ["owner", "admin"] },
  { label: "View Reports",       roles: ["owner", "admin", "senior"] },
  { label: "Export Data",        roles: ["owner", "admin"] },
];

const AUDIT_LOG = [
  { id: 1,  icon: UserPlus,   color: "#10b981", bg: "bg-emerald-50", label: "Invited team member",  desc: "Sarah Nkosi invited James Botha as Admin",           time: "2 hours ago",   type: "user" },
  { id: 2,  icon: Key,        color: "#3b82f6", bg: "bg-blue-50",    label: "Role changed",         desc: "James Botha promoted Priya Pillay to Senior",         time: "5 hours ago",   type: "user" },
  { id: 3,  icon: Settings,   color: ACCENT,    bg: "bg-amber-50",   label: "Settings updated",     desc: "Sarah Nkosi updated firm billing settings",           time: "Yesterday",     type: "settings" },
  { id: 4,  icon: FileText,   color: NAVY,      bg: "bg-slate-100",  label: "Proposal sent",        desc: "Apex Accounting proposal #RA9482 sent to client",     time: "Yesterday",     type: "proposal" },
  { id: 5,  icon: CheckCircle,color: "#10b981", bg: "bg-emerald-50", label: "Proposal accepted",    desc: "DataSync Ltd. accepted proposal worth R48,000/yr",    time: "2 days ago",    type: "proposal" },
  { id: 6,  icon: UserPlus,   color: "#10b981", bg: "bg-emerald-50", label: "New user joined",      desc: "Themba Dlamini activated their account",               time: "3 days ago",    type: "user" },
  { id: 7,  icon: Key,        color: "#3b82f6", bg: "bg-blue-50",    label: "Role changed",         desc: "Sarah Nkosi set Liam Pretorius to View Only",         time: "4 days ago",    type: "user" },
  { id: 8,  icon: Settings,   color: ACCENT,    bg: "bg-amber-50",   label: "Branding updated",     desc: "Firm logo and brand colours updated",                 time: "5 days ago",    type: "settings" },
  { id: 9,  icon: Trash2,     color: "#ef4444", bg: "bg-red-50",     label: "Proposal deleted",     desc: "James Botha deleted draft proposal for Vega Media",   time: "1 week ago",    type: "proposal" },
  { id: 10, icon: FileText,   color: NAVY,      bg: "bg-slate-100",  label: "Template created",     desc: "Sarah Nkosi created new engagement letter template",  time: "1 week ago",    type: "settings" },
];

type ConvexProposal = {
  _id: Id<"proposals">;
  title: string;
  clientId: Id<"clients">;
  clientName: string;
  status: string;
  total: number;
  createdAt: number;
  netMonthlyFee?: number;
  oneOffFee?: number;
};

type ConvexClient = {
  _id: Id<"clients">;
  companyName: string;
  status: string;
};

/** Single row from `users.listUsers` — derived from Convex so it stays aligned with the query. */
type ConvexUser = FunctionReturnType<typeof api.users.listUsers>[number];
type MembershipStatus = ConvexUser["membershipStatus"];

const MEMBERSHIP_STATUS_BADGE: Record<
  MembershipStatus,
  { label: string; className: string }
> = {
  inactive: { label: "Inactive", className: "bg-slate-50 border border-slate-200 text-slate-500" },
  pending_invite: { label: "Pending", className: "bg-amber-50 border border-amber-200 text-amber-800" },
  invite_expired: { label: "Invite expired", className: "bg-orange-50 border border-orange-200 text-orange-800" },
  active: { label: "Active", className: "bg-emerald-50 border border-emerald-200 text-emerald-700" },
};

function buildActivityChart(proposals: ConvexProposal[]) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months.map((label, i) => {
    const inMonth = proposals.filter((p) => new Date(p.createdAt).getMonth() === i);
    return {
      label,
      created:  inMonth.length,
      accepted: inMonth.filter((p) => p.status === "accepted").length,
      acv:      inMonth.reduce((s, p) => s + ((p.netMonthlyFee ?? p.total) * 12), 0),
    };
  });
}

// ── Inner component ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const { user } = useNorthPactAuth();
  const router   = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "overview";

  const userId = user?.id as Id<"users"> | undefined;

  // Invite sheet
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [inviteName,  setInviteName]  = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting,    setInviting]    = useState(false);

  // User search
  const [userSearch, setUserSearch] = useState("");

  // ── Convex queries ──────────────────────────────────────────────────────
  const convexProposals = useQuery(api.proposals.listProposals, userId ? { userId } : "skip");
  const convexClients   = useQuery(api.clients.listClients,     userId ? { userId } : "skip");
  const convexServices  = useQuery(api.services.listServices,   userId ? { userId } : "skip");
  const convexUsers     = useQuery(api.users.listUsers,         userId ? { userId } : "skip");
  const firmSettings    = useQuery(api.firms.getFirmSettings,   userId ? { userId } : "skip");

  const updateUserRoleMutation    = useMutation(api.users.updateUserRole);
  const setUserDeactivatedMutation = useMutation(api.users.setUserDeactivated);
  const inviteUserMutation        = useMutation(api.users.inviteUser);

  const loading = convexProposals === undefined || convexClients === undefined || convexUsers === undefined;

  const proposals    = (convexProposals ?? []) as ConvexProposal[];
  const clients      = (convexClients ?? []) as ConvexClient[];
  const users: ConvexUser[] = convexUsers ?? [];
  const serviceCount = convexServices?.length ?? 0;

  async function changeRole(targetUserId: string, newRole: string) {
    if (!userId) return;
    const target = users.find((u) => u._id === targetUserId);
    try {
      const result = await updateUserRoleMutation({
        adminId: userId,
        targetUserId: targetUserId as Id<"users">,
        newRole: newRole as "admin" | "senior" | "staff" | "view-only",
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to update role");
        return;
      }
      toast.success(`${target?.name ?? "User"} is now ${ROLE_CONFIG[newRole]?.label ?? newRole}`);
    } catch {
      toast.error("Failed to update role");
    }
  }

  async function sendInvite() {
    if (!userId) return;
    const name  = inviteName.trim();
    const email = inviteEmail.trim().toLowerCase();
    if (!name)  { toast.error("Please enter a name"); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email"); return;
    }
    if (users.some((u) => u.email.toLowerCase() === email)) {
      toast.error("A user with this email already exists"); return;
    }
    setInviting(true);
    try {
      const result = await inviteUserMutation({
        inviterId: userId,
        email,
        name,
        role: "staff",
      });
      if (!result.success) {
        toast.error(result.error ?? "Failed to send invite");
        return;
      }
      toast.success(`We emailed an invite link to ${email}`);
      setInviteOpen(false);
      setInviteName(""); setInviteEmail("");
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalACV = useMemo(() =>
    proposals
      .filter((p) => ["accepted", "sent", "approved"].includes(p.status))
      .reduce((s, p) => s + (p.netMonthlyFee ?? p.total) * 12, 0),
    [proposals]
  );

  const activeProposals = useMemo(() =>
    proposals.filter((p) =>
      ["pending-approval", "approved", "sent", "viewed"].includes(p.status)
    ).length,
    [proposals]
  );

  const conversionRate = useMemo(() =>
    proposals.length > 0
      ? Math.round((proposals.filter((p) => p.status === "accepted").length / proposals.length) * 100)
      : 0,
    [proposals]
  );

  const activityChart   = useMemo(() => buildActivityChart(proposals), [proposals]);
  const recentProposals = useMemo(() =>
    [...proposals]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6),
    [proposals]
  );
  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c._id, c])),
    [clients]
  );

  const filteredUsers = users.filter((u) =>
    !userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  // ── Stats cards config ──────────────────────────────────────────────────────
  const joinedMemberCount = users.filter((u) => u.membershipStatus === "active").length;
  const pendingInviteCount = users.filter(
    (u) => u.membershipStatus === "pending_invite" || u.membershipStatus === "invite_expired"
  ).length;

  const STATS = loading ? null : [
    {
      label: "Team Members",
      sublabel: `${joinedMemberCount} joined${pendingInviteCount ? ` — ${pendingInviteCount} pending invite` : ""}`,
      value: String(users.length), icon: Users, iconBg: "bg-[#C8A96E]/10", iconColor: ACCENT,
    },
    {
      label: "Active Users",
      sublabel: "Joined workspace (signed in)",
      value: String(joinedMemberCount), icon: CheckCircle, iconBg: "bg-emerald-50", iconColor: "#10b981",
    },
    {
      label: "Total Proposals", sublabel: `${activeProposals} in progress`,
      value: String(proposals.length), icon: FileText, iconBg: `bg-[${NAVY}]/10`, iconColor: NAVY,
    },
    {
      label: "Total Clients", sublabel: `${clients.filter(c => c.status !== "archived").length} active`,
      value: String(clients.length), icon: Building2, iconBg: "bg-[#C8A96E]/10", iconColor: ACCENT,
    },
    {
      label: "Firm ACV", sublabel: "Pipeline value",
      value: formatCurrency(totalACV), icon: DollarSign, iconBg: `bg-[${NAVY}]/10`, iconColor: NAVY,
    },
    {
      label: "Win Rate", sublabel: "Accepted vs total",
      value: `${conversionRate}%`, icon: TrendingUp, iconBg: "bg-emerald-50", iconColor: "#10b981",
    },
  ];

  const PROPOSAL_STATUS: Record<string, { label: string; bg: string; text: string }> = {
    draft:              { label: "Draft",    bg: "bg-slate-50 border border-slate-200",   text: "text-slate-500" },
    "pending-approval": { label: "Pending",  bg: "bg-amber-50 border border-amber-200",   text: "text-amber-700" },
    approved:           { label: "Approved", bg: "bg-blue-50 border border-blue-200",     text: "text-blue-700" },
    sent:               { label: "Live",     bg: "bg-blue-50 border border-blue-200",     text: "text-blue-700" },
    viewed:             { label: "Live",     bg: "bg-blue-50 border border-blue-200",     text: "text-blue-700" },
    accepted:           { label: "Won",      bg: "bg-emerald-50 border border-emerald-200", text: "text-emerald-700" },
    rejected:           { label: "Lost",     bg: "bg-red-50 border border-red-200",       text: "text-red-700" },
    expired:            { label: "Expired",  bg: "bg-slate-50 border border-slate-200",   text: "text-slate-400" },
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-6 space-y-6 max-w-[1600px]">

      {/* ── Stats Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-slate-100 rounded-xl p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <Skeleton className="w-8 h-8 rounded-lg" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            ))
          : STATS!.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="bg-white border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", card.iconBg)}>
                      <Icon className="h-[15px] w-[15px]" style={{ color: card.iconColor }} />
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 leading-tight">{card.label}</p>
                  </div>
                  <p className="text-[24px] font-bold text-slate-900 leading-none tabular-nums mb-1">
                    {card.value}
                  </p>
                  <p className="text-[10px] text-slate-400">{card.sublabel}</p>
                </div>
              );
            })
        }
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-5">

          {/* Firm Info */}
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[14px] font-semibold text-slate-900">Firm Information</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Registered details and workspace settings</p>
            </div>
            <div className="p-5">
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {[
                    { label: "Firm Name",         value: firmSettings?.name ?? "—" },
                    { label: "VAT Number",         value: firmSettings?.vatNumber || "—" },
                    { label: "Currency",           value: firmSettings?.currency ?? "ZAR" },
                    { label: "Jurisdiction",       value: firmSettings?.jurisdiction ?? "—" },
                    { label: "Billing Email",      value: firmSettings?.billingEmail ?? "—" },
                    { label: "Proposal Prefix",    value: firmSettings?.proposalNumberPrefix ?? "PROP-" },
                    { label: "Service Templates",  value: `${serviceCount}` },
                    { label: "VAT Registered",     value: firmSettings?.vatRegistered ? "Yes" : "No" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-0.5">{label}</p>
                      <p className="text-[13px] font-medium text-slate-900 truncate">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activity Chart */}
          <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[14px] font-semibold text-slate-900">Proposal Activity</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Proposals created and accepted per month (2025)</p>
            </div>
            <div className="p-5">
              {loading ? (
                <Skeleton className="h-52 w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={activityChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="aCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={ACCENT}  stopOpacity={0.2} />
                        <stop offset="100%" stopColor={ACCENT}  stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="aAccepted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} dy={6} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} width={28} allowDecimals={false} />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                    />
                    <Area type="monotone" dataKey="created"  stroke={ACCENT}    strokeWidth={2} fill="url(#aCreated)"  name="Created"  dot={false} activeDot={{ r: 4, fill: ACCENT, stroke: "#fff", strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="accepted" stroke="#10b981" strokeWidth={2} fill="url(#aAccepted)" name="Accepted" dot={false} activeDot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 2-col: Recent Proposals + Team Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Recent Proposals */}
            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <p className="text-[14px] font-semibold text-slate-900">Recent Proposals</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Latest activity across the firm</p>
                </div>
                <button
                  onClick={() => router.push("/proposals")}
                  className="flex items-center gap-1 text-[12px] font-semibold hover:opacity-80 transition-opacity"
                  style={{ color: ACCENT }}
                >
                  View All <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              {loading ? (
                <div className="divide-y divide-slate-50">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-36" />
                        <Skeleton className="h-2.5 w-24" />
                      </div>
                      <Skeleton className="h-5 w-14 rounded" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  ))}
                </div>
              ) : recentProposals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-8 w-8 text-slate-200 mb-2" />
                  <p className="text-[13px] text-slate-400">No proposals yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {recentProposals.map((p, i) => {
                    const cfg    = PROPOSAL_STATUS[p.status] ?? PROPOSAL_STATUS.draft;
                    const client = clientMap[p.clientId];
                    const acv    = (p.netMonthlyFee ?? p.total) * 12;
                    return (
                      <div key={`rp-${p._id}-${i}`} className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[#243E63]/8">
                          <FileText className="h-3.5 w-3.5" style={{ color: NAVY }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-800 truncate">{p.title}</p>
                          <p className="text-[11px] text-slate-400">{client?.companyName ?? p.clientName ?? "—"}</p>
                        </div>
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium shrink-0", cfg.bg, cfg.text)}>
                          {cfg.label}
                        </span>
                        <p className="text-[11px] font-semibold text-slate-700 shrink-0 tabular-nums">
                          {formatCurrency(acv)}/yr
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Team Breakdown */}
            <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-[14px] font-semibold text-slate-900">Team Breakdown</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Users by role and platform metrics</p>
              </div>
              <div className="p-5 space-y-3">
                {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
                  const count = users.filter((u) => u.role === role).length;
                  const pct   = users.length > 0 ? (count / users.length) * 100 : 0;
                  return (
                    <div key={role} className="flex items-center gap-3">
                      <span className={cn("inline-flex text-[11px] px-2.5 py-0.5 rounded-full font-medium shrink-0 w-[84px] justify-center", cfg.bg, cfg.text)}>
                        {cfg.label}
                      </span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: cfg.dot }}
                        />
                      </div>
                      <span className="text-[12px] font-semibold text-slate-700 w-4 text-right tabular-nums">{count}</span>
                    </div>
                  );
                })}

                <div className="pt-4 mt-1 border-t border-slate-100 space-y-2.5">
                  {[
                    { label: "Service Templates", value: serviceCount, icon: Package,   color: NAVY },
                    { label: "Active Proposals",  value: activeProposals, icon: Activity, color: ACCENT },
                    { label: "Total Clients",     value: clients.length, icon: Building2, color: "#10b981" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-slate-50">
                          <Icon className="h-3 w-3" style={{ color }} />
                        </div>
                        <span className="text-[12px] text-slate-500">{label}</span>
                      </div>
                      <span className="text-[13px] font-bold text-slate-900 tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Users ────────────────────────────────────────────────────────── */}
      {activeTab === "users" && (
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
            <div>
              <p className="text-[14px] font-semibold text-slate-900">Team Members</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Manage user roles and access levels</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Search */}
              <div className="relative hidden sm:block">
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users…"
                  className="h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white w-44"
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </div>
              {/* Count badge */}
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-[12px] font-medium text-slate-600">
                {users.length} members
              </span>
              {/* Invite button */}
              <button
                onClick={() => setInviteOpen(true)}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                style={{ background: ACCENT }}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Invite User
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[32px_220px_1fr_130px_112px_110px_44px] px-5 py-2.5 border-b border-slate-50 bg-slate-50/60 gap-3">
            {["#", "User", "Email", "Role", "Status", "Joined", ""].map((h, i) => (
              <span key={i} className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400 whitespace-nowrap">{h}</span>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            <div className="divide-y divide-slate-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[32px_220px_1fr_130px_112px_110px_44px] px-5 py-4 gap-3 items-center">
                  <Skeleton className="h-3 w-4" />
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-6 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredUsers.map((u, idx) => {
                const roleCfg       = ROLE_CONFIG[u.role] ?? ROLE_CONFIG.staff;
                const isCurrentUser = u._id === user?.id;
                const isActive      = !u.deactivatedAt;
                const statusBadge   = MEMBERSHIP_STATUS_BADGE[u.membershipStatus] ?? MEMBERSHIP_STATUS_BADGE.active;
                return (
                  <div
                    key={u._id}
                    className={cn(
                      "grid grid-cols-[32px_220px_1fr_130px_112px_110px_44px] px-5 py-3.5 gap-3 items-center hover:bg-slate-50/60 transition-colors",
                      isCurrentUser && "bg-[#C8A96E]/[0.03]"
                    )}
                  >
                    {/* # */}
                    <span className="text-[11px] font-medium text-slate-300 tabular-nums">{idx + 1}</span>

                    {/* User */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-[#243E63] shrink-0 select-none"
                        style={{ background: "#C8A96E" }}
                      >
                        {getInitials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">{u.name}</p>
                        {isCurrentUser && (
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: ACCENT }}>You</span>
                        )}
                      </div>
                    </div>

                    {/* Email */}
                    <span className="text-[12px] text-slate-500 truncate">{u.email}</span>

                    {/* Role */}
                    {isCurrentUser || u.role === "owner" ? (
                      <span className={cn("inline-flex text-[11px] px-2.5 py-0.5 rounded-full font-medium", roleCfg.bg, roleCfg.text)}>
                        {roleCfg.label}
                      </span>
                    ) : (
                      <Select
                        value={u.role}
                        onValueChange={(v) => changeRole(u._id, v)}
                        disabled={user?.role !== "owner" && u.role === "admin"}
                      >
                        <SelectTrigger className="h-7 w-[120px] text-[11px] border-slate-200 bg-white">
                          <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", roleCfg.bg, roleCfg.text)}>
                            {roleCfg.label}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {user?.role === "owner" && <SelectItem value="admin">Admin</SelectItem>}
                          <SelectItem value="senior">Senior</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="view-only">View Only</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    {/* Status */}
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium max-w-[7.5rem] truncate",
                        statusBadge.className
                      )}
                      title={statusBadge.label}
                    >
                      {statusBadge.label}
                    </span>

                    {/* Joined */}
                    <span className="text-[12px] text-slate-500">{formatDate(new Date(u.createdAt).toISOString())}</span>

                    {/* Actions */}
                    {!isCurrentUser && u.role !== "owner" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mx-auto">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 text-[13px]">
                          <DropdownMenuItem
                            onClick={async () => {
                              if (!userId) return;
                              try {
                                await setUserDeactivatedMutation({
                                  adminId: userId,
                                  targetUserId: u._id,
                                  deactivated: isActive,
                                });
                                toast.success(`${u.name} ${isActive ? "deactivated" : "activated"}`);
                              } catch {
                                toast.error("Failed to update user");
                              }
                            }}
                          >
                            {isActive ? (
                              <><X className="h-3.5 w-3.5 mr-2 text-slate-400" />Deactivate</>
                            ) : (
                              <><CheckCircle className="h-3.5 w-3.5 mr-2 text-emerald-500" />Activate</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => toast.error("Cannot remove users in this environment")}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Remove User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="py-12 text-center">
                  <Users className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-[13px] text-slate-400">No users match your search</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Permissions ──────────────────────────────────────────────────── */}
      {activeTab === "permissions" && (
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-[14px] font-semibold text-slate-900">Permissions Matrix</p>
            <p className="text-[11px] text-slate-400 mt-0.5">What each role can do across the platform</p>
          </div>

          <div className="overflow-x-auto">
            {/* Header */}
            <div className="grid grid-cols-[240px_repeat(5,1fr)] px-5 py-3 border-b border-slate-100 bg-slate-50/60 min-w-[640px]">
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400">Permission</span>
              {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
                <div key={role} className="flex justify-center">
                  <span className={cn("inline-flex text-[10px] px-2.5 py-0.5 rounded-full font-medium", cfg.bg, cfg.text)}>
                    {cfg.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-50 min-w-[640px]">
              {PERMISSIONS_MATRIX.map(({ label, roles }) => (
                <div key={label} className="grid grid-cols-[240px_repeat(5,1fr)] px-5 py-3.5 items-center hover:bg-slate-50/40 transition-colors">
                  <span className="text-[13px] font-medium text-slate-700">{label}</span>
                  {Object.keys(ROLE_CONFIG).map((role) => (
                    <div key={role} className="flex justify-center">
                      {roles.includes(role) ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <span className="text-slate-200 text-[14px] font-medium">—</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Audit Log ────────────────────────────────────────────────────── */}
      {activeTab === "audit" && (
        <div className="bg-white border border-slate-100 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <p className="text-[14px] font-semibold text-slate-900">Audit Log</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Recent system and user activity</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-[12px] font-medium text-slate-600">
              Last 30 days
            </span>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[44px_1fr_130px] px-5 py-2.5 border-b border-slate-50 bg-slate-50/60 gap-4">
            {["Event", "Description", "Time"].map((h) => (
              <span key={h} className="text-[10px] font-bold tracking-[0.14em] uppercase text-slate-400">{h}</span>
            ))}
          </div>

          <div className="divide-y divide-slate-50">
            {AUDIT_LOG.map((entry) => {
              const Icon = entry.icon;
              return (
                <div key={entry.id} className="grid grid-cols-[44px_1fr_130px] px-5 py-4 gap-4 items-start hover:bg-slate-50/60 transition-colors">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", entry.bg)}>
                    <Icon className="h-3.5 w-3.5" style={{ color: entry.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700 leading-tight">{entry.label}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5 leading-tight">{entry.desc}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5">
                    <Clock className="h-3 w-3 shrink-0" />
                    {entry.time}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Invite Sheet ─────────────────────────────────────────────────── */}
      <Sheet open={inviteOpen} onOpenChange={(v) => !v && setInviteOpen(false)}>
        <SheetContent side="right" hideClose className="w-full sm:max-w-none sm:w-[460px] p-0 border-l border-slate-200 shadow-2xl flex flex-col bg-white">
          <SheetTitle className="sr-only">Invite Team Member</SheetTitle>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex-shrink-0 border-b-2 border-slate-200 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="h-14 w-14 rounded-xl border-2 border-slate-200 flex items-center justify-center shrink-0" style={{ background: `${ACCENT}14` }}>
                    <UserPlus className="h-7 w-7" style={{ color: ACCENT }} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-slate-900 leading-tight">Invite Team Member</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Send an invite to join your workspace</p>
                  </div>
                </div>
                <button
                  onClick={() => setInviteOpen(false)}
                  disabled={inviting}
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="invite-name" className="text-[13px]">Full name <span className="text-red-500">*</span></Label>
                <input
                  id="invite-name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Sarah Mitchell"
                  disabled={inviting}
                  onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-[13px]">Work email <span className="text-red-500">*</span></Label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="sarah@yourfirm.co.za"
                  disabled={inviting}
                  onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C8A96E] transition-colors bg-white"
                />
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  They will be added as <span className="font-semibold text-slate-700">Staff</span> and can be promoted once they join.
                </p>
              </div>
            </div>

            {/* Footer */}
            <SheetFooter className="flex-shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50 gap-2">
              <button
                onClick={() => setInviteOpen(false)}
                disabled={inviting}
                className="h-9 px-4 rounded-lg border border-red-600 text-red-600 text-[13px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendInvite}
                disabled={inviting}
                className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1.5"
                style={{ background: ACCENT }}
              >
                {inviting
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</>
                  : <><Mail className="h-3.5 w-3.5" />Send Invite</>
                }
              </button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-xl p-4">
              <Skeleton className="h-8 w-8 rounded-lg mb-3" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    }>
      <AdminDashboard />
    </Suspense>
  );
}
