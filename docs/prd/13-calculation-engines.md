# NorthPact PRD — Calculation Engines (§9)

All calculation logic in NorthPact follows deterministic pipelines. Calculations run client-side for real-time responsiveness and are verified server-side on save.

---

## 1. Price Calculation Pipeline

The price calculation follows this sequence for each ProposalItem:

```
Step 1: ServiceTemplate defaults are copied to ProposalItem when dragged into proposal
Step 2: User edits values in the Service Config Drawer
Step 3: recalculateItem() runs:
         baseAmount = quantity × unitPrice
Step 4: estimatedHours = calculateServiceHours(item) using time method
Step 5: subtotal = baseAmount × (1 - discount/100) × (1 + taxRate/100)
Step 6: getItemTotalPrice(item, entities) applies entity pricing mode:
         • single_price:            total = subtotal
         • price_per_entity:        total = subtotal × assignedEntityCount
         • custom_price_by_entity:  total = sum of all custom entity prices
```

### Price Formula by Pricing Method

| Method | Base Amount Formula |
|--------|-------------------|
| `fixed_monthly` | qty × unitPrice |
| `fixed_annual` | qty × unitPrice |
| `fixed_onceoff` | qty × unitPrice |
| `hourly` | hours × hourlyRate |
| `per_transaction` | txnCount × rate |
| `per_employee` | employeeCount × rate |
| `per_payslip` | payslipCount × rate |
| `per_invoice` | invoiceCount × rate |
| `per_bank_account` | accountCount × rate |
| `per_vat_submission` | submissionCount × rate |
| `per_entity` | entityCount × rate |
| `quantity_x_unit` | qty × unitPrice |
| `tiered` | Look up tier bracket for quantity → tier price |
| `manual_override` | Direct price entry (no formula) |

### Subtotal Formula

```
subtotal = baseAmount × (1 - discount / 100) × (1 + taxRate / 100)
```

### Entity Pricing Mode Application

```
if (entityPricingMode === 'single_price'):
    total = subtotal

if (entityPricingMode === 'price_per_entity'):
    total = subtotal × assignedEntityIds.length

if (entityPricingMode === 'custom_price_by_entity'):
    total = Σ customEntityPrices[entityId] for each entityId
```

---

## 2. Hours Calculation Pipeline

| Time Method | Formula | Used With |
|-------------|---------|-----------|
| `hourly` | hours = quantity | hourly pricing method |
| `volume_based` | hours = (quantity × minutesPerUnit) / 60 | per_transaction, per_employee, per_payslip, per_invoice, per_bank_account, per_vat_submission, per_entity |
| `fixed_hours` | hours = timeInputHours + (timeInputMinutes / 60) | fixed_monthly, fixed_annual, fixed_onceoff |
| `fixed_minutes` | hours = timeInputMinutes / 60 | Alternative fixed input |
| `quantity_x_hours` | hours = timeQuantity × timeInputHours | Scaled effort |
| `quantity_x_minutes` | hours = (timeQuantity × timeInputMinutes) / 60 | Scaled effort (minutes) |

### Entity Hours Scaling

Entity hours follow the same logic as pricing:
- `single_price` → base hours (no scaling)
- `price_per_entity` / `custom` → base hours × entity count

---

## 3. Summary Aggregation

These values are computed from all ProposalItems in the current proposal (excluding items where `isOptional === true`):

| Metric | Formula |
|--------|---------|
| `monthlyTotal` | sum of all `monthly` items' total |
| `yearlyTotal` | sum of all `yearly` items' total |
| `onceoffTotal` | sum of all `onceoff` items' total |
| **`ACV`** | `monthlyTotal × 12 + yearlyTotal` |
| **`Year 1 Total`** | `ACV + onceoffTotal` |
| `totalHours` | sum of (item hours × frequency occurrences per year) |
| `effectiveRate` | `ACV / totalHours` (revenue per hour) |
| `perCycle` | `ACV / frequencyDivisor` (12 for monthly, 4 for quarterly, 1 for annually) |

### Per-Entity Totals

For each entity in the proposal:

```
entityMonthly  = sum of monthly items assigned to this entity
entityYearly   = sum of yearly items assigned to this entity
entityOnceoff  = sum of once-off items assigned to this entity
entityACV      = entityMonthly × 12 + entityYearly
entityHours    = sum of hours for items assigned to this entity
```

**Shared bucket:** Services with `entityPricingMode = 'single_price'` assigned to multiple entities go into a "Shared" bucket rather than being attributed to a specific entity.

---

## 4. Cash Flow Distribution

Revenue from each ProposalItem is distributed across 12 months based on:
1. The item's **billing category** (monthly / yearly / onceoff)
2. The proposal's **payment frequency** (as_delivered / monthly / quarterly / annually)

### Monthly Items

| Payment Frequency | Month Distribution |
|-------------------|-------------------|
| `monthly` | item.total allocated to each of 12 months |
| `quarterly` | item.total × 3 allocated to months 3, 6, 9, 12 |
| `annually` | item.total × 12 allocated to month 1 |
| `as_delivered` | item.total allocated to each delivery month per frequency |

### Yearly Items

| Payment Frequency | Month Distribution |
|-------------------|-------------------|
| `monthly` | item.total / 12 per month |
| `quarterly` | item.total / 4 per quarter-end month |
| `annually` | item.total in delivery month |
| `as_delivered` | item.total in delivery month |

### Once-off Items

- Allocated to **month 1** (or specified milestone month)
- Regardless of payment frequency

### Aggregation

```
cashFlowByMonth[m] = Σ monthDistribution[m] for all items in proposal
```

---

## 5. Frequency Occurrences

Used for annual hours calculation:

| Frequency | Occurrences/Year |
|-----------|-----------------|
| `monthly` | 12 |
| `bi_monthly` | 6 |
| `quarterly` | 4 |
| `semi_annually` | 2 |
| `annually` | 1 |
| `once_off` | 1 |
| `on_demand` | 0 (excluded from scheduled calculations) |

---

## 6. Worked Example

**Service:** Monthly Bookkeeping  
**Pricing:** per_transaction, 120 txns × R18 = R2,160/mo  
**Time:** 120 txns × 6 min/txn = 12 hrs/mo  
**Discount:** 10%  
**Tax:** 15%  
**Entity Mode:** price_per_entity, 3 entities  
**Delivery:** monthly  

```
baseAmount   = 120 × R18           = R2,160
afterDiscount = R2,160 × 0.90      = R1,944
subtotal     = R1,944 × 1.15       = R2,235.60
entityTotal  = R2,235.60 × 3       = R6,706.80/mo

ACV contribution = R6,706.80 × 12  = R80,481.60/yr
Hours           = 12 hrs × 3 entities × 12 months = 432 hrs/yr
Effective rate  = R80,481.60 / 432  = R186.30/hr
```
