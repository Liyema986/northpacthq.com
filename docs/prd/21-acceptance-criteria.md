# NorthPact PRD — Acceptance Criteria & Definition of Done (§17)

---

## 1. Core Workflow Acceptance Criteria

### 1.1 Client Setup

| # | Criterion | Verified |
|---|-----------|----------|
| 1 | User can create a client group with multiple entities manually | ☐ |
| 2 | User can import a client group from Xero with entities auto-populated | ☐ |
| 3 | Entity details (registration, tax, VAT numbers) are captured and editable | ☐ |
| 4 | Contact persons can be added and linked to entities | ☐ |
| 5 | Client groups can be searched and filtered | ☐ |
| 6 | Archiving a client group preserves linked proposals | ☐ |
| 7 | Entity types include: pty_ltd, cc, trust, sole_prop, partnership, npc, other | ☐ |
| 8 | Group types include: holding_company, family_trust, partnership, individual, other | ☐ |

### 1.2 Proposal Creation

| # | Criterion | Verified |
|---|-----------|----------|
| 1 | User can create a new proposal and select an existing client group | ☐ |
| 2 | User can select an attention-to contact person | ☐ |
| 3 | User can toggle entities on/off for the proposal | ☐ |
| 4 | User can switch between Single Entity and Client Group modes | ☐ |
| 5 | User can drag services from catalog into billing category zones (Monthly/Yearly/Once-off) | ☐ |
| 6 | Service configuration drawer opens automatically on drop | ☐ |
| 7 | All 14 pricing methods are available and calculate correctly | ☐ |
| 8 | Entity assignment works: All Entities and Selected Entities modes | ☐ |
| 9 | Entity pricing modes work: single_price, price_per_entity, custom_price_by_entity | ☐ |
| 10 | Time estimation calculates correctly for all methods | ☐ |
| 11 | Services can be marked as optional (excluded from totals) | ☐ |
| 12 | Live summary updates in real-time as services are added/modified | ☐ |
| 13 | Per-entity breakdowns are accurate and match manual calculation | ☐ |
| 14 | Shared services (single_price multi-entity) appear in Shared bucket | ☐ |
| 15 | ACV = Monthly × 12 + Yearly (verified) | ☐ |
| 16 | Year 1 Payable = ACV + Once-off (verified) | ☐ |
| 17 | Payment frequency selection changes per-cycle display correctly | ☐ |
| 18 | Cash flow preview chart shows 12-month distribution correctly | ☐ |
| 19 | Proposals can be saved as drafts | ☐ |
| 20 | Proposals can be duplicated | ☐ |

### 1.3 Engagement Letter

| # | Criterion | Verified |
|---|-----------|----------|
| 1 | Engagement letter auto-populates with all active standard paragraphs | ☐ |
| 2 | Adding a service to proposal inserts its service-specific paragraphs | ☐ |
| 3 | Removing a service removes its paragraphs from the letter | ☐ |
| 4 | All merge fields resolve correctly (client name, fees, entities, etc.) | ☐ |
| 5 | Entity listing shows all entities with registration details | ☐ |
| 6 | Fee schedule table matches proposal items and totals | ☐ |
| 7 | Letter exports correctly as PDF | ☐ |
| 8 | Letter exports correctly as DOCX | ☐ |
| 9 | One-off edits can be made without affecting source templates | ☐ |
| 10 | All 12 standard paragraphs are configurable in settings | ☐ |

### 1.4 Proposal Sending & Acceptance

| # | Criterion | Verified |
|---|-----------|----------|
| 1 | Proposal can be sent via email to the attention-to contact | ☐ |
| 2 | Proposal status changes from Draft to Sent | ☐ |
| 3 | Client can view proposal via portal link | ☐ |
| 4 | Client can accept the proposal | ☐ |
| 5 | Client can reject the proposal | ☐ |
| 6 | Client can select optional services to include | ☐ |
| 7 | Client can choose payment frequency | ☐ |
| 8 | Acceptance triggers engagement letter dispatch | ☐ |
| 9 | Acceptance populates work planning with deliverables | ☐ |
| 10 | Chosen payment method drives cash flow projections | ☐ |

### 1.5 Work Planning

| # | Criterion | Verified |
|---|-----------|----------|
| 1 | Work plan entries auto-generate from accepted proposal items | ☐ |
| 2 | Entries distribute correctly by delivery frequency | ☐ |
| 3 | Hours scale correctly with entity pricing mode | ☐ |
| 4 | Calendar view shows deliverables by month | ☐ |
| 5 | Entries can be filtered by team, client, status, month | ☐ |
| 6 | Entry status can be updated (planned → in_progress → completed) | ☐ |

### 1.6 Cash Flow

| # | Criterion | Verified |
|---|-----------|----------|
| 1 | Cash flow aggregates revenue from all accepted proposals | ☐ |
| 2 | Monthly items distribute correctly by payment frequency | ☐ |
| 3 | Yearly items distribute correctly by payment frequency | ☐ |
| 4 | Once-off items allocate to month 1 (or milestone month) | ☐ |
| 5 | 12-month chart renders correctly with drill-down | ☐ |
| 6 | Filters work: by client, billing category, payment frequency | ☐ |
| 7 | Cash flow exports to CSV/XLSX | ☐ |

---

## 2. Service Catalog Acceptance Criteria

| # | Criterion | Verified |
|---|-----------|----------|
| 1 | All 16 pre-loaded service templates are available | ☐ |
| 2 | Templates can be customised by the firm | ☐ |
| 3 | New templates can be created with all fields | ☐ |
| 4 | Categories can be created, edited, and reordered | ☐ |
| 5 | Services can be reordered within categories | ☐ |
| 6 | Services can be moved between categories | ☐ |
| 7 | Full-text search works across all service fields | ☐ |
| 8 | Engagement paragraphs can be managed per service | ☐ |
| 9 | All 14 pricing methods calculate correctly | ☐ |
| 10 | Services can be duplicated and deleted | ☐ |

---

## 3. Xero Integration Acceptance Criteria

| # | Criterion | Verified |
|---|-----------|----------|
| 1 | OAuth 2.0 flow completes successfully | ☐ |
| 2 | Contact groups import as client groups | ☐ |
| 3 | Contacts within groups import as entities | ☐ |
| 4 | Contact persons are mapped correctly | ☐ |
| 5 | Token refresh works automatically | ☐ |
| 6 | Incremental sync updates existing records | ☐ |
| 7 | Xero IDs are stored for re-sync reference | ☐ |
| 8 | Disconnect removes tokens and updates status | ☐ |

---

## 4. Definition of Done

A feature is considered **done** when all of the following are true:

| # | Criterion |
|---|-----------|
| 1 | Feature implemented and tested (unit + integration tests) |
| 2 | Code reviewed and approved by at least one other developer |
| 3 | No blocking bugs or regressions in existing functionality |
| 4 | Responsive on target browsers (Chrome, Edge, Safari, Firefox) |
| 5 | Accessible (keyboard navigation, screen reader labels) |
| 6 | API documentation updated for any new/changed endpoints |
| 7 | Data model migrations applied and reversible |
| 8 | Error states handled (loading, empty, error, permission denied) |
| 9 | Input validation implemented (client-side and server-side) |
| 10 | Multi-tenant isolation verified (firmId scoping) |
