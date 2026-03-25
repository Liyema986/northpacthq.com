# NorthPact PRD — Email System

**Source:** Root NorthPact `convex/email.ts`, `convex/emailHelpers.ts`, `convex/emailScheduling.ts`, `convex/schema.ts`

---

## 1. Overview

NorthPact has a comprehensive **email management system** built on Resend for transactional email delivery. It supports immediate sending, scheduled sending, open tracking, bounce handling, and automated "Wahoo" emails triggered on proposal acceptance.

---

## 2. Data Model — Email

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `proposalId` | UUID (FK) | Related proposal |
| `to` | string | Recipient email address |
| `subject` | string | Email subject line |
| `status` | enum | `queued` \| `scheduled` \| `sent` \| `failed` \| `opened` |
| `resendId` | string (optional) | Resend API message ID (for tracking) |
| `scheduledAt` | datetime (optional) | When to send (for scheduled emails) |
| `sentAt` | datetime (optional) | When actually sent |
| `error` | string (optional) | Error message if failed |
| `createdBy` | UUID (FK) | User who initiated the email |
| `createdAt` | datetime | Creation timestamp |

### Database Indexes

| Index | Fields | Purpose |
|-------|--------|---------|
| `by_firm` | `firmId` | List emails for a firm |
| `by_proposal` | `proposalId` | List emails for a proposal |
| `by_status` | `status` | Filter by status |
| `by_scheduled` | `status`, `scheduledAt` | Find scheduled emails due for sending |
| `by_resend_id` | `resendId` | Look up by Resend message ID (webhook handling) |

---

## 3. Sending Modes

### 3.1 Immediate Send

1. User clicks "Send Proposal" on proposal detail page
2. System checks if `requireApprovalBeforeSend` is enabled — if so, verifies proposal is `approved`
3. Email record created with `status: queued`
4. `sendProposalEmail` action runs:
   - Generates a **proposal accept session** with unique token
   - Builds email HTML with firm branding and proposal details
   - Attaches PDF if available
   - Sends via Resend API
   - Updates email record with `resendId` and `status: sent`
   - Updates proposal status to `sent`
5. Audit log entry created

### 3.2 Scheduled Send

1. User clicks "Schedule Send" and selects date/time
2. Email record created with `status: scheduled` and `scheduledAt` timestamp
3. Background job (`processScheduledEmail`) runs periodically:
   - Queries emails where `status = 'scheduled'` and `scheduledAt <= now`
   - Processes each email using the same pipeline as immediate send
4. Convex scheduler (`scheduler.runAfter`) is used to trigger at the correct time

---

## 4. Email Tracking

### 4.1 Open Tracking

- A **1×1 transparent tracking pixel** is embedded in proposal emails
- When the client opens the email and loads images, the pixel URL is requested
- Route: `GET /api/track-open/:proposalId` returns a 1×1 GIF
- The `trackProposalOpen` action logs the open event
- Email status updated to `opened`
- Proposal view logged with IP and user agent

### 4.2 Resend Webhooks

- Route: `POST /api/webhooks/resend`
- Handles events: `email.opened`, `email.bounced`, `email.delivered`
- Updates email record status via `resendId` lookup
- Logs bounced emails for follow-up

---

## 5. Proposal Accept Session

When a proposal email is sent, an **accept session** is created:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `proposalId` | UUID (FK) | Related proposal |
| `token` | string (64 chars) | Secure random token for the accept link |
| `status` | enum | `pending` \| `accepted` \| `rejected` |
| `expiresAt` | datetime | Session expiry (matches proposal validity) |
| `acceptedAt` | datetime (optional) | When client accepted |
| `rejectedAt` | datetime (optional) | When client rejected |
| `signerName` | string (optional) | Name of the person who signed |
| `signatureImage` | string (optional) | Base64 PNG of signature |
| `ipAddress` | string (optional) | Client's IP address |
| `userAgent` | string (optional) | Client's browser user agent |
| `createdAt` | datetime | Creation timestamp |

### Database Indexes

| Index | Fields |
|-------|--------|
| `by_firm` | `firmId` |
| `by_proposal` | `proposalId` |
| `by_token` | `token` |

---

## 6. Wahoo Emails (Post-Acceptance Automation)

When a client accepts a proposal, automated "Wahoo" emails are sent to both the client and firm staff.

### 6.1 Template Types

| Template Type | Trigger |
|---------------|---------|
| `signed` | Client accepts WITH a signature image |
| `acceptance` | Client accepts WITHOUT a signature (button-only acceptance) |

### 6.2 Template Structure (per type)

| Recipient | Fields |
|-----------|--------|
| **Client** | `clientSubject`, `clientContent` |
| **Additional Signatory** | `additionalSignatorySubject`, `additionalSignatoryContent` |
| **Staff** | `staffSubject`, `staffContent` |
| **CC** | `additionallyEmailTo` (extra email address) |

### 6.3 Merge Tags

| Tag | Replaced With |
|-----|---------------|
| `[first_name]` | Client's first name |
| `[last_name]` | Client's last name |
| `[company_name]` | Client company name |
| `[proposal_title]` | Proposal title |
| `[proposal_number]` | Proposal number |
| `[firm_name]` | Firm name |
| `[total]` | Proposal total amount |
| `[currency]` | Currency code |
| `[date]` | Current date |

### 6.4 Configuration

Wahoo email templates are configured in **Settings → Engagement Letters → Emails** and stored on the `firms` table as `engagementEmailTemplates`:

```
engagementEmailTemplates: {
  signed: {
    clientSubject, clientContent,
    additionalSignatorySubject, additionalSignatoryContent,
    staffSubject, staffContent,
    additionallyEmailTo
  },
  acceptance: {
    clientSubject, clientContent,
    additionalSignatorySubject, additionalSignatoryContent,
    staffSubject, staffContent,
    additionallyEmailTo
  }
}
```

---

## 7. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proposals/:id/send-email` | Send proposal email immediately |
| POST | `/api/proposals/:id/schedule-email` | Schedule proposal email for future date |
| GET | `/api/proposals/:id/emails` | List emails sent for this proposal |
| POST | `/api/webhooks/resend` | Resend webhook handler (open/bounce events) |
| GET | `/api/track-open/:proposalId` | Email open tracking pixel |
| GET | `/api/settings/email-templates` | Get Wahoo email templates |
| PUT | `/api/settings/email-templates` | Update Wahoo email templates |

---

## 8. Email Provider

| Setting | Value |
|---------|-------|
| Provider | **Resend** |
| SDK | `resend` npm package |
| Features used | Send email, attachments (PDF), tracking |
| Webhook events | `email.opened`, `email.bounced`, `email.delivered` |
