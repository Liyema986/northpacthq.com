// ─── Core Domain Types — NorthPact Prototype ──────────────────────────────────

// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = "owner" | "admin" | "senior" | "staff" | "view-only";

export type ProposalStatus =
  | "draft"
  | "pending-approval"
  | "approved"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired";

export type BillingCategory = "monthly" | "yearly" | "onceoff";

export type PricingMethod =
  | "fixed_monthly"
  | "fixed_annual"
  | "fixed_onceoff"
  | "hourly"
  | "per_transaction"
  | "per_employee"
  | "per_payslip"
  | "per_invoice"
  | "per_bank_account"
  | "per_vat_submission"
  | "per_entity"
  | "quantity_x_unit"
  | "tiered"
  | "manual_override";

export type EntityPricingMode =
  | "single_price"
  | "price_per_entity"
  | "custom_price_by_entity";

export type EntityAssignmentMode = "all_entities" | "selected_entities";

export type ClientGroupMode = "single_entity" | "client_group";

export type TimeMethod =
  | "hourly"
  | "volume_based"
  | "fixed_hours"
  | "fixed_minutes"
  | "quantity_x_hours"
  | "quantity_x_minutes";

export type Frequency =
  | "monthly"
  | "bi_monthly"
  | "quarterly"
  | "every_4_months"
  | "semi_annually"
  | "annually"
  | "once_off"
  | "on_demand";

export type PaymentFrequency =
  | "as_delivered"
  | "monthly"
  | "bi_monthly"
  | "quarterly"
  | "6_monthly"
  | "annually";

export type EntityType =
  | "individual"
  | "company"
  | "close_corporation"
  | "trust"
  | "partnership"
  | "non_profit"
  | "other";

export type WorkPlanStatus =
  | "upcoming"
  | "in_progress"
  | "completed"
  | "overdue";

export type Permission =
  | "proposals.create"
  | "proposals.edit"
  | "proposals.delete"
  | "proposals.send"
  | "proposals.approve"
  | "clients.create"
  | "clients.edit"
  | "clients.delete"
  | "services.manage"
  | "settings.manage"
  | "users.manage"
  | "reports.view"
  | "admin.access";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface MockUser {
  id: string;
  firmId: string;
  email: string;
  password: string; // mock only — plain text for prototype
  name: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthSession {
  user: MockUser;
  token: string;
}

// ─── Firm ─────────────────────────────────────────────────────────────────────

export interface Firm {
  id: string;
  name: string;
  email: string;
  phone: string;
  physicalAddress: string;
  registrationNumber?: string;
  taxNumber?: string;
  vatNumber?: string;
  defaultTaxRate: number;
  currency: string;
  brandColors: { primary: string; secondary: string };
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export interface ClientGroup {
  id: string;
  firmId: string;
  name: string;
  groupNumber?: string;
  industry?: string;
  notes?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Entity {
  id: string;
  clientGroupId: string;
  firmId: string;
  name: string;
  entityType: EntityType;
  registrationNumber?: string;
  taxNumber?: string;
  vatNumber?: string;
  tradingName?: string;
  xeroContactId?: string;
  financialYearEnd?: string; // "MM-DD" format
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContactPerson {
  id: string;
  clientGroupId: string;
  firmId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

// Hydrated client group for display
export interface ClientGroupWithDetails extends ClientGroup {
  entities: Entity[];
  contacts: ContactPerson[];
  proposalCount: number;
}

// ─── Services ─────────────────────────────────────────────────────────────────

export interface ServiceCategory {
  id: string;
  firmId: string;
  name: string;
  icon: string;
  colour: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TierLevel {
  from: number;
  to: number | null; // null = unlimited
  price: number;
}

export interface ServiceTemplate {
  id: string;
  firmId: string;
  categoryId: string;
  name: string;
  description?: string;
  billingCategory: BillingCategory;
  pricingMethod: PricingMethod;
  unitPrice: number;
  quantity: number;
  discount: number;
  taxRate: number;
  frequency: Frequency;
  entityPricingMode: EntityPricingMode;
  // Volume fields
  transactionCount?: number;
  employeeCount?: number;
  payslipCount?: number;
  invoiceCount?: number;
  bankAccountCount?: number;
  vatSubmissionCount?: number;
  entityCount?: number;
  // Time fields
  timeMethod: TimeMethod;
  /** For fixed time: primary duration in hours. For quantity_x_hours: hours per unit. */
  timeInputHours?: number;
  /**
   * Meaning depends on context: for volume / per-unit pricing, minutes per unit (e.g. per employee).
   * For fixed_hours (non-volume), **total minutes** = timeInputHours×60, kept in sync in the UI.
   */
  timeInputMinutes?: number;
  timeQuantity?: number;
  minutesPerUnit?: number;
  // Tiered
  tiers?: TierLevel[];
  // Manual override
  manualPrice?: number;
  // Meta
  isActive: boolean;
  isOptional: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceTemplateWithCategory extends ServiceTemplate {
  category: ServiceCategory;
}

// ─── Proposals ────────────────────────────────────────────────────────────────

export interface ProposalItem {
  id: string;
  proposalId: string;
  serviceTemplateId?: string;
  firmId: string;
  // Copy of service template fields (editable per-proposal)
  name: string;
  description?: string;
  billingCategory: BillingCategory;
  pricingMethod: PricingMethod;
  unitPrice: number;
  quantity: number;
  discount: number;
  taxRate: number;
  frequency: Frequency;
  entityPricingMode: EntityPricingMode;
  assignedEntityIds: string[];
  customEntityPrices: Record<string, number>;
  // Volume fields
  transactionCount?: number;
  employeeCount?: number;
  payslipCount?: number;
  invoiceCount?: number;
  bankAccountCount?: number;
  vatSubmissionCount?: number;
  entityCount?: number;
  // Time fields
  timeMethod: TimeMethod;
  /** For fixed time: primary duration in hours. For quantity_x_hours: hours per unit. */
  timeInputHours?: number;
  /**
   * Meaning depends on context: for volume / per-unit pricing, minutes per unit (e.g. per employee).
   * For fixed_hours (non-volume), **total minutes** = timeInputHours×60, kept in sync in the UI.
   */
  timeInputMinutes?: number;
  timeQuantity?: number;
  minutesPerUnit?: number;
  // Tiered
  tiers?: TierLevel[];
  // Manual override
  manualPrice?: number;
  // Builder-specific extra fields (v2 compat)
  entityAssignmentMode?: EntityAssignmentMode;
  pricingDriver?: string;
  duePattern?: string;
  itemNotes?: string;
  /** Expected delivery / commitment date (esp. yearly services) for cash-flow planning */
  commitmentDate?: string;
  /** Work planning: YYYY-MM when this line’s work is scheduled (firm calendar) */
  scheduledWorkMonth?: string;
  /** User’s selected values for each calculation layer (calc ID → selected numeric value) */
  calculationInputs?: Record<string, number>;
  /** Tracks which pricing option label was selected (for reliable dropdown matching) */
  selectedPricingLabel?: string;
  /** Per-service payment schedule (overrides proposal-level default when set) */
  paymentSchedule?: PaymentFrequency;
  /** Pricing version: undefined = legacy (yearly items store monthly rate × 12), 2 = new (all items store price-per-cycle) */
  pricingVersion?: number;
  // Computed (stored for display)
  baseAmount: number;
  subtotal: number;
  totalPrice: number;
  estimatedHours: number;
  isOptional: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Proposal {
  id: string;
  firmId: string;
  clientGroupId: string;
  attentionToContactId?: string;
  proposalNumber: string;
  title: string;
  status: ProposalStatus;
  paymentFrequency: PaymentFrequency;
  commencementDate?: string;
  expiryDate?: string;
  notes?: string;
  introText?: string;
  termsText?: string;
  // Computed summary (denormalised)
  monthlyTotal: number;
  yearlyTotal: number;
  onceoffTotal: number;
  totalHours: number;
  acv: number;
  year1Total: number;
  // Approval
  approvalRequestedAt?: string;
  approvalRequestedById?: string;
  approvedAt?: string;
  approvedById?: string;
  // Sending
  sentAt?: string;
  sentById?: string;
  viewedAt?: string;
  // Client response
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  // Token for client portal
  portalToken?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalWithDetails extends Proposal {
  clientGroup: ClientGroup;
  entities: Entity[];
  contacts: ContactPerson[];
  attentionTo?: ContactPerson;
  items: ProposalItem[];
}

// ─── Proposal Summary (computed) ─────────────────────────────────────────────

export interface ProposalSummary {
  monthlyTotal: number;
  yearlyTotal: number;
  onceoffTotal: number;
  acv: number;
  year1Total: number;
  totalHours: number;
  effectiveRate: number;
  perCycle: number;
}

// ─── Cash Flow ────────────────────────────────────────────────────────────────

export interface CashFlowMonth {
  month: number; // 1–12
  label: string; // "Jan", "Feb", etc.
  monthly: number;
  yearly: number;
  onceoff: number;
  total: number;
}

// ─── Work Planning ────────────────────────────────────────────────────────────

export interface WorkPlanEntry {
  id: string;
  firmId: string;
  proposalId: string;
  proposalItemId: string;
  clientGroupId: string;
  serviceName: string;
  clientName: string;
  billingCategory: BillingCategory;
  frequency: Frequency;
  scheduledMonth: string; // "YYYY-MM"
  estimatedHours: number;
  assignedUserId?: string;
  status: WorkPlanStatus;
  notes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Set when loaded from Convex (`manual` | `proposal`) */
  source?: string;
}

// ─── Engagement Letters ───────────────────────────────────────────────────────

export interface EngagementParagraph {
  id: string;
  firmId: string;
  serviceTemplateId?: string; // null = standard/firm-wide
  type: "standard" | "service_specific";
  title: string;
  content: string; // HTML
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EngagementLetter {
  id: string;
  firmId: string;
  proposalId: string;
  clientGroupId: string;
  name: string;
  introduction: string;
  scope: string; // HTML
  status: "draft" | "sent" | "signed" | "rejected";
  sentAt?: string;
  signedAt?: string;
  signingToken?: string;
  principalId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Principals ───────────────────────────────────────────────────────────────

export interface Principal {
  id: string;
  firmId: string;
  name: string;
  qualification?: string;
  roles: ("director" | "principal" | "statutory-auditor")[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface FirmSettings {
  firmId: string;
  defaultTaxRate: number;
  defaultPaymentFrequency: PaymentFrequency;
  defaultExpiryDays: number;
  proposalNumberPrefix: string;
  proposalNumberCounter: number;
  requireApproval: boolean;
  approverRoles: UserRole[];
  updatedAt: string;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalProposals: number;
  totalClients: number;
  activeProposals: number;
  acceptedThisMonth: number;
  totalACV: number;
  pendingApproval: number;
  sentProposals: number;
  conversionRate: number;
  recentProposals: Proposal[];
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type:
    | "proposal_created"
    | "proposal_sent"
    | "proposal_accepted"
    | "proposal_rejected"
    | "client_added"
    | "service_added";
  description: string;
  entityId: string;
  entityName: string;
  userId: string;
  userName: string;
  createdAt: string;
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    "proposals.create",
    "proposals.edit",
    "proposals.delete",
    "proposals.send",
    "proposals.approve",
    "clients.create",
    "clients.edit",
    "clients.delete",
    "services.manage",
    "settings.manage",
    "users.manage",
    "reports.view",
    "admin.access",
  ],
  admin: [
    "proposals.create",
    "proposals.edit",
    "proposals.delete",
    "proposals.send",
    "proposals.approve",
    "clients.create",
    "clients.edit",
    "clients.delete",
    "services.manage",
    "settings.manage",
    "users.manage",
    "reports.view",
  ],
  senior: [
    "proposals.create",
    "proposals.edit",
    "proposals.send",
    "clients.create",
    "clients.edit",
    "services.manage",
    "reports.view",
  ],
  staff: [
    "proposals.create",
    "proposals.edit",
    "clients.create",
    "clients.edit",
    "reports.view",
  ],
  "view-only": ["reports.view"],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

// ─── Proposal Builder Types ───────────────────────────────────────────────────

export interface ProposalBuilderEntity {
  id: string;
  name: string;
  /** Legal form — prefer `EntityType` values from the builder dropdown */
  entityType: string;
  registrationNumber: string;
  taxNumber: string;
  vatNumber: string;
  notes: string;
  /** Annual turnover band (pricing / scoping; persisted with proposal entities on save) */
  revenueRange?: string;
  /** SARS / class band for income tax (optional) */
  incomeTaxRange?: string;
  /** Financial year-end month, e.g. "28 February" */
  financialYearEndMonth?: string;
  /** Financial year-end year, e.g. "2026" */
  financialYearEndYear?: string;
}

/** Contact row for Proposal Builder picker (grouped: organisations vs individuals). */
export interface ProposalBuilderContactOption {
  _id: string;
  companyName: string;
  contactName: string;
  email: string;
  contactType?: "organisation" | "individual";
  xeroContactId?: string;
  taxNumber?: string;
  companyNumber?: string;
  notes?: string;
}

export interface ProposalBuilderClientGroup {
  name: string;
  groupType: string;
  notes: string;
  /** When populated from Xero Contact Groups API */
  xeroContactGroupId?: string;
}

export interface ProposalEntitySummary {
  entityId: string;
  entityName: string;
  monthlyTotal: number;
  yearlyTotal: number;
  onceoffTotal: number;
  annualContractValue: number;
  year1Total: number;
  totalHours: number;
  isShared: boolean;
}

export interface ProposalBuilderSummary {
  itemCount: number;
  monthlyTotal: number;
  yearlyTotal: number;
  onceoffTotal: number;
  annualContractValue: number;
  year1Total: number;
  totalHours: number;
  perCycle: number;
  entityTotals: ProposalEntitySummary[];
}

export const CATEGORY_LABELS: Record<BillingCategory, string> = {
  monthly: "Recurring",
  yearly: "Annual",
  onceoff: "Once-off",
};

export const PRICING_METHOD_LABELS: Record<PricingMethod, string> = {
  fixed_monthly:      "Fixed Monthly",
  fixed_annual:       "Fixed Annual",
  fixed_onceoff:      "Once-off",
  hourly:             "Hourly",
  per_transaction:    "Per Transaction",
  per_employee:       "Per Employee",
  per_payslip:        "Per Payslip",
  per_invoice:        "Per Invoice",
  per_bank_account:   "Per Bank Account",
  per_vat_submission: "Per VAT Submission",
  per_entity:         "Per Entity",
  quantity_x_unit:    "Qty × Unit",
  tiered:             "Tiered",
  manual_override:    "Manual Override",
};

// ─── Service Billing & Planning Constants ────────────────────────────────────

/** Number of delivery cycles per year for each work frequency. */
export const RECURRENCE_MULTIPLIER: Record<Frequency, number> = {
  monthly:         12,
  bi_monthly:       6,
  quarterly:        4,
  every_4_months:   3,
  semi_annually:    2,
  annually:         1,
  once_off:         1,
  on_demand:        0,
};

export const FREQUENCY_DISPLAY_LABELS: Record<Frequency, string> = {
  monthly:         "Monthly",
  bi_monthly:      "Bi-monthly",
  quarterly:       "Quarterly",
  every_4_months:  "Every 4 months",
  semi_annually:   "Bi-annually",
  annually:        "Annually",
  once_off:        "Once-off",
  on_demand:       "On demand",
};

export const PAYMENT_SCHEDULE_LABELS: Record<PaymentFrequency, string> = {
  as_delivered: "As Delivered",
  monthly:      "Monthly",
  bi_monthly:   "Bi-monthly",
  quarterly:    "Quarterly",
  "6_monthly":  "6-monthly",
  annually:     "Annually",
};

/** Number of invoices per year for each payment schedule. 0 = derives from work frequency. */
export const PAYMENT_PERIOD_COUNT: Record<PaymentFrequency, number> = {
  monthly:      12,
  bi_monthly:    6,
  quarterly:     4,
  "6_monthly":   2,
  annually:      1,
  as_delivered:  0,
};

/** Short suffix labels for per-cycle price display (e.g. "/mo", "/qtr"). */
export const FREQUENCY_PRICE_SUFFIX: Record<Frequency, string> = {
  monthly:        "/mo",
  bi_monthly:     "/2mo",
  quarterly:      "/qtr",
  every_4_months: "/4mo",
  semi_annually:  "/6mo",
  annually:       "/yr",
  once_off:       "",
  on_demand:      "",
};

