# NorthPact PRD — System Architecture Overview

## 1. Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Framework** | Next.js App Router | 15.4.8 | Server + Client Components, file-based routing |
| **Runtime** | React | 19.1.0 | Underlying React version bundled with Next.js |
| **Language** | TypeScript | 5+ | Strict mode enabled throughout |
| **Backend** | Convex | 1.31.7 | Queries, mutations, actions, real-time reactivity, built-in database |
| **Auth** | Clerk (`@clerk/nextjs`) | 6.37.3 | Multi-tenant auth — Google/Microsoft OAuth + email/password; JWT synced to Convex |
| **Styling** | Tailwind CSS v4 + shadcn/ui | 4.x | Utility-first CSS with pre-built accessible Radix UI components |
| **Animation** | Framer Motion | 12.31.0 | Smooth transitions and micro-interactions |
| **Drag & Drop** | @dnd-kit/core + @dnd-kit/sortable | 6.x / 10.x | Accessible drag-and-drop for service assignment in proposal builder |
| **Charts** | Recharts | 3.7.0 | Data visualisation for dashboards and cash flow |
| **Forms** | React Hook Form + Zod | 7.x / 4.x | Form management with schema validation (`lib/validations.ts`) |
| **Rich Text** | TipTap | 3.x | Rich text editing for engagement letter paragraphs |
| **PDF / Export** | jsPDF + html-to-image | 4.1.0 / latest | Proposal and engagement letter export |
| **Email** | Resend (via Convex actions) | 6.9.1 | Transactional email delivery — called from Convex actions only, never from Next.js API routes |
| **Payments** | Stripe | 20.3.1 | Subscription billing (Starter/Pro/Enterprise plans) |
| **Toast** | Sonner | 2.x | In-app notifications |
| **Icons** | Lucide React | 0.5x | Icon library |
| **External Integration** | Xero API (OAuth 2.0) | — | Contact and contact group syncing |

---

## 2. Navigation Structure

All routes live inside the Next.js App Router `app/` directory. Route groups (in parentheses) never appear in the URL.

| Route Group | Route | Page | Purpose |
|------------|-------|------|---------|
| `(app)` | `/` | Dashboard | Pipeline overview with KPI cards, recent proposals, and activity feed |
| `(app)` | `/clients` | Client Management | Manage client groups and entities, Xero sync |
| `(app)` | `/proposals` | Proposal List | Filterable list of all proposals with status tracking |
| `(app)` | `/proposals/new` | Proposal Builder | Core workspace: group setup, service assignment, pricing |
| `(app)` | `/proposals/[id]` | Proposal Detail | View/edit existing proposal |
| `(app)` | `/proposals/[id]/engagement` | Engagement Letter | Auto-generated engagement letter from proposal |
| `(app)` | `/work-planning` | Work Planning | Delivery calendar and workload from accepted proposals |
| `(app)` | `/cash-flow` | Cash Flow Planning | Projected monthly revenue based on accepted proposals |
| `(app)` | `/services` | Service Catalog | CRUD for service templates with pricing and engagement paragraphs |
| `(app)` | `/settings` | Settings | Firm details, tax defaults, branding, Xero connection, engagement letter defaults |
| `(auth)` | `/auth` | Auth Page | Sign-in / sign-up (Clerk custom UI) |
| `(auth)` | `/auth/redirect` | Role Redirect | Post-auth role-based redirect |
| `(auth)` | `/auth/sso-callback` | OAuth Callback | Clerk SSO callback handler |
| `(portal)` | `/portal/[token]` | Client Portal | Token-based proposal view, accept/reject, digital signature |
| `(admin)` | `/admin` | Admin Panel | Dashboard, team management, roles, audit log |

---

## 3. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                  NEXT.JS 15 APP ROUTER                         │
│  React 19 + TypeScript + Tailwind v4 + shadcn/ui               │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Server Components (default)                              │  │
│  │  - Page layouts, initial data fetch via useQuery         │  │
│  │  - No client-side JS bundle cost                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Client Components ("use client")                         │  │
│  │  - Proposal builder (drag-and-drop, live summary)        │  │
│  │  - Forms (react-hook-form + Zod)                         │  │
│  │  - Real-time reactive queries (Convex useQuery)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Pages: Dashboard | Clients | Proposals | Builder | Services   │
│         Work Planning | Cash Flow | Engagement | Settings      │
└────────────────────────┬───────────────────────────────────────┘
                         │ Convex WebSocket + HTTP
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                        CONVEX BACKEND                          │
│  Serverless TypeScript functions — no REST layer needed        │
│                                                                │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Queries (read, reactive)                               │     │
│  │  getProposals · getClientGroups · getServiceCatalog    │     │
│  │  getDashboardKPIs · getCashFlow · getWorkPlan          │     │
│  └───────────────────────────────────────────────────────┘     │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Mutations (write, transactional)                       │     │
│  │  createProposal · updateProposalItem · sendProposal    │     │
│  │  acceptProposal · createClientGroup · upsertService    │     │
│  └───────────────────────────────────────────────────────┘     │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Actions (side effects — external calls)                │     │
│  │  sendEmail (Resend) · generatePDF · xeroOAuthSync      │     │
│  │  stripeWebhook · createStripeCheckout                  │     │
│  └───────────────────────────────────────────────────────┘     │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ Convex Database (built-in)                             │     │
│  │  Document-based, firmId-scoped, indexed per §12        │     │
│  └───────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     ┌─────────┐   ┌─────────┐   ┌─────────┐
     │  Xero   │   │  Clerk  │   │  Resend │
     │  API    │   │  Auth   │   │  Email  │
     │(OAuth2) │   │ 6.37.3  │   │  6.9.1  │
     └─────────┘   └─────────┘   └─────────┘
          ▼
     ┌─────────┐
     │  Stripe │
     │ 20.3.1  │
     └─────────┘
```

---

## 4. Data Flow Patterns

### 4.1 Proposal Creation Flow

```
Client Group (existing) → Select for Proposal
  → Select attention-to contact
  → Drag services from catalog into billing category drop zones
  → Configure pricing, entity assignment, effort, delivery
  → Live summary recalculates on every change
  → Save as draft
  → Send to client
  → Client accepts/rejects via portal
  → Acceptance triggers:
      ├── Engagement letter dispatch
      ├── Work plan entry generation
      └── Cash flow projection update
```

### 4.2 State Management Strategy

| State Type | Tool | Example |
|-----------|------|---------|
| Server state (persistent) | Convex `useQuery` (reactive) | Client groups, proposals, services, settings |
| Draft state (in-progress) | React Context (ProposalDraftProvider) | Current proposal being built — live calculations stay client-side |
| Derived state (calculated) | `useMemo` in context | Summary totals, cash flow, entity breakdowns |
| Mutations (writes) | Convex `useMutation` | Create/update/delete any record |
| Auth state | Clerk + Convex user sync | `useUser()` from Clerk; Convex queries gate by `userId` |
| Form state | React Hook Form + Zod | Settings forms, entity forms, service config (`lib/validations.ts`) |
| URL state | Next.js App Router params | `useParams()`, `useSearchParams()` — no react-router-dom |

### 4.3 Calculation Flow

All calculations follow a deterministic pipeline:

```
ServiceTemplate defaults → ProposalItem (user edits) → recalculateItem()
  → baseAmount = quantity × unitPrice
  → discount applied
  → tax applied
  → entity pricing mode applied
  → estimatedHours calculated
  → results feed Live Summary aggregation
  → results feed Cash Flow distribution
```

Real-time summary calculations remain **client-side** for responsiveness. All persisted values are **verified in Convex mutations** on save — Convex enforces firm-scoping, permission checks, and calculation verification before writing to the database.

---

## 5. Multi-Tenancy Model

NorthPact is a **firm-scoped multi-tenant** application:

- Every data record has a `firmId` field
- All API queries filter by the authenticated user's `firmId`
- Users can only see data belonging to their firm
- The backend enforces firm boundaries on every request

```
Firm → has many → Users
Firm → has many → ClientGroups → has many → Entities
                              → has many → ContactPersons
Firm → has many → ServiceCategories → has many → ServiceTemplates
Firm → has many → Proposals → has many → ProposalItems
Firm → has many → EngagementParagraphs (standard)
Firm → has many → Settings (singleton per firm)
```

---

## 6. Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Next.js App Router (not Vite/SPA)** | Server Components, built-in routing, API routes for webhooks, SEO for landing page, production-grade deployment on Vercel |
| **Convex (not PostgreSQL + REST)** | Built-in real-time reactivity eliminates the need for WebSockets, polling, or a separate state-sync layer; serverless functions; built-in multi-tenant scoping via `by_firm` indexes; no ORM or migration tooling required |
| **Clerk (not custom auth)** | Enterprise-grade auth with Google/Microsoft OAuth, email/password, MFA, session management, and Convex JWT integration out of the box |
| **Resend via Convex actions (not Next.js API routes)** | All external service calls (email, PDF, Xero) run in Convex actions so they have access to the database context and can be scheduled or retried |
| **Client Group → Entity hierarchy** | SA accounting firms manage families of legal entities as single relationships |
| **14 pricing methods** | Industry requires volume-based (txns, employees, payslips), fixed, hourly, and entity-scaled pricing |
| **Engagement letter composition (not templates)** | Letters must auto-compose from standard + service-specific paragraphs; adding/removing services must auto-update the letter |
| **Client-side real-time calculations** | Live summary must update <100ms as user edits; Convex mutation verifies on save |
| **Convex document model with indexes** | `by_firm` index on every table for efficient multi-tenant scoping; object fields replace JSONB columns |
| **Xero OAuth 2.0** | Most SA accounting firms use Xero; contact group sync eliminates manual data entry |
