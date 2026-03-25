# NorthPact PRD — Cash Flow Planning Module (§6.6)

Cash flow planning aggregates revenue projections from all accepted proposals based on the client's chosen payment method and billing frequency.

---

## 1. Revenue Distribution Logic

### 1.1 Monthly Items

| Payment Frequency | Distribution |
|-------------------|-------------|
| **Monthly payment** | Amount spread evenly across 12 months |
| **Quarterly payment** | Amount × 3 allocated to quarter-end months (Mar, Jun, Sep, Dec) |
| **Annual payment** | Full annual amount (monthly × 12) in month 1 |
| **As Delivered** | Amount allocated to each delivery month (12 × monthly amount) |

### 1.2 Yearly Items

| Payment Frequency | Distribution |
|-------------------|-------------|
| **Monthly payment** | Annual amount ÷ 12 per month |
| **Quarterly payment** | Annual amount ÷ 4 per quarter |
| **Annual payment** | Full amount in delivery month |
| **As Delivered** | Full amount in delivery month |

### 1.3 Once-off Items

- Allocated to **month 1** or specified milestone month
- Regardless of payment frequency, once-off items hit cash flow when invoiced

---

## 2. Distribution Examples

### Example: R10,000/mo bookkeeping, monthly payment
```
Jan: R10,000 | Feb: R10,000 | Mar: R10,000 | ... | Dec: R10,000
Total: R120,000
```

### Example: R10,000/mo bookkeeping, quarterly payment
```
Jan: R0 | Feb: R0 | Mar: R30,000 | Apr: R0 | May: R0 | Jun: R30,000 | ...
Total: R120,000
```

### Example: R10,000/mo bookkeeping, annual payment
```
Jan: R120,000 | Feb: R0 | Mar: R0 | ... | Dec: R0
Total: R120,000
```

### Example: R22,000/yr AFS, as delivered
```
Month depends on delivery frequency. If annually delivered in month 12:
Jan: R0 | ... | Dec: R22,000
```

### Example: R18,000 once-off Xero setup
```
Jan: R18,000 | Feb: R0 | ... | Dec: R0
```

---

## 3. Aggregation

The firm-wide cash flow is the sum of distributions from **all accepted proposals**:

```
firmCashFlow[month] = Σ (proposalDistribution[month]) for all accepted proposals
```

Each proposal contributes based on its own:
- Payment frequency (chosen by client on acceptance)
- Service billing categories (monthly / yearly / once-off)
- Delivery frequencies (for "as delivered" payment)

---

## 4. Cash Flow UI Features

### 4.1 KPI Cards

| KPI | Source |
|-----|--------|
| **Annual Projected Revenue** | Sum of ACV for all accepted proposals |
| **Monthly Average** | Annual Projected ÷ 12 |
| **Peak Month** | Month with highest projected cash inflow |
| **Outstanding Amount** | Sum of ACV for sent (not yet accepted) proposals |

### 4.2 12-Month Bar Chart

- Vertical bars showing monthly cash inflow projections
- Hover tooltips showing exact amount per month
- Visual comparison of monthly variation
- Colour-coded by billing category (blue = monthly, violet = yearly, amber = once-off)

### 4.3 Breakdown Views

| View | Description |
|------|-------------|
| By client group | Stacked bars showing contribution per client |
| By billing category | Monthly, Yearly, Once-off split |
| By payment frequency | How each frequency contributes |

### 4.4 Drill-Down

Click on any month to see:
- Which proposals contribute revenue to that month
- Which services within each proposal
- Amount per service

### 4.5 Filters

| Filter | Options |
|--------|---------|
| Client group | Filter to single client |
| Billing category | Monthly, Yearly, Once-off |
| Payment frequency | As Delivered, Monthly, Quarterly, Annually |

### 4.6 Export

- CSV export of monthly projections
- XLSX export with detailed breakdowns
