# NorthPact PRD — Pricing Intelligence

**Source:** Root NorthPact `convex/pricing.ts`, `convex/pricingTool.ts`

---

## 1. Overview

NorthPact includes a **pricing intelligence engine** that suggests optimal pricing based on client characteristics, industry benchmarks, and firm-specific data. It also provides a comprehensive **pricing tool settings** panel for configuring tax rates, fee display preferences, alignment fees, and entity management.

---

## 2. Pricing Suggestion Engine

### 2.1 Multiplier System

The engine applies four multipliers to a service's base price:

#### Industry Multipliers

| Industry | Multiplier |
|----------|------------|
| Financial Services | 1.4× |
| Healthcare | 1.3× |
| Technology | 1.3× |
| Manufacturing | 1.2× |
| Professional Services | 1.2× |
| Real Estate | 1.15× |
| Retail | 1.1× |
| Construction | 1.1× |
| Non-Profit | 0.9× |
| Other | 1.0× |

#### Company Size Multipliers

| Size | Multiplier |
|------|------------|
| 1–10 employees | 0.8× |
| 11–50 | 1.0× |
| 51–200 | 1.3× |
| 201–500 | 1.6× |
| 501+ | 2.0× |

#### Complexity Multipliers

| Complexity | Multiplier |
|------------|------------|
| Simple | 0.8× |
| Moderate | 1.0× |
| Complex | 1.3× |
| Very Complex | 1.6× |

#### Urgency Multipliers

| Urgency | Multiplier |
|---------|------------|
| Standard | 1.0× |
| Expedited | 1.2× |
| Rush | 1.5× |

### 2.2 Calculation Formula

```
suggestedPrice = basePrice × industryMultiplier × sizeMultiplier × complexityMultiplier × urgencyMultiplier
```

Where `basePrice` is:
- Fixed services: `fixedPrice`
- Hourly services: `hourlyRate × estimatedHours`
- Tiered/recurring: `fixedPrice` as fallback

### 2.3 Confidence Score

A 1–5 scale indicating how reliable the suggestion is:

| Condition | Adjustment |
|-----------|------------|
| Base score | 5.0 |
| Missing annual revenue data | −0.5 |
| Missing hours estimate (hourly services) | −0.5 |
| Very complex project | −0.5 |
| Rush urgency | −0.3 |
| Minimum | 1.0 |

### 2.4 Firm Average Comparison

The engine computes the firm's **average proposal value** across all proposals and returns the percentage difference between the suggested price and the firm average.

### 2.5 Response

| Field | Description |
|-------|-------------|
| `suggestedPrice` | Recommended price (rounded to nearest ZAR) |
| `confidence` | 1.0–5.0 confidence score |
| `reasoning` | Human-readable explanation of applied multipliers |
| `factors` | Breakdown: basePrice, each multiplier value |
| `firmAverage` | Average proposal value for comparison |
| `comparisonToAverage` | Percentage difference from firm average |
| `serviceName` | Service being priced |
| `clientName` | Client being priced for |

---

## 3. Pricing Feedback Loop

When users accept or override a pricing suggestion, feedback is stored for future improvement:

| Field | Type | Description |
|-------|------|-------------|
| `suggestedPrice` | number | What the engine suggested |
| `actualPrice` | number | What the user set |
| `wasAccepted` | boolean | Whether the suggestion was used |
| `justification` | string (optional) | Why the user overrode |
| `difference` | number | `actualPrice - suggestedPrice` |
| `percentageDiff` | number | Percentage difference |

This data is stored in the activity log under entity type `pricing-feedback` for future ML training.

---

## 4. Pricing Tool Settings

### 4.1 Revenue & Income Ranges

Configurable range brackets for client classification:

**Annual Revenue Ranges (defaults for ZA market):**

| Range |
|-------|
| Nil |
| Up to R1M |
| R1M – R2.5M |
| R2.5M – R5M |
| R5M – R10M |
| R10M – R20M |
| R20M – R50M |
| R50M – R80M |
| R80M – R120M |
| R120M – R180M |
| R180M – R5B |

**Income Tax Ranges (second style):**

| Range |
|-------|
| Income tax total/income ranges |
| Less than R1m |
| R1m – R20m |
| R20m – R50m |
| R50m – R100m |
| More than R100m |

### 4.2 Fee Display Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `showFees` | enum | `breakdown` | `breakdown` (itemised) or `total-only` |
| `sectionSubTotals` | boolean | false | Show subtotals per service section |
| `dontRoundPrices` | boolean | false | When true, show exact amounts without rounding |

### 4.3 Minimum Fee

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `applyMinFee` | boolean | true | Enforce minimum monthly fee |
| `minMonthlyFee` | number | 350 | Minimum monthly fee in ZAR |

### 4.4 Tax Rates

Custom tax rates with CRUD operations:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g. `tax-1`) |
| `name` | string | Display name (e.g. "VAT (15%)") |
| `ratePercent` | number | Tax rate (0–100) |
| `isDefault` | boolean | Whether this is the default rate |

**Default rates:**
| Name | Rate |
|------|------|
| VAT (15%) | 15% (default) |
| Exempt VAT (0%) | 0% |
| Zero Rated (0) (0%) | 0% |

**Rules:**
- Exactly one tax rate must be marked as default
- At least one tax rate must exist
- Rate must be between 0 and 100

### 4.5 Upsell Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `upsellSection` | enum | `consider` | `consider` or `roadmap` — upsell section type |
| `displayFeesUpsell` | enum | `always` | `always` \| `never` \| `optional` |

### 4.6 Annualised Pricing

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enableAnnualised` | boolean | true | Enable annualised fee display |
| `discountOrIncrease` | enum | `discount` | `discount` or `increase` for annualised adjustment |
| `annualisedDiscount` | string | "0" | Discount/increase percentage |

### 4.7 Alignment Fee

Pro-rated onboarding fee calculation for clients joining mid-financial-year:

| Setting | Default | Description |
|---------|---------|-------------|
| `alignmentLineItems` | "All Lines" | Which line items alignment fee applies to |
| `alignmentProposals` | ["New Client"] | Which proposal types trigger alignment fee |
| `alignmentTool` | (see below) | Template text for alignment calculation in proposal tool |
| `alignmentPdfMonthly` | (same) | Template text for PDF monthly section |
| `alignmentPdfOneoff` | (see below) | Template text for PDF one-off section |

**Alignment fee merge tags:**
- `[alignment_fee_services]` — services covered
- `[alignment_fee_months_gone]` — months elapsed in financial year
- `[alignment_fee_total_due]` — pro-rated amount
- `[alignment_fee_months_left]` — remaining months

### 4.8 Multiple Entities

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enableMultipleEntities` | boolean | true | Enable multi-entity support |
| `businessTypes` | string | "Company\nSole Trader" | Newline-separated list of entity types |

---

## 5. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pricing/suggest` | Get pricing suggestion for a service + client combination |
| POST | `/api/pricing/feedback` | Store pricing feedback for learning |
| GET | `/api/pricing/settings` | Get pricing tool settings |
| PUT | `/api/pricing/settings` | Update pricing tool settings |
| POST | `/api/pricing/tax-rates` | Add a tax rate |
| PUT | `/api/pricing/tax-rates/:id` | Update a tax rate |
| DELETE | `/api/pricing/tax-rates/:id` | Remove a tax rate |
| PUT | `/api/pricing/tax-rates/:id/default` | Set as default tax rate |
