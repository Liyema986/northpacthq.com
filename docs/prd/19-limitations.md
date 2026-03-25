# NorthPact PRD — Known Limitations & Technical Debt (§15)

---

## 1. Current Limitations vs Target Resolution

| Area | Current Limitation | Target Resolution | Phase |
|------|-------------------|-------------------|-------|
| **Persistence** | No database — all data lost on refresh | Add backend + PostgreSQL | Phase 1 |
| **Authentication** | None — no user accounts | Add auth provider (Auth0/Clerk) | Phase 1 |
| **Dashboard Data** | Hardcoded mock values | Connect to real proposal data | Phase 1 |
| **Proposal List** | Hardcoded mock data | Database-backed list | Phase 1 |
| **Work Planning** | Hardcoded mock data | Derive from accepted proposals | Phase 2 |
| **Cash Flow Page** | Hardcoded mock data (builder has real calcs) | Aggregate from all proposals | Phase 2 |
| **Settings** | No persistence — form fields decorative | Database-backed settings | Phase 1 |
| **Multi-Proposal** | Only one draft at a time | Multiple proposal support | Phase 1 |
| **Print/Export** | No PDF or DOCX export | Engagement letter export | Phase 2 |
| **Tiered Pricing** | Listed but not implemented | Full tiered pricing engine | Phase 3 |
| **Engagement Letter** | Read-only output, no rich text editing | Rich text editor for paragraphs | Phase 2 |
| **Client Management** | No dedicated client module | Full client CRUD with group/entity model | Phase 1 |
| **Xero Integration** | Not yet implemented | OAuth + contact group sync | Phase 1 |
| **Versioning** | No proposal versioning | Version history with diff | Phase 3 |
| **Mobile** | Desktop-only layout | Responsive layouts for non-builder pages | Phase 3 |
| **Client Portal** | No client-facing view | Proposal acceptance portal | Phase 2 |

---

## 2. Technical Debt

| Item | Description | Priority |
|------|-------------|----------|
| Client-side state only | All state in React Context, no server persistence | Critical — Phase 1 |
| No input validation | Form inputs not validated server-side | Critical — Phase 1 |
| No error boundaries | Unhandled errors crash the app | High — Phase 1 |
| No loading states | No skeleton/spinner patterns for async operations | Medium — Phase 1 |
| Hardcoded service templates | Services defined in static TypeScript file | High — Phase 1 |
| No test coverage | No unit or integration tests | High — Phase 1 |
| No API error handling | No retry logic, timeout handling, or offline support | Medium — Phase 2 |
| No pagination | Lists load all records at once | Medium — Phase 2 |
| Single currency | ZAR hardcoded throughout | Low — Phase 4 |

---

## 3. Architecture Decisions Pending

| Decision | Options | Notes |
|----------|---------|-------|
| Backend framework | Next.js API routes vs Express vs Fastify | Next.js recommended for SSR + API co-location |
| Database | PostgreSQL vs Supabase vs PlanetScale | PostgreSQL recommended for relational model |
| Auth provider | Clerk vs Auth0 vs NextAuth | Clerk recommended for speed of integration |
| Hosting | Vercel vs Railway vs AWS | Vercel recommended for Next.js |
| Email service | Resend vs SendGrid vs Postmark | Resend recommended for developer experience |
| File storage | S3 vs Cloudflare R2 vs Vercel Blob | For logos, engagement letter PDFs |
| Real-time | WebSockets vs SSE vs polling | For collaborative editing (Phase 4) |
