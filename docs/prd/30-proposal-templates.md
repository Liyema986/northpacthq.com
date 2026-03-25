# NorthPact PRD — Proposal Templates & Package Templates

**Source:** Root NorthPact `convex/templates.ts`, `convex/packageTemplates.ts`, `convex/schema.ts`

---

## 1. Overview

NorthPact supports two types of reusable templates for proposal creation:

- **Proposal Templates**: Define the structure, content, and visual sections of a proposal document
- **Package Templates**: Define bundles of pre-selected services that can be quickly applied during proposal creation

---

## 2. Proposal Templates

### 2.1 Data Model — ProposalTemplate

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `name` | string | Template name (e.g. "Standard Audit Proposal") |
| `description` | string (optional) | Description |
| `serviceType` | string | Type: `audit` \| `bookkeeping` \| `tax` \| `advisory` \| `payroll` \| `other` |
| `introText` | string | Default introduction text for proposals |
| `termsText` | string | Default terms and conditions text |
| `footerText` | string (optional) | Footer text |
| `isDefault` | boolean | Whether this is the default template for its type |
| `createdBy` | UUID (FK) | Creator |
| `createdAt` | datetime | Creation timestamp |
| `updatedAt` | datetime | Last modification |
| `minimumMonthlyFee` | number (optional) | Min fee for proposals using this template |
| `proposalType` | string (optional) | e.g. "proposal" |
| `documentsToSend` | string (optional) | e.g. "Proposal & Letter of Engagement" |
| `redirectOnAcceptUrl` | string (optional) | URL to redirect client after acceptance |
| `emailDeliverability` | enum (optional) | `high` \| `low` |
| `sortOrder` | number (optional) | Display order |

### 2.2 Section Configuration

Each template has a `sectionConfig` object controlling which visual sections appear in the proposal:

| Section Toggle | Type | Description |
|----------------|------|-------------|
| `acceptanceEnabled` | boolean | Show acceptance section |
| `halfPageGraphicEnabled` | boolean | Include half-page graphic |
| `testimonial1Enabled` | boolean | Show first testimonial |
| `fullPageGraphic1Enabled` | boolean | Include first full-page graphic |
| `proposalIntroduction` | string | Custom introduction paragraph |
| `testimonial2Enabled` | boolean | Show second testimonial |
| `feesIntroductionParagraph` | string | Text before the fee schedule |
| `pleaseNote` | string | "Please note" section text |
| `whatHappensNextText` | string | "What happens next" section text |
| `fullPageGraphic2Enabled` | boolean | Include second full-page graphic |
| `selectedServicesText` | string | Text for selected services section |
| `upsellSectionText` | string | Upsell/consider section text |
| `testimonial3Enabled` | boolean | Show third testimonial |
| `fullPageGraphic3Enabled` | boolean | Include third full-page graphic |

### 2.3 Template Operations

| Operation | Permission | Description |
|-----------|------------|-------------|
| List | Any authenticated user | List templates filtered by service type |
| Get | Any authenticated user | Get single template |
| Get Default | Any authenticated user | Get default template for a service type |
| Create | `canManageTemplates` | Create new template |
| Update | `canManageTemplates` | Update template |
| Delete | `canManageTemplates` | Delete template |
| Set Default | `canManageTemplates` | Mark as default for its service type |
| Reorder | `canManageTemplates` | Change display order |
| Export | `canManageTemplates` | Export as JSON |
| Import | `canManageTemplates` | Import from JSON |

---

## 3. Package Templates

### 3.1 Data Model — PackageTemplate

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `name` | string | Package name (e.g. "New Client — Standard") |
| `template` | string | e.g. "New Client" (from firm's `packageTemplateOptions`) |
| `documentsToSend` | string | e.g. "Proposal" (from firm's `packageDocumentsOptions`) |
| `annualRevenueRange` | string | e.g. "Not Applicable", "Up to R1M" |
| `incomeTaxRange` | string | e.g. "Not Applicable", "Less than R1m" |
| `addProjectName` | boolean | Whether to prompt for project name |
| `includedServiceIds` | UUID[] | Array of service IDs included in this package |
| `includedServiceSettings` | Record | Per-service variation selections: `{ [serviceId]: { [variationId]: selectedOptionLabel } }` |
| `sortOrder` | number | Display order |
| `createdAt` | datetime | Creation timestamp |
| `updatedAt` | datetime | Last modification |

### 3.2 How Packages Work in Proposal Builder

During the **6-step proposal creation wizard** (Step 3 — "Select Package"):

1. User selects a package template
2. All services in `includedServiceIds` are pre-loaded into the proposal
3. Per-service variation settings from `includedServiceSettings` are applied
4. Revenue and income tax ranges from the package are pre-populated
5. User can still add/remove services and adjust pricing in subsequent steps

### 3.3 Package Dropdown Options

The options available in the package template form come from firm settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `packageTemplateOptions` | Dropdown options for "Template" field | `["New Client", "Virtual: New Client"]` |
| `packageDocumentsOptions` | Dropdown options for "Documents" field | `["Proposal & Letter of Engagement", "Proposal"]` |

---

## 4. Document Types

Proposals can be one of several document types (configured in firm settings):

| Type | Description |
|------|-------------|
| `proposal_only` | Standard proposal document |
| `letter_only` | Letter of engagement only |
| `proposal_and_letter` | Both proposal and engagement letter |
| `quote` | Quote/estimate format |

The available document types are configured via `proposalBuilderDocumentTypes` in firm settings.

---

## 5. API Endpoints

### Proposal Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/templates?serviceType=...` | List templates, optionally by service type |
| GET | `/api/templates/:id` | Get single template |
| GET | `/api/templates/default?serviceType=...` | Get default template for a service type |
| POST | `/api/templates` | Create template |
| PUT | `/api/templates/:id` | Update template |
| DELETE | `/api/templates/:id` | Delete template |
| PUT | `/api/templates/:id/default` | Set as default |
| PUT | `/api/templates/:id/reorder` | Reorder |
| GET | `/api/templates/:id/export` | Export as JSON |
| POST | `/api/templates/import` | Import from JSON |

### Package Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/packages` | List package templates for firm |
| GET | `/api/packages/:id` | Get single package |
| POST | `/api/packages` | Create package |
| PUT | `/api/packages/:id` | Update package |
| DELETE | `/api/packages/:id` | Delete package |
