# NorthPact PRD — Executive Summary, Problem Statement & Glossary

**Version:** 2.0  
**Date:** 20 March 2026  
**Status:** Development Ready  
**Currency:** South African Rand (ZAR)  
**Target Market:** Accounting & Professional Services Firms (South Africa)

---

## 1. Executive Summary

NorthPact is a proposal builder and engagement management platform purpose-built for **accounting and professional services firms** operating in the South African market. It provides an end-to-end workflow from client onboarding through proposal creation, engagement letter generation, proposal acceptance, work planning, and cash flow forecasting.

The platform enables firms to:

- **Create and manage client groups** with multiple legal entities and Xero API integration for contact syncing
- **Build proposals** using a reusable service catalog with **14 pricing methods** and configurable pricing drivers
- **Assign services across entities** with drag-and-drop, per-entity pricing, and real-time financial summaries
- **Auto-generate engagement letters** with standard paragraphs and service-specific paragraphs that stay in sync with the proposal
- **Send proposals and collect acceptance** with digital signature workflow via a client portal
- **Forecast workload** by deriving work plan entries from accepted proposals and delivery schedules
- **Project cash flow** based on client-chosen payment method and billing frequency
- **Monitor pipeline health** via a dashboard with real-time KPIs and analytics

---

## 2. Problem Statement

Accounting firms manage complex client relationships where a single client may represent **multiple legal entities** (trusts, companies, close corporations, labour entities). Each entity requires different combinations of services with different pricing structures, delivery frequencies, and effort estimates.

### Current Pain Points

| # | Pain Point |
|---|-----------|
| 1 | Proposals are built in **spreadsheets or Word documents** with no reusable service catalog |
| 2 | Pricing logic (per-transaction, per-employee, per-entity, fixed, hourly) must be **recalculated manually** for every proposal |
| 3 | No structured way to **assign services across multiple entities** within a client group |
| 4 | Engagement letters are **created separately** and disconnected from the pricing model, causing scope discrepancies |
| 5 | Cash flow and workload forecasting requires **entirely separate models** and manual data re-entry |
| 6 | No **single source of truth** connecting proposals → engagement scope → delivery planning → billing |
| 7 | Client onboarding requires **manual data entry** even when client data already exists in Xero |

### Desired Outcome

A unified platform where a proposal **automatically flows into an engagement letter**, and once accepted, **drives work planning and cash flow projections** — eliminating manual handoffs and ensuring consistency between what was quoted, what was agreed, and what is delivered.

---

## 3. Target Users & Personas

| Persona | Role | Primary Use |
|---------|------|-------------|
| **Partner / Director** | Firm leadership | Review proposal pipeline, approve pricing, sign engagement letters, monitor firm-wide cash flow |
| **Engagement Manager** | Client relationship owner | Build proposals, configure services, manage entity structures, send proposals and engagement letters |
| **Operations Lead** | Delivery oversight | View work planning, monitor hours, manage team capacity against committed work |
| **Admin / Billing** | Back-office | Review cash flow projections, manage billing cycles, track payment schedules |

---

## 4. Key Capabilities (Summary)

### Core Platform

| Capability | Description |
|-----------|-------------|
| Client & Group Management | Create client groups with multiple entities, import from Xero, manage contacts |
| Service Catalog | 14 pricing methods, 16 pre-loaded templates, sections, calculation variations, min fees |
| Proposal Builder | 3-panel drag-and-drop + 6-step wizard, live summary, entity breakdowns, PDF preview |
| Engagement Letter Engine | Auto-composed from standard + service-specific paragraphs, scope library, key people, signing |
| Client Portal | Token-based proposal view, accept/reject, digital signature (draw/type/upload) |
| Work Planning | Auto-generated deliverables from accepted proposals with delivery calendar |
| Cash Flow Planning | Revenue projections distributed by payment frequency across 12 months |
| Dashboard | Pipeline KPIs, conversion rate, activity feed, recent proposals |
| Xero Integration | OAuth 2.0 contact group sync with entity mapping |

### Enhanced Features (from Root NorthPact)

| Capability | Description |
|-----------|-------------|
| Approval Workflow | Configurable proposal approval with request/approve/reject cycle and notifications |
| Real-Time Collaboration | Multi-user proposal editing with presence indicators and cursor tracking |
| Notification System | In-app notifications for approvals, proposal events, and signing |
| Email System | Queue, scheduled send, open tracking, Resend integration, Wahoo automation |
| Proposal Versioning | Version history, pricing adjustments (% or fixed, global or per-section) |
| Pricing Intelligence | AI-driven suggestions using industry/size/complexity/urgency multipliers |
| Global Search | Command palette (Cmd+K) across proposals, clients, services, templates |
| Proposal Templates & Packages | Reusable templates with section config, service bundles for quick creation |
| Admin Panel | Dashboard, team management, roles/permissions matrix, audit log |
| PDF Generation | Professional PDFs with firm branding, cover images, live preview |
| Subscription Billing | Stripe-powered plans (Starter/Pro/Enterprise) with checkout and portal |
| Landing Page | Marketing site with features, pricing, testimonials, sign-up flow |
| Apps Map | Visual integration hub with drag-and-drop app canvas |

---

## 5. Document Index

### Core Platform (Management PRD)

| # | Document | Maps to PRD Section |
|---|----------|-------------------|
| 00 | [Overview](./00-overview.md) | §1-3: Executive Summary, Problem Statement, Users, Glossary |
| 01 | [Architecture](./01-architecture.md) | §4: System Architecture, Tech Stack, Navigation |
| 02 | [Core Workflow](./02-core-workflow.md) | §5: Proposal-to-Engagement Pipeline (8-step flow) |
| 03 | [Client & Group Management](./03-client-management.md) | §6.1: Client Groups, Entities, Contact Persons |
| 04 | [Service Catalog & Pricing](./04-service-catalog.md) | §6.2: Service Templates, 14 Pricing Methods, Sections, Variations |
| 05 | [Proposal Builder](./05-proposal-builder.md) | §6.3: 3-Panel Layout, 6-Step Wizard, ProposalItem, Config Drawer |
| 06 | [Engagement Letter Engine](./06-engagement-letters.md) | §6.4: Composition Architecture, Scope Library, Key People, Signing |
| 07 | [Work Planning](./07-work-planning.md) | §6.5: Delivery Schedules, Work Plan Entries |
| 08 | [Cash Flow Planning](./08-cash-flow.md) | §6.6: Revenue Distribution Logic |
| 09 | [Dashboard & Reporting](./09-dashboard.md) | §6.7: KPIs, Pipeline Analytics |
| 10 | [Settings & Configuration](./10-settings.md) | §6.8: ALL Firm Settings (branding, PDF, Wahoo, engagement suite) |
| 11 | [Xero Integration](./11-xero-integration.md) | §7: OAuth, Contact Group Sync, Field Mapping |
| 12 | [Data Models](./12-data-models.md) | §8: 27+ Tables, Complete ER Model |
| 13 | [Calculation Engines](./13-calculation-engines.md) | §9: Price, Hours, Summary Aggregation Formulas |
| 14 | [State Management](./14-state-management.md) | §10: Context Providers, Persistence Strategy |
| 15 | [Design System & UI/UX](./15-design-system.md) | §11: Theme Tokens, Components, Visual Patterns |
| 16 | [Non-Functional Requirements](./16-nfr.md) | §12: Performance, Availability, Accessibility |
| 17 | [Security & Access Control](./17-security.md) | §13: Auth, 5 Roles, 13 Permissions, Lockout, Audit |
| 18 | [API Specifications](./18-api-reference.md) | §14: REST API Endpoints (100+ endpoints) |
| 19 | [Known Limitations](./19-limitations.md) | §15: Technical Debt, Current vs Target State |
| 20 | [Development Roadmap](./20-roadmap.md) | §16: 4-Phase Plan (24 Weeks) |
| 21 | [Acceptance Criteria](./21-acceptance-criteria.md) | §17: Definition of Done, Acceptance Tests |

### Enhanced Features (from Root NorthPact)

| # | Document | Feature |
|---|----------|---------|
| 22 | [Approval Workflow](./22-approval-workflow.md) | Configurable proposal approval with request/approve/reject cycle |
| 23 | [Real-Time Collaboration](./23-collaboration.md) | Multi-user presence, cursor tracking, activity feed |
| 24 | [Notification System](./24-notifications.md) | In-app notifications with types, read state, click-through |
| 25 | [Email System](./25-email-system.md) | Email queue, scheduled sending, tracking pixel, Wahoo automation |
| 26 | [Proposal Versioning](./26-proposal-versioning.md) | Version history, pricing adjustments, grouped-by-client view |
| 27 | [Client Portal & Signature](./27-client-portal.md) | Token-based accept/reject, SignaturePad (draw/type/upload), signing |
| 28 | [Pricing Intelligence](./28-pricing-intelligence.md) | Multiplier-based suggestions, confidence scores, feedback loop |
| 29 | [Global Search](./29-global-search.md) | Command palette, cross-entity search, suggestions |
| 30 | [Proposal Templates & Packages](./30-proposal-templates.md) | Document templates, package bundles, section configuration |
| 31 | [Admin Panel](./31-admin-panel.md) | Admin dashboard, team management, roles, audit log, rate limiting |
| 32 | [PDF Generation](./32-pdf-generation.md) | @react-pdf/renderer, firm branding, live preview, storage |
| 33 | [Subscription & Billing](./33-subscription-billing.md) | Stripe checkout, plans (Starter/Pro/Enterprise), webhooks |
| 34 | [Landing Page](./34-landing-page.md) | Marketing site sections, pricing tiers, sign-up flow |
| 35 | [Apps Map](./35-apps-map.md) | Integration hub canvas, sync logs, automations |

---

## 6. Glossary

| Term | Definition |
|------|-----------|
| **ACV** | Annual Contract Value: Monthly total × 12 + Yearly total |
| **Alignment Fee** | Pro-rated onboarding fee for clients joining mid-financial-year |
| **Apps Map** | Visual integration hub showing connected apps and their relationships |
| **Approval Workflow** | Process requiring senior review before proposals can be sent to clients |
| **Billing Category** | Monthly, Yearly, or Once-off — determines how a service is invoiced |
| **Calculation Variation** | Configurable multiplier or addon on a service (quantity, static, or dropdown) |
| **Client Group** | A collection of related legal entities managed as a single client relationship |
| **Command Palette** | Cmd+K search interface for finding proposals, clients, services, and templates |
| **Delivery Frequency** | How often a service is delivered (monthly, quarterly, annually, etc.) |
| **Entity** | A legal entity (company, trust, CC, etc.) within a client group |
| **Engagement Letter** | A formal agreement between the firm and client defining scope, fees, and terms |
| **Entity Pricing Mode** | How a service price scales across entities: single, per-entity, or custom |
| **Merge Field** | A placeholder in engagement letter text replaced with actual proposal data |
| **Package Template** | A pre-configured bundle of services for quick proposal creation |
| **Payment Frequency** | How the client pays: as delivered, monthly, quarterly, or annually |
| **POPIA** | Protection of Personal Information Act — South African data protection law |
| **Presence** | Real-time indicator showing which users are actively editing a proposal |
| **Pricing Driver** | The variable that determines service quantity (e.g. transactions, employees) |
| **Pricing Intelligence** | AI-driven pricing suggestions based on industry, size, and complexity multipliers |
| **Pricing Method** | The formula used to calculate a service price (e.g. per_transaction, fixed_monthly) |
| **Principal** | Key person at the firm (director, principal, auditor) who signs engagement letters |
| **Proposal Item** | An instance of a service template within a specific proposal, with customised pricing |
| **Proposal Template** | Reusable template defining structure, content, and sections for a proposal document |
| **Proposal Version** | A historical snapshot of a proposal, created when pricing is adjusted |
| **Scope Library** | Collection of engagement letter versions/scopes maintained by the firm |
| **Service Section** | Category folder organizing services with icon, color, and publish status |
| **Service Template** | A reusable service definition in the catalog with default pricing and effort |
| **Signing Session** | Token-based session for clients to digitally sign engagement letters |
| **Wahoo Email** | Automated email sent to client and staff when a proposal is accepted |
| **Work Plan Entry** | A scheduled deliverable generated from an accepted proposal item |
| **Year 1 Payable** | ACV + Once-off total — total amount payable in the first year |
| **ZAR** | South African Rand — the currency used throughout NorthPact |
