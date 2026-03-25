# NorthPact PRD — Dashboard & Reporting (§6.7)

The dashboard provides a firm-wide overview of the proposal pipeline and key performance metrics, drawn from real proposal data.

---

## 1. KPI Cards

| KPI | Source | Description |
|-----|--------|-------------|
| **Active Proposals** | Count of proposals with status = `sent` | Proposals awaiting client response |
| **Pipeline Value** | Sum of ACV for `sent` proposals | Total potential annual revenue in pipeline |
| **Hours Committed** | Sum of annual hours for `accepted` proposals | Committed delivery hours |
| **Monthly Recurring** | Sum of monthly totals for `accepted` proposals | Monthly recurring revenue from accepted work |
| **Conversion Rate** | Accepted ÷ (Accepted + Rejected + Expired) | Proposal win rate |
| **Average Deal Size** | Mean ACV of `accepted` proposals | Typical engagement value |

---

## 2. Dashboard Components

### 2.1 Recent Proposals Table

| Column | Source |
|--------|--------|
| Proposal name | `proposal.name` |
| Client group | `clientGroup.name` |
| Status | Status badge (Draft=grey, Pending-Approval=orange, Approved=teal, Sent=blue, Viewed=indigo, Accepted=green, Rejected=red, Expired=amber) |
| Services | Count of ProposalItems |
| ACV | Formatted `proposal.acv` |
| Age | Time since creation (e.g. "3 days ago") |
| Actions | View, Edit, Duplicate |

### 2.2 Pipeline Funnel

Visual funnel showing:
```
Draft (count, total value)
  ▼
Sent (count, total value)
  ▼
Accepted (count, total value)
```

Value at each stage represents aggregate ACV.

### 2.3 Activity Feed

Recent actions across the firm:
- "John created Proposal 'Smith Group 2026' — R450,000 ACV"
- "Sarah sent Proposal 'ABC Trading' to client@example.com"
- "Client accepted Proposal 'XYZ Holdings' — R280,000 ACV"
- "Lisa added 3 entities to 'Johnson Family Group'"

### 2.4 Quick Actions

| Action | Destination |
|--------|------------|
| New Proposal | `/proposals/new` |
| Import from Xero | `/clients` → Xero import |
| View Work Planning | `/work-planning` |

---

## 3. Dashboard Data Requirements

All dashboard data must come from real proposal records (no hardcoded mock data):

```
KPI calculations:
  activeProposals    = COUNT(proposals WHERE status = 'sent')
  pipelineValue      = SUM(acv WHERE status = 'sent')
  hoursCommitted     = SUM(totalHours WHERE status = 'accepted')
  monthlyRecurring   = SUM(monthlyTotal WHERE status = 'accepted')
  conversionRate     = COUNT(accepted) / COUNT(accepted + rejected + expired)
  avgDealSize        = AVG(acv WHERE status = 'accepted')
```
