# NorthPact PRD — Service Catalog & Pricing Engine (§6.2)

The service catalog is the reusable library of service templates that can be dragged into proposals. Each template defines default pricing, effort, delivery, and engagement letter content.

---

## 1. Service Template Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm this template belongs to |
| `name` | string | Service display name (e.g. "Monthly Bookkeeping") |
| `description` | string | Short summary for catalog cards |
| `longDescription` | text | Detailed scope, assumptions, exclusions |
| `categoryId` | UUID (FK) | Reference to ServiceCategory |
| `icon` | string | Lucide icon name for visual display |
| `defaultBillingType` | enum | `monthly` \| `yearly` \| `onceoff` |
| `defaultPricingMethod` | PricingMethod | How price is calculated (see pricing methods table) |
| `defaultQuantityDriver` | string | What the quantity represents (e.g. "Transactions per month") |
| `defaultQuantity` | number | Default quantity value |
| `defaultUnitPrice` | number | Default unit price in ZAR |
| `defaultEffortHours` | number | Default estimated hours per delivery cycle |
| `defaultEffortMinutes` | number | Additional minutes |
| `defaultDeliveryFrequency` | enum | How often delivered (monthly, quarterly, annually, etc.) |
| `defaultSchedulingRule` | string | Delivery timing description |
| `unitLabel` | string | Display label for units (e.g. "transactions", "employees") |
| `responsibleTeam` | string | Default assigned team |
| `defaultTaxRate` | number | Default VAT rate (15% standard) |
| `defaultDiscount` | number | Default discount percentage |
| `isOptionalDefault` | boolean | Whether service is optional by default in proposals |
| `tags` | string[] | Searchable tags for filtering |
| `engagementParagraphs` | EngagementParagraph[] | Service-specific engagement letter content (see §6.4) |
| `sortOrder` | number | Position within category |
| `isActive` | boolean | Whether template is available in catalog |
| `createdAt` | datetime | Creation timestamp |
| `updatedAt` | datetime | Last modification |

---

## 2. Service Categories

| Category | Icon | Colour | Typical Services |
|----------|------|--------|-----------------|
| **Bookkeeping** | `BookOpen` | Blue | Monthly bookkeeping, catch-up work |
| **Payroll** | `Users` | Violet | Payroll processing, EMP201, IRP5 |
| **Tax** | `FileText` | Amber | VAT returns, income tax, provisional tax |
| **Advisory** | `TrendingUp` | Emerald | Cash flow forecasting, budgeting, ad-hoc advisory |
| **Compliance** | `Shield` | Rose | Annual financial statements, SARS registrations |
| **Company Secretarial** | `Building` | Slate | Annual returns, CIPC changes |
| **Setup / Implementation** | `Settings` | Blue | Xero setup, system migrations |
| **Once-off Projects** | `Briefcase` | Amber | Clean-up work, special projects |
| **Custom** | `Wrench` | Slate | User-defined services |

---

## 3. Pricing Methods (14 Total)

All methods ultimately calculate: **`baseAmount = quantity × unitPrice`** (except tiered and manual override).

| # | Method | Formula | Use Case | Driver Example |
|---|--------|---------|----------|----------------|
| 1 | `fixed_monthly` | qty × unit_price | Flat monthly retainer | 1 × R12,500 |
| 2 | `fixed_annual` | qty × unit_price | Annual fixed fee | 1 × R22,000 |
| 3 | `fixed_onceoff` | qty × unit_price | One-time project fee | 1 × R18,000 |
| 4 | `hourly` | hours × hourly_rate | Time-based billing | 20 hrs × R950 |
| 5 | `per_transaction` | txn_count × rate | Volume-based bookkeeping | 120 txns × R18 |
| 6 | `per_employee` | employee_count × rate | Headcount-based payroll | 18 employees × R260 |
| 7 | `per_payslip` | payslip_count × rate | Payslip volume | 36 payslips × R85 |
| 8 | `per_invoice` | invoice_count × rate | Invoice processing | 50 invoices × R25 |
| 9 | `per_bank_account` | account_count × rate | Bank reconciliation | 3 accounts × R800 |
| 10 | `per_vat_submission` | submission_count × rate | VAT filing | 1 submission × R2,800 |
| 11 | `per_entity` | entity_count × rate | Multi-entity scaling | 4 entities × R1,500 |
| 12 | `quantity_x_unit` | qty × unit_price | Generic volume pricing | Custom driver |
| 13 | `tiered` | Volume tier brackets | Tiered volume pricing | 0-100: R20, 101-500: R15 |
| 14 | `manual_override` | Direct price entry | Direct price entry | R5,000 flat |

---

## 4. Time Estimation Methods

| Estimation Method | Formula | Used When |
|-------------------|---------|-----------|
| Volume-based | hours = (quantity × minutes_per_unit) / 60 | per_transaction, per_employee, per_payslip, per_invoice, per_bank_account, per_vat_submission, per_entity |
| Hourly | hours = quantity (hours are the billable hours) | hourly |
| Fixed hours | hours = timeInputHours + (timeInputMinutes / 60) | fixed_monthly, fixed_annual, fixed_onceoff |
| Fixed minutes | hours = timeInputMinutes / 60 | Alternative fixed input |
| Quantity × hours | hours = timeQuantity × timeInputHours | Scaled effort |
| Quantity × minutes | hours = (timeQuantity × timeInputMinutes) / 60 | Scaled effort (minutes) |

---

## 5. Pre-Loaded Service Templates (16)

The system ships with these default templates that can be customised or extended:

| # | Service | Category | Pricing Method | Default Price |
|---|---------|----------|---------------|--------------|
| 1 | Monthly Bookkeeping | Bookkeeping | `per_transaction` | R18 × 120 txns = **R2,160/mo** |
| 2 | Payroll Processing | Payroll | `per_employee` | R260 × 18 employees = **R4,680/mo** |
| 3 | VAT Returns | Tax | `per_vat_submission` | **R2,800** per submission |
| 4 | Management Accounts | Advisory | `fixed_monthly` | **R12,500/mo** |
| 5 | Annual Financial Statements | Compliance | `fixed_annual` | **R22,000/yr** |
| 6 | Income Tax Returns | Tax | `fixed_annual` | **R14,500/yr** |
| 7 | Company Secretarial | Company Secretarial | `fixed_annual` | **R6,800/yr** |
| 8 | CIPC Changes | Company Secretarial | `fixed_onceoff` | **R3,200** |
| 9 | Xero Setup | Setup / Implementation | `fixed_onceoff` | **R18,000** |
| 10 | Cash Flow Forecasting | Advisory | `fixed_monthly` | **R9,800/mo** |
| 11 | Budgeting | Advisory | `fixed_annual` | **R18,500/yr** |
| 12 | Advisory Retainer | Advisory | `fixed_monthly` | **R15,000/mo** |
| 13 | Advisory Session | Advisory | `hourly` | R1,800 × 2hrs = **R3,600** |
| 14 | SARS Registration | Compliance | `fixed_onceoff` | **R3,500** |
| 15 | Catch-up / Cleanup Work | Once-off Projects | `hourly` | R950 × 20hrs = **R19,000** |
| 16 | Custom Service | Custom | `manual_override` | **R0** (user-defined) |

---

## 6. Catalog UI Features

| Feature | Description |
|---------|-------------|
| Collapsible category sections | Colour-coded headers per category |
| Full-text search | Across name, description, tags, category, pricing driver, team |
| Filter by billing type | Monthly / Yearly / Once-off tabs |
| Filter by category | Category dropdown or chips |
| Create / edit service templates | Modal dialog with all fields |
| Create / edit categories | Manage category list with icons and colours |
| Reorder services | Drag or up/down buttons within a category |
| Move between categories | Drag service to different category |
| Duplicate service | Clone with new ID |
| Delete service | With confirmation (warn if used in active proposals) |
| Manage engagement paragraphs | Per-service paragraph editor (see §6.4) |

---

## 7. Service Sections (from Root Project)

Services are organized into **sections** (equivalent to categories but with additional configuration). Each section acts as a folder in the service catalog.

### 7.1 Section Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `name` | string | Section name (e.g. "Monthly Accounting") |
| `description` | string (optional) | Section description |
| `iconName` | string (optional) | Lucide icon name |
| `iconColor` | string (optional) | Icon color hex |
| `sortOrder` | number | Display order |
| `isPublished` | boolean | Whether section is visible in the proposal builder |
| `createdAt` | datetime | Creation timestamp |
| `updatedAt` | datetime | Last modification |

### 7.2 Section Operations

| Operation | Permission Required | Description |
|-----------|---------------------|-------------|
| Create section | `canEditPricing` | New section (auto-assigned next sortOrder) |
| Update section | `canEditPricing` | Edit name, description, icon, published status |
| Delete section | `canDeleteRecords` | Deletes section AND all services within it |
| Reorder sections | `canEditPricing` | Swap sortOrder with adjacent section (up/down) |
| Import from templates | `canEditPricing` | Import pre-defined section templates |

### 7.3 Pre-defined Section Templates

| Template ID | Section Name | Services Included |
|-------------|-------------|-------------------|
| `monthly-accounting` | Monthly Accounting | Bank reconciliations (R500), Monthly journals (R750), Debtors management (R400), Creditors management (R400), VAT calculations & submissions (R650) |
| `annual-compliance` | Annual Compliance | Annual financial statements (R3,500), Income tax returns (R1,500), CIPC annual returns (R350), SARS registrations (R500) |
| `payroll-services` | Payroll Services | Monthly payroll processing (R75), EMP201 submissions (R200), IRP5 certificates (R50), UIF declarations (R150) |
| `advisory-services` | Advisory Services | Business consulting (R1,500), Financial planning (R2,000), Tax planning (R1,800), Cash flow management (R1,200) |

Import skips sections with matching names to prevent duplicates.

### 7.4 Service Readiness Status (Traffic Light)

Each service has an automatically computed readiness status:

| Status | Color | Condition |
|--------|-------|-----------|
| `complete` | Green | Has name, description, schedule, AND price |
| `field-missing` | Amber | Has price and description, but missing schedule or name |
| `price-missing` | Red | Missing price or description (essential details) |

---

## 8. Calculation Variations (from Root Project)

Services can have **calculation variations** — configurable multipliers or addons that appear as dropdowns in the proposal builder when creating packages.

### 8.1 Variation Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique variation identifier |
| `valueType` | enum | `quantity` \| `static` \| `variations` |
| `label` | string (optional) | Display label for the dropdown |
| `operation` | enum | `add` \| `multiply` — how this variation affects the price |
| `options` | array (optional) | `[{ label: string, value: number }]` — dropdown options |
| `staticValue` | number (optional) | Fixed value (for `static` type) |
| `quantityFieldLabel` | string (optional) | Label for quantity input (for `quantity` type) |

### 8.2 How Variations Work

When `addCalculation: true` on a service:

1. The service config drawer shows additional dropdowns for each variation
2. Each variation has an operation (`add` or `multiply`) and selected value
3. The final price is computed by applying all variations in order

Example: A service at R500 with a "complexity" variation (`multiply`, value 1.5) → R750

### 8.3 Variation Types

| Type | UI | Description |
|------|-----|-------------|
| `variations` | Dropdown | Pre-defined options (e.g. complexity: Simple/Medium/Complex with multiplier values) |
| `static` | Hidden | A fixed value applied automatically |
| `quantity` | Number input | User enters a quantity that is applied |

---

## 9. Minimum Fee Configuration (from Root Project)

Services can enforce a minimum monthly fee:

| Field | Type | Description |
|-------|------|-------------|
| `applyMinimumFee` | boolean | Whether minimum fee applies |
| `minMonthlyFee` | number | Minimum fee amount (e.g. R350) |
| `minFeeType` | enum | `fixed` \| `calculation` |
| `minFeeCurrency` | string | Currency for min fee |
| `minFeeCalculation` | string | Formula for calculated minimum |

When the calculated service price falls below the minimum, the minimum is used instead.

---

## 10. Global & Section Price Adjustments (from Root Project)

### 10.1 Global Price Adjustment

Adjusts ALL service prices across ALL sections:

| Parameter | Type | Description |
|-----------|------|-------------|
| `adjustmentType` | enum | `increase` \| `decrease` |
| `adjustmentMethod` | enum | `percentage` \| `cost` (fixed amount) |
| `amount` | number | Adjustment value |

Applied to both `fixedPrice` and `hourlyRate`. Prices floored at 0 and rounded to 2 decimal places.

### 10.2 Section Price Adjustment

Same parameters but scoped to a single section.

---

## 11. Service Schedule (Engagement Letter Content)

Each service has a `serviceSchedule` field containing rich HTML text that describes the service scope for use in engagement letters. This is separate from the `description` field and provides detailed terms that appear in the Schedule of Services section of the engagement letter.

---

## 12. Delivery Frequencies

| Frequency | Code | Occurrences/Year | Delivery Months |
|-----------|------|-------------------|-----------------|
| Monthly | `monthly` | 12 | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 |
| Bi-monthly | `bi_monthly` | 6 | 2, 4, 6, 8, 10, 12 |
| Quarterly | `quarterly` | 4 | 3, 6, 9, 12 |
| Semi-annually | `semi_annually` | 2 | 6, 12 |
| Annually | `annually` | 1 | 12 |
| Once-off | `once_off` | 1 | 1 (or specified month) |
| On demand | `on_demand` | Variable | As needed (no scheduled months) |
