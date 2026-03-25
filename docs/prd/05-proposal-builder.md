# NorthPact PRD — Proposal Builder (§6.3)

The proposal builder is the **core workspace** of NorthPact. It uses a three-panel layout for maximum productivity.

---

## 1. Layout

| Panel | Width | Content |
|-------|-------|---------|
| **Left Panel** | 320px (collapsible) | Service Library: searchable, filterable list of draggable service templates |
| **Centre Panel** | Flexible | Proposal workspace: group header, entity setup, service drop zones by billing category |
| **Right Panel** | 320px (collapsible) | Live Summary: real-time totals, per-entity breakdowns, cash flow preview |

```
┌──────────────┬─────────────────────────────┬──────────────────┐
│              │                             │                  │
│  SERVICE     │      PROPOSAL CANVAS        │   LIVE SUMMARY   │
│  LIBRARY     │                             │                  │
│              │  ┌─ Group Header ──────────┐│ Per-Entity:      │
│  [Search]    │  │ Name, Type, AttentionTo ││  Entity A: R...  │
│  [Filters]   │  └─────────────────────────┘│  Entity B: R...  │
│              │                             │  Shared: R...    │
│  ▸ Bookkeep  │  ┌─ Monthly (blue) ────────┐│                  │
│    - Monthly │  │ ┌─────────────────────┐ ││ Monthly: R...    │
│    - Catchup │  │ │ Bookkeeping  R2,160 │ ││ Yearly: R...     │
│              │  │ │ [Configure] [✕]     │ ││ Once-off: R...   │
│  ▸ Payroll   │  │ └─────────────────────┘ ││                  │
│    - Process │  │ ┌─────────────────────┐ ││ ACV: R...        │
│    - EMP201  │  │ │ Payroll    R4,680   │ ││ Year 1: R...     │
│              │  │ └─────────────────────┘ ││ Per-cycle: R...  │
│  ▸ Tax       │  └─────────────────────────┘│                  │
│    - VAT     │                             │ Hours: ...       │
│    - Income  │  ┌─ Yearly (violet) ───────┐│ Rate: R.../hr    │
│              │  │                         ││                  │
│  ▸ Advisory  │  └─────────────────────────┘│ [Cash Flow ▼]   │
│              │                             │ ┌──────────────┐ │
│  ▸ Complianc │  ┌─ Once-off (amber) ──────┐│ │ Bar Chart   │ │
│              │  │                         ││ │ 12 months   │ │
│  ▸ Setup     │  └─────────────────────────┘│ └──────────────┘ │
│              │                             │                  │
│  ▸ Once-off  │  [+ Add Custom Service]     │ Frequency: [▼]   │
│              │                             │                  │
└──────────────┴─────────────────────────────┴──────────────────┘
```

---

## 2. Proposal Creation Flow

1. Select or create a client group
2. Toggle entities on/off for this proposal
3. Select attention-to contact person
4. Drag services from library into billing category drop zones
5. Configure each service via the Service Config Drawer
6. Review live summary and per-entity breakdowns
7. Select payment frequency
8. Save as draft or send to client

---

## 3. Client Group Mode Toggle

| Mode | Behaviour |
|------|-----------|
| **Single Entity** | One entity form, no "Add Entity" button, simplified header. Used for sole proprietors or single-company clients. |
| **Client Group** | Group-level metadata (name, type, notes) plus multiple collapsible entity cards. Used for family groups, holding structures, etc. |

**Switching from Client Group to Single Entity** retains only the first entity and cleans up all multi-entity service assignments.

---

## 4. Service Drop Zones

The centre panel has three colour-coded drop zones:

| Zone | Colour | Purpose |
|------|--------|---------|
| **Monthly** | Blue (`--category-monthly`) | Services billed monthly (bookkeeping, payroll, retainers) |
| **Yearly** | Violet (`--category-yearly`) | Services billed annually (AFS, tax returns, company secretarial) |
| **Once-off** | Amber (`--category-onceoff`) | One-time services (setup, CIPC changes, cleanup) |

### Drag Behaviours

| Action | Behaviour |
|--------|-----------|
| Drag from library → drop zone | Creates a new ProposalItem with template defaults |
| Drag between categories | Moves the item and updates its billing category |
| Drag within a category | Reorders items |
| New item dropped | Auto-opens the Service Config Drawer |

**DnD Library:** `@hello-pangea/dnd` (accessible fork of react-beautiful-dnd)

---

## 5. ProposalItem (Service Instance) Data Model

Each service dragged into a proposal becomes a ProposalItem:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique instance identifier |
| `proposalId` | UUID (FK) | Parent proposal reference |
| `serviceTemplateId` | UUID (FK) | Source template reference |
| `name` | string | Editable service name (defaults from template) |
| `description` | string | Editable description |
| `category` | enum | `monthly` \| `yearly` \| `onceoff` |
| `pricingMethod` | PricingMethod | How price is calculated (one of 14 methods) |
| `pricingDriver` | string | What drives the quantity (e.g. "Transactions per month") |
| `quantity` | number | Volume / count |
| `unitPrice` | number | Price per unit (ZAR) |
| `discount` | number | Discount percentage (0–100) |
| `taxRate` | number | Tax percentage (default 15%) |
| `subtotal` | number | Calculated: `(qty × unit) × (1 - discount%) × (1 + tax%)` |
| `isOptional` | boolean | If true, excluded from totals |
| `notes` | text | Internal notes |
| `timeMethod` | enum | How hours are estimated |
| `timeDriver` | string | What drives time estimate |
| `timeQuantity` | number | Time multiplier |
| `timeInputHours` | number | Direct hours input |
| `timeInputMinutes` | number | Direct minutes input |
| `estimatedHours` | number | Calculated total hours |
| `deliveryFrequency` | enum | `monthly` \| `bi_monthly` \| `quarterly` \| `semi_annually` \| `annually` \| `once_off` \| `on_demand` |
| `duePattern` | string | Delivery timing rule |
| `complexityLevel` | enum | `low` \| `medium` \| `high` |
| `entityAssignmentMode` | enum | `all_entities` \| `selected_entities` |
| `assignedEntityIds` | UUID[] | Specific entity assignments |
| `entityPricingMode` | enum | `single_price` \| `price_per_entity` \| `custom_price_by_entity` |
| `customEntityPrices` | Record<UUID, number> | Per-entity custom prices |

---

## 6. Entity Pricing Modes

| Mode | Code | Behaviour | Total Calculation |
|------|------|-----------|-------------------|
| **Single price** | `single_price` | One price regardless of how many entities the service is assigned to | Total = subtotal |
| **Price per entity** | `price_per_entity` | The unit price is multiplied by the number of assigned entities | Total = subtotal × entity count |
| **Custom price by entity** | `custom_price_by_entity` | Individual price entered per entity in a pricing grid | Total = sum of all custom entity prices |

---

## 7. Service Config Drawer

A right-side sheet (**720px wide**) that opens when a service is added or clicked for editing.

### Drawer Sections

| Section | Fields |
|---------|--------|
| **Service Identity** | Name, description |
| **Billing & Pricing** | Billing type selector, pricing method selector, pricing driver label, quantity input, unit price input |
| **Time Estimation** | Context-sensitive: minutes-per-unit for volume methods, direct hours for fixed methods |
| **Entity Assignment** | Toggle: "All entities" or "Selected entities" with multi-select popover |
| **Entity Pricing Mode** | Selector: Single Price / Price per Entity / Custom. Custom shows per-entity pricing grid. |
| **Delivery & Scheduling** | Delivery frequency selector, scheduling rule text |
| **Adjustments** | Discount percentage, tax rate |
| **Notes** | Internal notes field |
| **Summary Metrics** | Display (read-only): Base Time, Total Value, Estimated Time, Effective Rate |

### Context-Sensitive Time Estimation

| Pricing Method Type | Time UI |
|--------------------|---------|
| Volume-based (per_transaction, per_employee, etc.) | "Minutes per [unit]" input → hours = (qty × mins) / 60 |
| Hourly | Hours = quantity (billable hours) |
| Fixed (fixed_monthly, etc.) | Direct hours + minutes input |
| Quantity × hours | Quantity input + hours-per-unit input |

---

## 8. Live Summary Panel

The right panel displays real-time calculations that update as services are configured.

### 8.1 Per-Entity Breakdowns (Collapsible)

For each entity in the proposal:

| Metric | Source |
|--------|--------|
| Monthly total | Sum of monthly items assigned to this entity |
| Yearly total | Sum of yearly items assigned to this entity |
| Once-off total | Sum of once-off items assigned to this entity |
| ACV | Monthly × 12 + Yearly |
| Hours | Sum of estimated hours for items assigned to this entity |

**Shared bucket:** `single_price` services assigned to multiple entities appear in a "Shared" section rather than being attributed to a single entity.

### 8.2 Overall Totals

| Metric | Formula |
|--------|---------|
| **ACV** | Monthly total × 12 + Yearly total |
| **Year 1 Payable** | ACV + Once-off total |
| **Per-cycle amount** | Based on selected payment frequency |

### 8.3 Payment Frequency Selector

| Frequency | Per-Cycle Amount |
|-----------|-----------------|
| As Delivered | Varies by service delivery schedule |
| Monthly | ACV ÷ 12 |
| Quarterly | ACV ÷ 4 |
| Annually | ACV ÷ 1 |

### 8.4 Work Estimate

| Metric | Formula |
|--------|---------|
| Annual Hours | Sum of (item hours × delivery frequency occurrences per year) |
| Revenue/Hour | ACV ÷ Annual Hours |

### 8.5 Cash Flow Preview

12-month bar chart with hover tooltips showing monthly projected revenue. Distribution depends on billing category and payment frequency (see §8 Cash Flow Planning).

---

## 9. Proposal Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm this proposal belongs to |
| `clientGroupId` | UUID (FK) | Client group for this proposal |
| `name` | string | Proposal name |
| `attentionToId` | UUID (FK) | Contact person |
| `status` | enum | `draft` \| `pending-approval` \| `approved` \| `sent` \| `viewed` \| `accepted` \| `rejected` \| `expired` |
| `clientGroupMode` | enum | `single_entity` \| `client_group` |
| `paymentFrequency` | enum | `as_delivered` \| `monthly` \| `quarterly` \| `annually` |
| `validUntil` | date | Proposal expiry date |
| `sentAt` | datetime | When proposal was sent to client |
| `acceptedAt` | datetime | When client accepted |
| `rejectedAt` | datetime | When client rejected |
| `createdBy` | UUID (FK) | User who created the proposal |
| `monthlyTotal` | number | Calculated monthly total (ZAR) |
| `yearlyTotal` | number | Calculated yearly total (ZAR) |
| `onceoffTotal` | number | Calculated once-off total (ZAR) |
| `acv` | number | Annual Contract Value = monthly × 12 + yearly |
| `year1Total` | number | Year 1 Payable = ACV + once-off |
| `totalHours` | number | Total estimated annual hours |
| `createdAt` | datetime | Creation timestamp |
| `updatedAt` | datetime | Last modification |
| `version` | integer | Proposal version number |

---

## 10. Optional Services

Services can be marked as `isOptional: true` in the Service Config Drawer:

- Optional services appear on the proposal with a distinct visual indicator
- They are **excluded from all totals** (monthly, yearly, once-off, ACV, Year 1)
- They are **excluded from hours calculations**
- In the client portal, the client can choose to include optional services
- When included by the client, totals recalculate to incorporate them

---

## 11. 6-Step Proposal Wizard (from Root Project)

The root project implements the proposal builder as a **6-step wizard** (in addition to the 3-panel drag-and-drop view for the new build). This wizard approach is used for structured proposal creation:

| Step | Name | Description |
|------|------|-------------|
| **1** | **Client / Group** | Select existing client or create new. Toggle between Individual and Organisation (Xero). Search/select contact, add inline. For Xero clients: fetch entities from Xero group. |
| **2** | **Entities** | Define entities for the proposal. Each entity has: name, type, revenue range, income tax range. Add/remove entities. For Xero groups: entities auto-populated. |
| **3** | **Package** | Select a package template (pre-configured service bundle). Auto-loads included services with variation settings. Revenue/income ranges pre-populated from package. |
| **4** | **Basic Info** | Select proposal template, document type, start month/year, financial year end, optional project name toggle. |
| **5** | **Services** | Sections with collapsible service lists. Checkbox selection of which services to include. Each service shows pricing type, tier selection, readiness status. |
| **6** | **Review** | Collapsible PDF preview (ProposalReviewPDFPreview). Summary of all selections. "Create Draft" or "Create & Send" buttons. |

### 11.1 Process Guard

The **ProcessGuardBanner** displays when setup is incomplete:
- No clients created yet
- No packages configured
- No documents/templates set up

The banner guides users to complete setup before creating proposals.

### 11.2 Onboarding

New users see an **OnboardingModal** with guided setup steps and a welcome toast with confetti animation on first visit.

---

## 12. Proposal Status State Machine (Enhanced)

The root project supports additional statuses beyond the management PRD:

```
draft → pending-approval → approved → sent → viewed → accepted / rejected / expired
         ↑                                              |
         └──────── (rejection returns to draft) ────────┘
```

| Status | Description |
|--------|-------------|
| `draft` | Initial creation state |
| `pending-approval` | Awaiting partner/admin approval (when `requireApprovalBeforeSend` enabled) |
| `approved` | Approved by approver, ready to send |
| `sent` | Sent to client via email |
| `viewed` | Client opened the proposal link |
| `accepted` | Client accepted (with optional signature) |
| `rejected` | Client rejected the proposal |
| `expired` | Past validity date |

---

## 13. Additional Proposal Fields (from Root Project)

| Field | Type | Description |
|-------|------|-------------|
| `proposalNumber` | string | Auto-generated (e.g. "PROP-2026-001") |
| `introText` | string | Introduction text (from template or custom) |
| `termsText` | string | Terms and conditions (from template or custom) |
| `packageTemplate` | string | Selected package template name |
| `entities` | array | Entity definitions: `{ id, name, type, revenueRange, incomeTaxRange }` |
| `template` | string | Selected proposal template |
| `documentType` | string | Document type (proposal, letter, both, quote) |
| `startMonth` / `startYear` | string | Engagement start date |
| `financialYearEndMonth` / `financialYearEndYear` | string | Financial year end |
| `addProjectName` | boolean | Whether project name is enabled |
| `projectName` | string | Custom project name |
| `pdfUrl` | storage ref | Generated PDF file |
| `signatureData` | object | Client signature: `{ signerName, signatureImage, signedAt, ipAddress, userAgent }` |
| `sourceProposalId` | UUID (FK) | If created via pricing adjustment |
| `pricingAdjustment` | object | Adjustment metadata (type, method, amount, scope) |
| `appsMapData` | object | Apps map canvas data (apps + connections) |
| `discount` | object | `{ type: "percentage"|"fixed", value, reason }` |
| `tax` | object | `{ rate, amount }` |
| `netMonthlyFee` | number | Net monthly fee |
| `monthlyTax` | number | Monthly tax amount |
| `grossMonthlyFee` | number | Gross monthly fee |
| `oneOffFee` | number | One-off fee (net) |
| `oneOffTax` | number | One-off tax amount |
| `grossOneOffFee` | number | Gross one-off fee |
| `approvedBy` | UUID (FK) | User who approved |
| `viewedAt` | datetime | When client first viewed |

---

## 14. Proposal Operations (from Root Project)

| Operation | Permission | Description |
|-----------|------------|-------------|
| Create | `canCreateProposals` | Create with auto-generated number |
| Update | `canCreateProposals` | Edit draft proposals |
| Send | `canSendProposals` | Send to client (may require approval first) |
| Delete | `canDeleteRecords` | Hard delete |
| Duplicate | `canCreateProposals` | Clone as new draft |
| Update Pricing | `canEditPricing` | Create new version with price adjustment |
| Mark Status | `canApproveProposals` | Manually mark accepted/rejected |
| Generate PDF Upload URL | Any authenticated | Get storage upload URL |
| Set PDF URL | Any authenticated | Save PDF storage reference |
