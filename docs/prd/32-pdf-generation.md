# NorthPact PRD — PDF Generation

**Source:** Root NorthPact `components/ProposalPDF.tsx`, `lib/pdf-proposal-data.ts`, `convex/pdfGeneration.ts`

---

## 1. Overview

NorthPact generates professional **PDF documents** for proposals and engagement letters. PDFs are generated using **jsPDF + html-to-image** and can be previewed in-app during proposal creation, downloaded, and attached to emails sent to clients.

---

## 2. PDF Components

### 2.1 Proposal PDF

The proposal PDF is a multi-page document containing:

| Section | Content |
|---------|---------|
| **Cover Page** | Firm logo, proposal title, client name, date, optional cover image |
| **Introduction** | Custom intro text from proposal or template |
| **Entity Details** | List of entities with type, revenue range, tax range |
| **Service Schedule** | Services grouped by section with descriptions, pricing |
| **Fee Summary** | Monthly, yearly, once-off breakdowns with totals |
| **What Happens Next** | Optional section from template |
| **Terms & Conditions** | Custom terms text from proposal or template |
| **Acceptance Section** | Signature block (optional, configurable per template) |
| **Testimonials** | Optional testimonial sections (1-3, from template config) |
| **Full-Page Graphics** | Optional graphic pages (1-3, from template config) |
| **Footer** | Firm name, address, disclaimer on every page |
| **Last Page** | Optional full-page image/background |

### 2.2 Firm Branding in PDFs

| Setting | Storage | Description |
|---------|---------|-------------|
| `logo` | `_storage` | Default firm logo |
| `logoProposalHeader` | `_storage` | Alternative logo for proposal headers (if `useDifferentLogoProposalHeader` is true) |
| `pdfCoverImage` | `_storage` | Optional cover/first page image |
| `pdfFooterImage` | `_storage` | Optional footer image |
| `pdfLastPageImage` | `_storage` | Optional last page background image |
| `brandColors.primary` | string | Primary color for headers/accents |
| `brandColors.secondary` | string | Secondary color |
| `headingsFont` | string | Font for headings |
| `generalTextFont` | string | Font for body text |

### 2.3 PDF Text Settings

| Setting | Description |
|---------|-------------|
| `pdfFooterText` | Footer text displayed on every page |
| `pdfFooterAddress` | Firm address in footer |
| `pdfDisclaimer` | Disclaimer text |
| `pdfHeaderTitleStyle` | `"default"` or `"minimal"` |
| `pdfSignOffBlock` | Sign-off text (e.g. "Yours sincerely") |
| `pdfBankingDetails` | Banking details for payment |

---

## 3. PDF Data Pipeline

### 3.1 Data Assembly

The `buildProposalPDFData` function assembles all data needed for PDF rendering:

1. Fetch proposal with all services
2. Fetch client details
3. Fetch firm details (branding, logos, text settings)
4. Fetch template section configuration
5. Resolve all storage URLs (logos, images)
6. Compute totals and breakdowns

### 3.2 Storage and Upload

1. PDF rendered client-side: `html-to-image` captures the proposal HTML preview as an image, `jsPDF` composes the final multi-page PDF document
2. PDF blob uploaded to Convex file storage via `generatePdfUploadUrl` mutation
3. Storage ID saved on proposal via `setProposalPdfUrl` mutation
4. PDF URL retrievable via `getProposalPdfUrl` query

---

## 4. Live PDF Preview

During proposal creation (Step 6 — Review):

| Feature | Description |
|---------|-------------|
| **ProposalReviewPDFPreview** | Real-time preview of the PDF as it will be generated |
| **Collapsible** | Preview can be expanded/collapsed |
| **Updates live** | Reflects current proposal data |
| **Before creation** | Shows what the client will receive |

---

## 5. PDF Metadata

| Field | Type | Description |
|-------|------|-------------|
| `proposalId` | UUID | Source proposal |
| `generatedAt` | datetime | When PDF was generated |
| `generatedBy` | UUID | User who triggered generation |
| `storageId` | storage ref | File storage reference |
| `url` | string | Public download URL |

---

## 6. PDF Export Formats

| Format | Method | Use Case |
|--------|--------|----------|
| PDF | `jsPDF` (4.1.0) + `html-to-image` | Primary format for all proposals and engagement letters |
| DOCX | Planned (Phase 4) | Editable format for engagement letters |

---

## 7. Convex Functions (replaces REST endpoints)

| Type | Function | Description |
|------|----------|-------------|
| Query | `api.proposals.getPdfData` | Get all data needed for PDF rendering |
| Mutation | `api.proposals.generatePdfUploadUrl` | Generate Convex storage upload URL for PDF blob |
| Mutation | `api.proposals.setProposalPdfUrl` | Save storage ID on proposal record |
| Query | `api.proposals.getProposalPdfUrl` | Get public PDF download URL from storage ID |
