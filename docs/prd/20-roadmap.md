# NorthPact PRD — Development Roadmap (§16)

---

## Phase 1: Foundation (Weeks 1–6)

Establish the core infrastructure and data persistence layer.

| Task | Description |
|------|-------------|
| **Next.js + Convex + Clerk scaffold** | `npx create-next-app@latest`, `npx convex dev`, Clerk provider wired, Convex JWT configured |
| **Convex schema** | Define all tables in `convex/schema.ts` — firms, users, clientGroups, entities, contactPersons, serviceCategories, serviceTemplates, proposals, proposalItems, engagementParagraphs — with `by_firm` indexes on every table |
| **Authentication** | Clerk sign-up/sign-in with Webhook → Convex user sync; 5-role RBAC (Owner/Admin/Senior/Staff/View-only) enforced in Convex mutations |
| **Client group & entity CRUD** | Convex queries + mutations; dedicated UI with react-hook-form + Zod validation |
| **Xero OAuth 2.0 integration** | Convex action handles OAuth token exchange; contact group sync with entity mapping |
| **Service catalog persistence** | Convex-backed catalog replacing client-side state; real-time updates via `useQuery` |
| **Multiple proposal support** | List/detail views with status filtering; proposals stored in Convex |
| **Settings persistence** | Firm details, tax defaults, branding stored in Convex `settings` table |
| **Dashboard connected to real data** | KPIs and recent proposals via reactive Convex queries |

### Phase 1 Deliverables
- [ ] Users can sign up, log in, and manage their firm
- [ ] Client groups with entities can be created, edited, and imported from Xero
- [ ] Service catalog is persisted and editable
- [ ] Multiple proposals can be created, saved as drafts, and listed
- [ ] Dashboard shows real proposal metrics
- [ ] Settings are persisted

---

## Phase 2: Engagement & Client Portal (Weeks 7–12)

Build the engagement letter engine and client-facing acceptance workflow.

| Task | Description |
|------|-------------|
| Engagement paragraph management | Standard + service-specific paragraphs with rich text editor |
| Engagement letter auto-generation | Compose from proposal data with merge field resolution |
| Rich text editor | TipTap integration for paragraph customisation |
| PDF export | Engagement letter export with firm branding using jsPDF + html-to-image |
| Proposal sending | Email dispatch via Resend (called from Convex action) to attention-to contact |
| Client portal | Proposal view with accept/reject, optional service selection |
| Digital signature workflow | Signature capture for engagement letters |
| Proposal acceptance triggers | Auto-generate work plan entries and cash flow projections |
| Attention-to contact management | Contact selection and creation in proposal builder |

### Phase 2 Deliverables
- [ ] Engagement letters auto-generate from proposals with correct paragraphs
- [ ] Letters export as branded PDF and DOCX
- [ ] Proposals can be sent via email
- [ ] Clients can view, accept, or reject via portal
- [ ] Acceptance triggers engagement letter dispatch
- [ ] Digital signatures captured on engagement letters

---

## Phase 3: Operational Views (Weeks 13–18)

Connect work planning and cash flow to real accepted proposal data.

| Task | Description |
|------|-------------|
| Work planning module | Auto-generate deliverables from accepted proposals |
| Delivery calendar | Due dates and status tracking per month |
| Team capacity planning | Committed vs available hours per team |
| Cash flow planning | Aggregate revenue projections from all accepted proposals |
| Cash flow drill-down | By client, service, and month |
| Export capabilities | CSV and XLSX export for cash flow and work planning |

### Phase 3 Deliverables
- [ ] Work plan entries auto-created on proposal acceptance
- [ ] Delivery calendar shows upcoming work with status tracking
- [ ] Cash flow chart aggregates all accepted proposals
- [ ] Drill-down shows which proposals/services contribute to each month
- [ ] All data exportable as CSV/XLSX

---

## Phase 4: Advanced Features (Weeks 19–24)

| Task | Description |
|------|-------------|
| Tiered pricing | Full implementation of volume tier brackets |
| Proposal templates | Save and reuse proposal configurations |
| Proposal versioning | Version history with change tracking |
| Audit trail | Comprehensive logging of all state changes |
| Email notifications | Status change notifications for proposals |
| Responsive layouts | Mobile/tablet optimisation for non-builder pages |
| Advanced reporting | Pipeline analytics, conversion funnels, revenue trends |
| Bulk operations | Bulk proposal actions (send, archive, duplicate) |

### Phase 4 Deliverables
- [ ] Tiered pricing works in service catalog and proposal builder
- [ ] Proposals can be saved as templates and reused
- [ ] Full version history with ability to view/compare versions
- [ ] All state changes logged with user, timestamp, and details
- [ ] Mobile-friendly layouts for dashboard, clients, proposals list

---

## Timeline Summary

```
Week 1 ──────── Week 6 ──────── Week 12 ──────── Week 18 ──────── Week 24
│                │                │                 │                 │
│   PHASE 1      │   PHASE 2      │    PHASE 3      │    PHASE 4      │
│   Foundation   │   Engagement   │    Operations    │    Advanced     │
│                │   & Portal     │    Views         │    Features     │
│                │                │                 │                 │
│ • Convex schema│ • Letters      │ • Work planning  │ • Tiered price  │
│ • Clerk auth   │ • Client portal│ • Cash flow      │ • Templates     │
│ • Client CRUD  │ • Signatures   │ • Team capacity  │ • Versioning    │
│ • Service DB   │ • jsPDF export │ • Exports        │ • Audit trail   │
│ • Xero sync    │ • Resend email │                 │ • Responsive    │
│ • Dashboard    │                │                 │ • Reporting     │
```
