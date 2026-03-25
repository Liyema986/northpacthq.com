# NorthPact PRD — Proposal Versioning & Pricing Adjustments

**Source:** Root NorthPact `convex/proposals.ts` (updateProposalPricing, getProposalVersions, etc.), `convex/schema.ts` (proposalVersions table)

---

## 1. Overview

NorthPact supports **proposal versioning** — when pricing is adjusted on an existing proposal, a new version is created as a draft, preserving the history of all previous versions. This enables firms to track pricing changes over time and maintain an audit trail of proposal evolution.

---

## 2. Data Model — ProposalVersion

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `proposalId` | UUID (FK) | Parent/current proposal |
| `versionNumber` | string | Version label (e.g. "v1", "v2", "v9") |
| `proposalNumber` | string | Full proposal number with version (e.g. "RA3110-v9") |
| `clientName` | string | Denormalized client name |
| `status` | enum | `active` \| `inactive` \| `draft` \| `sent` \| `accepted` \| `rejected` |
| `total` | number | Total value at this version |
| `currency` | string | Currency code |
| `createdBy` | UUID (FK, optional) | User who created this version |
| `createdByName` | string (optional) | Denormalized creator name |
| `createdAt` | datetime | Creation timestamp |

### Database Indexes

| Index | Fields | Purpose |
|-------|--------|---------|
| `by_proposal` | `proposalId` | List versions for a proposal |
| `by_firm` | `firmId` | List all versions for a firm |

---

## 3. Pricing Adjustment Workflow

### 3.1 Trigger

A user creates a pricing adjustment from an existing proposal. This creates a **new draft proposal** with adjusted pricing, preserving the original.

### 3.2 Adjustment Parameters

| Field | Type | Description |
|-------|------|-------------|
| `type` | enum | `increase` \| `decrease` |
| `method` | enum | `percentage` \| `cost` (fixed amount) |
| `amount` | number | Adjustment value (e.g. 10 for 10% or R500) |
| `scope` | enum | `all` \| `section` — apply to all services or a specific section |
| `sectionId` | UUID (optional) | Target section when scope is `section` |
| `sectionName` | string (optional) | Denormalized section name |
| `targetYear` | string (optional) | Target year for the adjustment |

### 3.3 Adjustment Logic

```
For each service in the proposal:
  If scope = "all" OR service.sectionId matches:
    If method = "percentage":
      newPrice = oldPrice × (1 + amount/100)  [increase]
      newPrice = oldPrice × (1 - amount/100)  [decrease]
    If method = "cost":
      newPrice = oldPrice + amount  [increase]
      newPrice = max(0, oldPrice - amount)  [decrease]
    Round to 2 decimal places
```

### 3.4 Version Metadata

The new proposal stores a reference back to the source:

| Field | Type | Description |
|-------|------|-------------|
| `sourceProposalId` | UUID (FK) | The proposal this was derived from |
| `pricingAdjustment` | object | Full adjustment parameters (type, method, amount, scope, etc.) |

---

## 4. Version History Display

### 4.1 Proposals List View

Proposals are **grouped by client** with:
- Latest version shown as the primary row
- Expandable history showing all previous versions
- Each version shows: version number, proposal number, status, total, creator, date
- Signature status indicator for accepted versions

### 4.2 Proposal Detail

- Version history panel showing all versions
- Each version is clickable to view its details
- Visual indicator of pricing changes between versions

---

## 5. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proposals/:id/update-pricing` | Create new version with pricing adjustment |
| GET | `/api/proposals/:id/versions` | List version history for a proposal |
| GET | `/api/proposals/grouped-by-client` | Proposals grouped by client with version counts |
| POST | `/api/proposals/:id/duplicate` | Duplicate as new draft (not a version — a separate proposal) |
| DELETE | `/api/proposal-versions/:id` | Delete a version (requires `canDeleteRecords`) |

---

## 6. Business Rules

| Rule | Detail |
|------|--------|
| A pricing adjustment always creates a NEW draft proposal | Original is preserved |
| The new proposal stores `sourceProposalId` for traceability | Links to the parent |
| Version numbers are sequential | v1, v2, v3... |
| Only users with pricing permissions can create adjustments | `canEditPricing` required |
| Deleting a version requires `canDeleteRecords` permission | Prevents accidental loss |
| Global price adjustments on the service catalog are separate | Those update template prices, not proposal instances |
