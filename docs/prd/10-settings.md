# NorthPact PRD — Settings & Configuration (§6.8)

**Enhanced with root project implementation details**

---

## 1. Firm Details

| Setting | Type | Description |
|---------|------|-------------|
| `name` | string | Firm display name |
| `billingEmail` | string | Primary firm email (also used for Stripe) |
| `phone` | string | Firm phone number |
| `physicalAddress` | text | Firm physical address |
| `firmRegistrationNumber` | string | CIPC registration number |
| `firmTaxNumber` | string | SARS income tax number |
| `vatNumber` | string | VAT registration number |
| `vatRegistered` | boolean | Whether the firm is VAT registered |
| `jurisdiction` | enum | `US` \| `UK` \| `CA` \| `AU` \| `NZ` \| `ZA` |
| `currency` | string | Currency code (e.g. "ZAR", "USD", "GBP") |
| `appLanguage` | string | App language (e.g. "en") |
| `landingPagePreference` | enum | `dashboard` \| `create-proposal` — where users land after login |

---

## 2. Branding

### 2.1 Logo Management

| Setting | Type | Description |
|---------|------|-------------|
| `logo` | file (storage) | Default firm logo |
| `logoProposalHeader` | file (storage) | Alternative logo for proposal headers |
| `useDifferentLogoProposalHeader` | boolean | Use different logo in proposal header |
| `logoCreateProposalPage` | file (storage) | Alternative logo for create proposal page |
| `useDifferentLogoCreateProposalPage` | boolean | Use different logo on create page |
| `bannerImage` | file (storage) | Banner image for proposals |

### 2.2 Colors & Fonts

| Setting | Type | Description |
|---------|------|-------------|
| `brandColors.primary` | hex string | Primary brand color |
| `brandColors.secondary` | hex string | Secondary brand color |
| `headingsFont` | string | Font for headings in PDFs/proposals |
| `generalTextFont` | string | Font for body text in PDFs/proposals |

---

## 3. Proposal Settings

### 3.1 Numbering & Defaults

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `proposalNumberPrefix` | string | "PROP" | Prefix for auto-generated proposal numbers |
| `currentProposalNumber` | number | 1 | Auto-increment counter (next number to use) |
| `defaultProposalValidityDays` | number | 30 | Days until proposal expires |
| `showProposalVersionNumbers` | boolean | false | Show version numbers on proposals |

### 3.2 Proposal Builder Configuration

| Setting | Type | Description |
|---------|------|-------------|
| `proposalBuilderDocumentTypes` | string[] | Available document types: `proposal_only`, `letter_only`, `proposal_and_letter`, `quote` |
| `proposalBuilderEnableQuote` | boolean | Enable quote document type |
| `proposalBuilderRequiredSteps` | string[] | Which builder steps are required ("1" to "6") |
| `proposalBuilderDefaultIntro` | string | Default introduction text for new proposals |
| `proposalBuilderDefaultTerms` | string | Default terms and conditions text |

### 3.3 PDF Generation Settings

| Setting | Type | Description |
|---------|------|-------------|
| `pdfFooterText` | string | Footer text on every PDF page |
| `pdfFooterAddress` | string | Firm address displayed in PDF footer |
| `pdfDisclaimer` | string | Disclaimer text in PDFs |
| `pdfHeaderTitleStyle` | string | `"default"` or `"minimal"` |
| `pdfSignOffBlock` | string | Sign-off text (e.g. "Yours sincerely") |
| `pdfBankingDetails` | string | Banking details for payment reference |
| `pdfCoverImage` | file (storage) | Optional cover/first page image |
| `pdfFooterImage` | file (storage) | Optional footer image |
| `pdfLastPageImage` | file (storage) | Optional last page background image |

### 3.4 Package Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `packageTemplateOptions` | string[] | `["New Client", "Virtual: New Client"]` | Options for package template "Type" dropdown |
| `packageDocumentsOptions` | string[] | `["Proposal & Letter of Engagement", "Proposal"]` | Options for package "Documents" dropdown |

---

## 4. Workflow Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `requireApprovalBeforeSend` | boolean | false | Require partner/admin approval before sending proposals |

See [§22 Approval Workflow](./22-approval-workflow.md) for full details.

---

## 5. Engagement Letter Settings

### 5.1 Suite Global Settings

Stored in `engagementSuiteSettings`:

| Setting | Type | Description |
|---------|------|-------------|
| `termsAndConditions` | string (rich text) | General terms and conditions for engagement letters |
| `privacyNoticeEnabled` | boolean | Whether to include privacy notice |
| `privacyNoticeContent` | string (rich text) | Privacy notice content |
| `scheduleOfServicesIntroduction` | string (rich text) | Introduction text for schedule of services |
| `agreementSignatureVersion` | string (rich text) | Agreement text when signature is included |
| `agreementNoSignatureVersion` | string (rich text) | Agreement text without signature |
| `includePrincipalSignature` | boolean | Whether to include principal's signature |

### 5.2 Key Dates Settings

Stored in `keyDatesSettings`:

| Setting | Type | Description |
|---------|------|-------------|
| `keyDatesTableIntroduction` | string | Introduction text above key dates table |
| `infoDeadlineHeading` | string | Column heading for information deadlines |
| `filingDeadlineHeading` | string | Column heading for filing deadlines |

### 5.3 Wahoo Email Templates

Stored in `engagementEmailTemplates` — two template types (`signed` and `acceptance`):

| Setting | Description |
|---------|-------------|
| `clientSubject` | Email subject for client |
| `clientContent` | Email body for client (supports merge tags) |
| `additionalSignatorySubject` | Subject for additional signatory |
| `additionalSignatoryContent` | Body for additional signatory |
| `staffSubject` | Subject for internal staff notification |
| `staffContent` | Body for internal staff notification |
| `additionallyEmailTo` | Additional email address to CC |

See [§25 Email System](./25-email-system.md) for full Wahoo email details.

---

## 6. Xero Connection

| Setting | Description |
|---------|-------------|
| OAuth 2.0 connection status | Connected / Disconnected indicator |
| Connected organisation name | Name of linked Xero organisation |
| Tenant ID | Xero organisation ID |
| Last sync timestamp | When contacts were last synced |
| Manual sync trigger | Button to trigger manual sync |
| Disconnect option | Remove Xero connection |

See [§11 Xero Integration](./11-xero-integration.md) for full details.

---

## 7. Tax & Billing Defaults

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `defaultTaxRate` | number | 15 | Default VAT rate for South Africa |
| `currency` | string | ZAR | Currency (locked for initial release) |
| `defaultPaymentTerms` | number | 30 | Default payment terms in days |
| `defaultFeeEscalation` | number | — | Default annual fee escalation percentage |

See [§28 Pricing Intelligence](./28-pricing-intelligence.md) for full pricing tool settings.

---

## 8. Subscription & Billing

| Setting | Description |
|---------|-------------|
| Current plan | Starter / Professional / Enterprise |
| Subscription status | Trial / Active / Past Due / Cancelled |
| Trial end date | When trial expires |
| Manage subscription | Link to Stripe customer portal |

See [§33 Subscription & Billing](./33-subscription-billing.md) for full details.

---

## 9. Settings Persistence

**Current state (MVP):** Settings form fields are decorative — no persistence.

**Target state (Production):** All settings stored on the `firms` table with full CRUD via the REST API. Changes apply immediately to all new proposals and engagement letters. Image uploads use file storage with generated upload URLs.

---

## 10. Settings UI Tabs (from Root Project)

| Tab | Sub-sections |
|-----|-------------|
| **Account** | Company & Region, Branding (logo, colors, fonts) |
| **Proposals** | Defaults & Types, Customization, PDF Generation |
| **Pricing** | Plan & Subscription, Currency, Jurisdiction |
| **Workflow** | Package options, Approval settings |
