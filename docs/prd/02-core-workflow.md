# NorthPact PRD — Core Workflow: Proposal-to-Engagement Pipeline

The following describes the end-to-end workflow that forms the backbone of NorthPact. Each step is sequential and feeds data into the next.

---

## Step 1: Client & Group Setup

Before creating a proposal, the client group and its entities must exist in the system. This can happen via two methods:

**Manual Entry:** The user creates a new client group, defines the group name and type, and manually adds entities (companies, trusts, close corporations, etc.) with their registration details.

**Xero Import:** The user connects to Xero via OAuth 2.0 and imports contacts. Xero contacts that are part of a contact group are automatically mapped to a NorthPact client group. Individual contacts within the group become entities.

A **client group** represents a family of related legal entities managed as a single client relationship. Each entity within the group has its own registration number, tax number, VAT number, and entity type.

---

## Step 2: Create New Proposal & Select Group

The user initiates a new proposal and selects an existing client group (or creates one inline). All entities within the group are loaded into the proposal. The user can toggle individual entities on or off for this specific proposal.

### Proposal Header Fields

| Field | Description |
|-------|-------------|
| Proposal name | Auto-generated or custom |
| Client group | Selected from existing groups |
| Entities included | Multi-select from group entities (toggle on/off) |
| Proposal date | Date of creation |
| Validity period | Expiry date for client response |
| Status | Draft → Pending-Approval → Approved → Sent → Viewed → Accepted / Rejected / Expired |

---

## Step 3: Select Attention-To Person

The user selects or creates the primary contact person for the proposal. This is the person who will receive the proposal and engagement letter.

**Sources for the attention-to person:**
- An existing contact pulled from the client group
- An existing contact from Xero (synced via API)
- A manually entered new contact

### Contact Person Fields

| Field | Description |
|-------|-------------|
| Full name | Contact's full name |
| Salutation | Mr / Mrs / Ms / Dr etc. |
| Email address | Used for proposal delivery |
| Phone number | Contact phone |
| Role / designation | Position at the client |
| Linked entity | Primary entity association within the group |

---

## Step 4: Add Services & Configure Pricing

The user drags services from the Service Catalog into the proposal. Each service is assigned to one or more entities and configured with pricing drivers specific to that entity.

### Service Assignment Flow

1. Browse or search the Service Catalog (left panel)
2. Drag a service into the appropriate billing category zone (**Monthly**, **Yearly**, **Once-off**)
3. The **Service Configuration Drawer** opens automatically
4. Select which entities this service applies to (all or specific)
5. Configure pricing drivers: quantity, unit price, pricing method
6. Set entity pricing mode: single price, price per entity, or custom price per entity
7. Configure delivery frequency and scheduling
8. Set time estimation for effort/hours calculation
9. Optionally mark the service as **optional** (excluded from totals)
10. Repeat for all required services

As services are added and configured, the **Live Summary** panel (right side) updates in real-time showing per-entity breakdowns, billing category totals, Annual Contract Value (ACV), and a 12-month cash flow preview.

---

## Step 5: Review Amounts

Before sending, the user reviews the complete proposal:

| Review Item | Formula / Source |
|-------------|-----------------|
| Per-entity breakdown | Monthly, Yearly, and Once-off totals for each entity |
| Shared services | Services assigned to multiple entities with a single price |
| **ACV** | Monthly total × 12 + Yearly total |
| **Year 1 Payable** | ACV + Once-off total |
| Payment frequency | As Delivered / Monthly / Quarterly / Annually |
| Per-cycle amount | ACV ÷ frequency divisor |
| Total estimated hours | Sum of all service hours × frequency occurrences |
| Effective rate | Revenue per hour (ACV ÷ total hours) |
| Cash flow preview | 12-month bar chart |

---

## Step 6: Send Proposal

Once reviewed, the proposal is sent to the attention-to contact via email. The proposal status changes from **Draft** to **Sent**.

The client receives a link to a **client-facing proposal view** where they can:

- View all services, pricing, and entity assignments
- Accept or reject the proposal
- Request changes or add comments
- Select optional services to include
- Choose their preferred payment method / frequency

---

## Step 7: Generate Engagement Letter

When the proposal is finalised (before or after sending), the system automatically generates an engagement letter composed of:

### Engagement Letter Composition

| Section | Source |
|---------|--------|
| **Standard Paragraphs** | Paragraphs that appear in every letter regardless of services (introduction, terms, confidentiality, POPIA, liability, termination, signature blocks) |
| **Service-Specific Paragraphs** | Each service template has associated paragraphs. When a service is added to the proposal, its paragraphs are automatically inserted. For example, adding "Monthly Bookkeeping" inserts paragraphs describing scope, client responsibilities, deliverables, and frequency. |
| **Entity-Specific Sections** | Lists all entities in scope with registration details and which services apply to which entities |
| **Fee Schedule** | Summary table of all services, pricing, billing frequency, and totals — pulled directly from the proposal |

The engagement letter is generated as a structured document that can be previewed in-app and exported as **PDF** or **DOCX**.

---

## Step 8: Client Accepts Proposal

When the client accepts the proposal (via the client portal or confirmed manually), three downstream processes trigger automatically:

### 8a. Engagement Letter Dispatch

The finalised engagement letter is automatically sent to the client for signature. The letter includes all standard paragraphs plus service-specific paragraphs for every service in the accepted proposal.

### 8b. Work Planning Calculation

Accepted services with their estimated hours and delivery frequencies are pushed into the **Work Planning** module:

- Creates deliverable entries for each service based on delivery frequency (monthly, quarterly, annually, etc.)
- Distributes estimated hours across delivery months
- Assigns to the responsible team specified on each service
- Creates a 12-month delivery calendar with due dates based on scheduling rules

### 8c. Cash Flow Planning Calculation

The client's chosen payment method and frequency determine how revenue is distributed across months:

| Payment Frequency | Distribution |
|-------------------|-------------|
| **Monthly** | ACV ÷ 12, spread evenly |
| **Quarterly** | ACV ÷ 4, allocated to quarters |
| **Annually** | Full ACV in month 1 |
| **As Delivered** | Revenue allocated to delivery months per service frequency |
| **Once-off fees** | Allocated to month 1 (or agreed milestone month) |

This feeds the firm's aggregate cash flow forecast across all accepted proposals.

---

## Workflow Diagram

```
┌─────────────────┐
│  1. Client &     │
│  Group Setup     │──── Manual or Xero Import
└────────┬────────┘
         ▼
┌─────────────────┐
│  2. Create       │
│  Proposal        │──── Select group, toggle entities
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. Attention-To │
│  Person          │──── Select or create contact
└────────┬────────┘
         ▼
┌─────────────────┐
│  4. Add Services │
│  & Configure     │──── Drag-and-drop from catalog
│  Pricing         │──── Configure per-entity pricing
└────────┬────────┘
         ▼
┌─────────────────┐
│  5. Review       │
│  Amounts         │──── ACV, Year 1, per-entity, cash flow preview
└────────┬────────┘
         ▼
┌─────────────────┐
│  6. Send         │
│  Proposal        │──── Email to client → Client portal
└────────┬────────┘
         ▼
┌─────────────────┐
│  7. Generate     │
│  Engagement      │──── Standard + Service-specific paragraphs
│  Letter          │──── Fee schedule from proposal
└────────┬────────┘
         ▼
┌─────────────────┐     ┌──────────────┐
│  8. Client       │────▶│ 8a. Letter   │
│  Accepts         │     │ Dispatch     │
│                  │     └──────────────┘
│                  │     ┌──────────────┐
│                  │────▶│ 8b. Work     │
│                  │     │ Planning     │
│                  │     └──────────────┘
│                  │     ┌──────────────┐
│                  │────▶│ 8c. Cash     │
│                  │     │ Flow         │
└─────────────────┘     └──────────────┘
```
