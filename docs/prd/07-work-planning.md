# NorthPact PRD — Work Planning Module (§6.5)

The work planning module derives delivery schedules and workload forecasts from accepted proposals. It provides operational visibility into what work is committed, when it is due, and who is responsible.

---

## 1. Data Flow

When a proposal is accepted, each ProposalItem generates **Work Plan Entries**:

```
Accepted Proposal
  └── ProposalItem (e.g. Monthly Bookkeeping, quarterly, 8 hrs)
       └── Work Plan Entries generated:
            ├── Jan: Bookkeeping — Entity A — 8 hrs — Team: Bookkeeping
            ├── Feb: Bookkeeping — Entity A — 8 hrs — Team: Bookkeeping
            ├── Mar: Bookkeeping — Entity A — 8 hrs — Team: Bookkeeping
            └── ... (12 months)
```

---

## 2. Work Plan Entry Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `proposalItemId` | UUID (FK) | Source proposal item |
| `proposalId` | UUID (FK) | Source proposal |
| `clientGroupId` | UUID (FK) | Client group reference |
| `serviceName` | string | Service display name |
| `entityId` | UUID (FK) | Entity this deliverable is for |
| `dueDate` | date | When the deliverable is due |
| `estimatedHours` | number | Hours allocated for this delivery |
| `responsibleTeam` | string | Assigned team (from service template) |
| `status` | enum | `planned` \| `in_progress` \| `completed` \| `overdue` |
| `month` | number | Delivery month (1–12) |

---

## 3. Delivery Frequency to Month Mapping

| Frequency | Code | Months | Occurrences/Year |
|-----------|------|--------|-------------------|
| Monthly | `monthly` | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 | 12 |
| Bi-monthly | `bi_monthly` | 2, 4, 6, 8, 10, 12 | 6 |
| Quarterly | `quarterly` | 3, 6, 9, 12 | 4 |
| Semi-annually | `semi_annually` | 6, 12 | 2 |
| Annually | `annually` | 12 | 1 |
| Once-off | `once_off` | 1 (or specified month) | 1 |
| On demand | `on_demand` | As needed (no scheduled months) | Variable |

---

## 4. Entry Generation Logic

For each accepted ProposalItem:

```
For each delivery month (based on deliveryFrequency):
  For each assigned entity:
    Create WorkPlanEntry {
      serviceName: item.name,
      entityId: entity.id,
      month: deliveryMonth,
      dueDate: calculateDueDate(deliveryMonth, item.duePattern),
      estimatedHours: item.estimatedHours,
      responsibleTeam: item.responsibleTeam || template.responsibleTeam,
      status: "planned",
    }
```

### Hours Distribution

- **single_price entities:** Base hours applied once across all entities
- **price_per_entity / custom:** Base hours × entity count (hours scale with entities)

---

## 5. Work Planning UI Features

### 5.1 KPI Cards

| KPI | Source |
|-----|--------|
| **Hours This Month** | Sum of estimatedHours for entries in current month |
| **Deliverables Due** | Count of entries in current month with status = planned |
| **Active Clients** | Count of distinct clientGroupIds with planned entries |

### 5.2 Monthly Delivery Calendar

- Grid view showing deliverables per month
- Colour-coded by status: planned (blue), in progress (amber), completed (green), overdue (red)
- Click to expand and see individual entries

### 5.3 Upcoming Work Table

| Column | Source |
|--------|--------|
| Service | `serviceName` |
| Client | Client group name |
| Entity | Entity name |
| Due Date | `dueDate` |
| Hours | `estimatedHours` |
| Team | `responsibleTeam` |
| Status | Status badge |

### 5.4 Filters

| Filter | Options |
|--------|---------|
| Team | Filter by responsible team |
| Client | Filter by client group |
| Status | planned, in_progress, completed, overdue |
| Month | Specific month selection |

### 5.5 Team Capacity View

| Metric | Description |
|--------|-------------|
| Committed hours | Sum of all planned/in-progress entries per team |
| Available hours | Team member count × working hours per month |
| Utilisation | Committed ÷ Available as percentage |
| Visual | Horizontal bar showing utilisation with green/amber/red zones |
