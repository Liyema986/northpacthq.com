# NorthPact PRD — Engagement Letter Engine (§6.4)

The engagement letter engine automatically generates professional engagement letters from proposal data. This is a **critical differentiator** — the letter is always in sync with the proposal.

---

## 1. Letter Composition Architecture

An engagement letter is composed of paragraphs from **two sources**:

### Standard Paragraphs (Apply to All Letters)

These are configured once in Settings and included in every engagement letter. They are ordered by a `sortOrder` field and can be edited by firm administrators.

| # | Standard Paragraph | Description |
|---|-------------------|-------------|
| 1 | **Introduction & Parties** | Identifies the firm, the client group, and the entities in scope |
| 2 | **Scope Overview** | General description of the engagement and reference to the fee schedule |
| 3 | **Client Responsibilities** | General obligations of the client (providing information, meeting deadlines) |
| 4 | **Firm Responsibilities** | General obligations of the firm (professional standards, due care) |
| 5 | **Fees & Payment Terms** | General fee terms, escalation clauses, payment due dates |
| 6 | **Confidentiality** | Confidentiality obligations of both parties |
| 7 | **Data Protection (POPIA)** | Compliance with the Protection of Personal Information Act |
| 8 | **Limitation of Liability** | Caps on liability and exclusions |
| 9 | **Intellectual Property** | Ownership of work product and deliverables |
| 10 | **Term & Termination** | Duration of engagement and termination conditions |
| 11 | **Dispute Resolution** | Process for resolving disagreements |
| 12 | **Acceptance & Signature** | Signature blocks for both parties with date fields |

### Service-Specific Paragraphs (Added Per Service)

Each service template in the catalog can have one or more engagement paragraphs. When that service is included in a proposal, its paragraphs are **automatically inserted** into the engagement letter under a dedicated service scope section.

**Example:** Adding "Monthly Bookkeeping" to a proposal inserts paragraphs describing:
- The scope of bookkeeping work
- Responsibilities of the client (providing source documents)
- Deliverables (monthly financial reports)
- Frequency (monthly processing and reconciliation)

---

## 2. Engagement Paragraph Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm this paragraph belongs to |
| `type` | enum | `standard` \| `service_specific` |
| `serviceTemplateId` | UUID (FK) \| null | Linked service template (null for standard paragraphs) |
| `title` | string | Paragraph heading (e.g. "Scope of Bookkeeping Services") |
| `body` | rich text | Paragraph content with merge field support |
| `sortOrder` | number | Display order within the letter |
| `isActive` | boolean | Whether paragraph is included by default |
| `mergeFields` | string[] | Available placeholders for this paragraph |
| `createdAt` | datetime | Creation timestamp |
| `updatedAt` | datetime | Last modification |

---

## 3. Merge Fields

Merge fields are placeholders in paragraph text that are replaced with actual proposal data during letter generation.

| Merge Field | Replaced With |
|-------------|--------------|
| `{clientGroupName}` | Client group display name |
| `{entityName}` | Entity legal name (in entity-specific contexts) |
| `{entityType}` | Entity type description |
| `{entityRegistration}` | Registration number |
| `{entityTaxNumber}` | SARS income tax number |
| `{entityVatNumber}` | VAT registration number |
| `{serviceName}` | Service display name |
| `{fee}` | Service total price (formatted currency) |
| `{monthlyFee}` | Monthly total |
| `{yearlyFee}` | Yearly total |
| `{onceoffFee}` | Once-off total |
| `{acv}` | Annual Contract Value |
| `{year1Total}` | Year 1 Payable |
| `{frequency}` | Delivery frequency label |
| `{paymentFrequency}` | Payment frequency label |
| `{startDate}` | Engagement start date |
| `{firmName}` | Firm name |
| `{firmAddress}` | Firm physical address |
| `{attentionToName}` | Contact person full name |
| `{attentionToEmail}` | Contact person email |
| `{proposalDate}` | Proposal creation date |
| `{validUntil}` | Proposal expiry date |
| `{currentDate}` | Today's date |

---

## 4. Letter Generation Logic

1. Start with all active **standard paragraphs** in `sortOrder`
2. For each service in the proposal (grouped by billing category), insert the **service-specific paragraphs**
3. Replace **merge fields** with actual proposal data (client name, entity names, fees, frequencies)
4. Generate the **fee schedule table** from proposal items
5. Insert **entity listing** with registration details
6. Add **signature blocks**

---

## 5. Generated Letter Sections (Output)

| # | Section | Content |
|---|---------|---------|
| 1 | Letter header | Firm branding, date, and attention-to person |
| 2 | Introduction and parties | Standard paragraph #1 with merge fields resolved |
| 3 | Entities in scope | Grid of entity cards with name, type, registration, tax, VAT numbers |
| 4 | Scope of services | Grouped by entity, then shared/group-wide services |
| 5 | Service-specific paragraphs | Auto-inserted per service from catalog |
| 6 | Fee schedule table | Service name, billing category, pricing mode, amount, hours |
| 7 | Payment terms and frequency | Payment method, per-cycle amount, due dates |
| 8 | Standard paragraphs | Confidentiality, POPIA, liability, IP, etc. (paragraphs #3-11) |
| 9 | Termination and dispute | Standard paragraphs #10-11 |
| 10 | Acceptance and signature | Signature blocks for both parties with date fields |

---

## 6. Key Behaviours

| Behaviour | Detail |
|-----------|--------|
| **Adding a service** to a proposal automatically inserts its paragraphs into the engagement letter |
| **Removing a service** from a proposal automatically removes its paragraphs from the letter |
| **Changing entity assignments** updates the entity-specific sections of the letter |
| **Changing pricing** updates the fee schedule table and all fee-related merge fields |
| **Letter is always in sync** with the current proposal state |

---

## 7. Export Formats

| Format | Use Case |
|--------|----------|
| **In-app preview** | Read and review before sending |
| **PDF export** | Formal document for signature |
| **DOCX export** | Editable version for one-off adjustments |

---

## 8. One-Off Adjustments

The generated letter can be edited for one-off adjustments before sending:
- Add, edit, or remove paragraphs for this specific letter
- Modify text within existing paragraphs
- These changes apply only to this letter, not to the source templates
- A flag indicates the letter has been manually modified

---

## 9. Engagement Letter Settings (in Settings Page)

The engagement letter configuration spans multiple sub-sections in Settings:

### 9.1 Engagement Letter Suite (Scope Library)

| Feature | Description |
|---------|-------------|
| **Scope Library** | Multiple letter versions/scopes that can be created, edited, duplicated, reordered |
| **Global Settings** | Terms & Conditions, Privacy Notice, Schedule of Services Introduction, Agreement text (with/without signature), Principal signature toggle |

#### Scope Library Version Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `name` | string | Version name |
| `introduction` | string (rich text) | Letter introduction text |
| `scope` | string (rich text) | Scope description text |
| `sortOrder` | number | Display order |

### 9.2 Letterhead Components

| Setting | Description |
|---------|-------------|
| Directors list | List of firm directors displayed in letterhead |
| Footer text | Footer text on letterhead |

### 9.3 Key Dates

| Setting | Type | Description |
|---------|------|-------------|
| `keyDatesTableIntroduction` | string | Introduction text above key dates table |
| `infoDeadlineHeading` | string | Column heading for information deadlines |
| `filingDeadlineHeading` | string | Column heading for filing deadlines |

### 9.4 Key People (Principals)

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Principal's name |
| `qualification` | string | Professional qualifications |
| `signatureStorageId` | file ref | Uploaded signature image |
| `roles` | string[] | `director` \| `principal` \| `statutory-auditor` |
| `sortOrder` | number | Display order in engagement letter |

Principals can be created, updated, deleted, and reordered. Their signature images are uploaded via file storage.

### 9.5 Email Templates (Wahoo)

Two sets of email templates for post-acceptance automation:
- **Signed & Accepted**: Triggered when client accepts with a signature
- **Acceptance Button Only**: Triggered when client accepts without signature

Each set has templates for: Client, Additional Signatory, Staff, plus CC email.

See [§25 Email System](./25-email-system.md) for full Wahoo email details.

---

## 10. Letter Templates (by Jurisdiction)

The root project supports **jurisdiction-based letter templates**:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Template name |
| `description` | string | Template description |
| `jurisdiction` | string | `US` \| `UK` \| `CA` \| `AU` \| `ZA` |
| `serviceType` | string | audit, bookkeeping, tax, advisory, etc. |
| `content` | string | Full letter HTML with placeholders |
| `requiredClauses` | string[] | Required legal clauses (e.g. "limitation-of-liability") |
| `isDefault` | boolean | Default for its jurisdiction + service type |
| `isSystemTemplate` | boolean | Built-in vs custom |
| `version` | string | Template version (e.g. "1.2") |
| `lastReviewedBy` | string | Legal reviewer name |
| `lastReviewedAt` | datetime | Last review date |

System ships with **seed templates** for US, UK, CA, and AU jurisdictions.

---

## 11. Digital Signature Workflow

1. Engagement letter is finalised and approved
2. Firm generates a **signing link** (`/sign/{token}`) — 30-day expiry
3. Link sent to the attention-to contact via email
4. Client opens the letter in the **signing portal** (no login required)
5. Client reviews all sections
6. Client signs using **SignaturePad** (draw / type / upload modes)
7. Signature data captured: image (base64 PNG), signer name, timestamp, IP address, user agent
8. Signing session status → `signed`, letter status → `signed`
9. Activity log entry created
10. Notification sent to the firm user who created the signing link
11. Signed letter stored and both parties notified

See [§27 Client Portal](./27-client-portal.md) for full signing portal details.
