# NorthPact PRD — Data Models (§8)

Complete entity-relationship overview for the NorthPact database. All IDs are UUIDs. Timestamps use ISO 8601 format.

---

## 1. Core Entities

| Entity | Description | Key Relationships |
|--------|-------------|-------------------|
| **Firm** | The accounting firm using NorthPact | Has many Users, Settings |
| **User** | A user account within the firm | Belongs to Firm, creates Proposals |
| **ClientGroup** | A group of related legal entities | Has many Entities, ContactPersons, Proposals |
| **Entity** | A legal entity within a client group | Belongs to ClientGroup, assigned to ProposalItems |
| **ContactPerson** | A person associated with a client group | Belongs to ClientGroup, can be attentionTo on Proposal |
| **ServiceCategory** | A category for organising services | Has many ServiceTemplates |
| **ServiceTemplate** | A reusable service definition | Belongs to ServiceCategory, has many EngagementParagraphs |
| **EngagementParagraph** | A paragraph of engagement letter content | Optionally belongs to ServiceTemplate |
| **Proposal** | A client proposal | Belongs to ClientGroup, has many ProposalItems |
| **ProposalItem** | A service instance within a proposal | Belongs to Proposal, references ServiceTemplate |
| **WorkPlanEntry** | A scheduled deliverable from an accepted proposal | Belongs to ProposalItem |

---

## 2. Entity-Relationship Diagram

```
Firm ──1:N──> User
Firm ──1:N──> ClientGroup ──1:N──> Entity
                          ──1:N──> ContactPerson
Firm ──1:N──> ServiceCategory ──1:N──> ServiceTemplate ──1:N──> EngagementParagraph
Firm ──1:N──> EngagementParagraph (standard, type='standard')
Firm ──1:N──> Proposal ──N:1──> ClientGroup
                       ──N:1──> ContactPerson (attentionTo)
                       ──1:N──> ProposalItem ──N:1──> ServiceTemplate
                                             ──N:M──> Entity (via assignedEntityIds)
                                             ──1:N──> WorkPlanEntry
Firm ──1:1──> FirmSettings
```

---

## 3. Detailed Models

### 3.1 Firm

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `name` | string | Firm display name |
| `email` | string | Primary firm email |
| `phone` | string | Firm phone number |
| `physicalAddress` | text | Firm address |
| `logo` | file reference | Firm logo |
| `registrationNumber` | string | CIPC registration |
| `taxNumber` | string | SARS income tax number |
| `vatNumber` | string | VAT registration |
| `defaultTaxRate` | number | Default 15% |
| `currency` | string | "ZAR" |
| `brandColors` | object | `{ primary: string, secondary: string }` — hex brand colours |
| `createdAt` | datetime | — |
| `updatedAt` | datetime | — |

### 3.2 User

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `firmId` | UUID (FK) | Firm reference |
| `email` | string | Login email |
| `name` | string | Display name |
| `role` | enum | `owner` \| `admin` \| `senior` \| `staff` \| `view-only` |
| `authUserId` | string | External auth provider ID |
| `isActive` | boolean | Whether user can log in |
| `createdAt` | datetime | — |

### 3.3 ClientGroup

See [§3 Client Management](./03-client-management.md) for full field listing.

### 3.4 Entity

See [§3 Client Management](./03-client-management.md) for full field listing.

### 3.5 ContactPerson

See [§3 Client Management](./03-client-management.md) for full field listing.

### 3.6 ServiceCategory

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `firmId` | UUID (FK) | Firm reference |
| `name` | string | Category name (e.g. "Bookkeeping") |
| `icon` | string | Lucide icon name |
| `colour` | string | Category colour identifier |
| `sortOrder` | number | Display order |
| `isActive` | boolean | Whether category is visible |
| `createdAt` | datetime | — |
| `updatedAt` | datetime | — |

### 3.7 ServiceTemplate

See [§4 Service Catalog](./04-service-catalog.md) for full field listing.

### 3.8 EngagementParagraph

See [§6 Engagement Letters](./06-engagement-letters.md) for full field listing.

### 3.9 Proposal

See [§5 Proposal Builder](./05-proposal-builder.md) section 9 for full field listing.

### 3.10 ProposalItem

See [§5 Proposal Builder](./05-proposal-builder.md) section 5 for full field listing.

### 3.11 WorkPlanEntry

See [§7 Work Planning](./07-work-planning.md) for full field listing.

---

## 4. Additional Entities (from Root Project)

The root NorthPact project includes the following additional tables not covered above. These represent production features that must be carried into the new build.

### 4.1 ProposalVersion

Version history for proposals. See [§26 Proposal Versioning](./26-proposal-versioning.md).

### 4.2 ProposalAcceptSession

Token-based client accept/reject sessions. See [§27 Client Portal](./27-client-portal.md).

### 4.3 SigningSession

Token-based engagement letter signing. See [§27 Client Portal](./27-client-portal.md).

### 4.4 ApprovalRequest

Proposal approval workflow records. See [§22 Approval Workflow](./22-approval-workflow.md).

### 4.5 Email

Email queue and tracking records. See [§25 Email System](./25-email-system.md).

### 4.6 Notification

In-app notification records. See [§24 Notifications](./24-notifications.md).

### 4.7 Presence

Real-time collaboration presence records. See [§23 Collaboration](./23-collaboration.md).

### 4.8 Activity (Audit Log)

Audit trail for all entity actions. See [§31 Admin Panel](./31-admin-panel.md).

### 4.9 ProposalView

Proposal view tracking (IP, user-agent, duration). See [§25 Email System](./25-email-system.md).

### 4.10 ProposalTemplate

Proposal document templates with section configuration. See [§30 Proposal Templates](./30-proposal-templates.md).

### 4.11 PackageTemplate

Pre-configured service bundles. See [§30 Proposal Templates](./30-proposal-templates.md).

### 4.12 LetterTemplate

Engagement letter templates by jurisdiction and service type. Fields: `name`, `description`, `jurisdiction`, `serviceType`, `content` (HTML), `requiredClauses`, `isDefault`, `isSystemTemplate`, `version`, `lastReviewedBy`, `lastReviewedAt`.

### 4.13 EngagementLetterVersion (Scope Library)

Multiple letter versions per firm for the scope library. Fields: `firmId`, `name`, `introduction`, `scope`, `sortOrder`.

### 4.14 ServiceSection

Service category sections with icon, color, publish status. See [§4 Service Catalog](./04-service-catalog.md).

### 4.15 Principal

Key people for engagement letters. Fields: `firmId`, `name`, `qualification`, `signatureStorageId`, `roles` (director/principal/statutory-auditor), `sortOrder`.

### 4.16 PricingToolSettings

Firm-level pricing configuration. See [§28 Pricing Intelligence](./28-pricing-intelligence.md).

### 4.17 IntegrationConnection

OAuth tokens for integrations (Xero). See [§35 Apps Map](./35-apps-map.md).

### 4.18 FirmIntegration

Which integrations are added to the Apps Map. See [§35 Apps Map](./35-apps-map.md).

### 4.19 IntegrationSyncLog

Sync history per integration. See [§35 Apps Map](./35-apps-map.md).

### 4.20 IntegrationAutomation

Automation configuration per integration. See [§35 Apps Map](./35-apps-map.md).

### 4.21 Document / DocumentVersion

Document stubs for future document management. Fields: `firmId`, `documentNumber`, `documentType`, `title`, `clientId`, `status`, `total`, `currency`.

---

## 5. Complete Table Summary

| # | Table | Records | Primary Relationships |
|---|-------|---------|-----------------------|
| 1 | `firms` | Settings, branding, subscription | Root entity |
| 2 | `users` | Staff, roles, auth | → Firm |
| 3 | `clients` (→ ClientGroup in new build) | Contacts, entities | → Firm |
| 4 | `serviceSections` | Service categories | → Firm |
| 5 | `services` (→ ServiceTemplate) | Line items, pricing | → Firm, → Section |
| 6 | `proposals` | Proposals with services | → Firm, → Client |
| 7 | `proposalVersions` | Version history | → Proposal |
| 8 | `engagementLetters` | Letters of engagement | → Proposal, → Client |
| 9 | `engagementLetterVersions` | Scope library | → Firm |
| 10 | `letterTemplates` | Letter templates by jurisdiction | Global |
| 11 | `proposalTemplates` | Proposal doc templates | → Firm |
| 12 | `packageTemplates` | Service bundles | → Firm |
| 13 | `proposalViews` | View tracking | → Proposal |
| 14 | `activities` | Audit log | → Firm, → User |
| 15 | `presence` | Real-time collaboration | → Proposal, → User |
| 16 | `approvalRequests` | Approval workflow | → Proposal |
| 17 | `emails` | Email queue & tracking | → Proposal |
| 18 | `proposalAcceptSessions` | Client accept/reject | → Proposal |
| 19 | `signingSessions` | Letter signing | → EngagementLetter |
| 20 | `notifications` | In-app notifications | → User |
| 21 | `documents` / `documentVersions` | Document stubs | → Client |
| 22 | `integrationConnections` | OAuth tokens | → Firm |
| 23 | `firmIntegrations` | Apps map cards | → Firm |
| 24 | `integrationSyncLogs` | Sync history | → Firm |
| 25 | `integrationAutomations` | Automation config | → Firm |
| 26 | `principals` | Key people / signatories | → Firm |
| 27 | `pricingToolSettings` | Pricing config | → Firm (singleton) |

---

## 6. Indexes (Recommended)

| Table | Index | Purpose |
|-------|-------|---------|
| `clientGroups` | `firmId` | List groups per firm |
| `clientGroups` | `firmId, name` | Search by name |
| `entities` | `clientGroupId` | List entities per group |
| `entities` | `xeroContactId` | Xero sync lookup |
| `contactPersons` | `clientGroupId` | List contacts per group |
| `serviceTemplates` | `firmId, categoryId` | List services per category |
| `serviceTemplates` | `firmId, isActive` | Active services for catalog |
| `proposals` | `firmId` | List proposals per firm |
| `proposals` | `firmId, status` | Filter by status |
| `proposals` | `clientGroupId` | Proposals per client |
| `proposalItems` | `proposalId` | Items per proposal |
| `engagementParagraphs` | `firmId, type` | Standard vs service-specific |
| `engagementParagraphs` | `serviceTemplateId` | Paragraphs per service |
| `workPlanEntries` | `proposalId` | Entries per proposal |
| `workPlanEntries` | `firmId, month, status` | Monthly work view |

---

## 7. Data Integrity Rules

| Rule | Enforcement |
|------|-------------|
| Every record has a `firmId` | Multi-tenant isolation |
| `clientGroupId` on Entity must reference a group in the same firm | FK + application check |
| `assignedEntityIds` on ProposalItem must reference entities in the proposal's client group | Application validation |
| `customEntityPrices` keys must be valid entity IDs from `assignedEntityIds` | Application validation |
| Deleting a ServiceTemplate used in active proposals must be prevented | Application check |
| Archiving a ClientGroup preserves all linked proposals | Soft delete only |
| Proposal status transitions follow: draft → pending-approval → approved → sent → viewed → accepted/rejected/expired | State machine enforcement |
