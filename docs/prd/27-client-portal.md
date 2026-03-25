# NorthPact PRD — Client Portal & Signature

**Source:** Root NorthPact `convex/proposalAccept.ts`, `convex/signatures.ts`, `app/proposals/view/[token]/page.tsx`, `app/sign/[token]/page.tsx`

---

## 1. Overview

NorthPact provides a **public-facing client portal** for proposal viewing and acceptance, and a separate **signing portal** for engagement letters. Both use token-based access with no authentication required from the client.

---

## 2. Proposal Client Portal

### 2.1 Access Flow

1. Firm sends proposal via email
2. Email contains a unique link: `/proposals/view/{token}`
3. Client clicks link → public proposal view loads (no login required)
4. System verifies token validity and expiry
5. Client can view, accept, or reject

### 2.2 Client View Content

| Section | Content |
|---------|---------|
| **Firm Branding** | Firm logo, brand colors (primary + secondary) |
| **Proposal Header** | Title, proposal number, date |
| **PDF Preview** | If a PDF has been generated, it's displayed in-browser |
| **Service Summary** | List of services with pricing |
| **Total** | Proposal total amount |
| **Firm Details** | Footer text, address, disclaimer, sign-off block, banking details |
| **Cover/Footer Images** | Firm's PDF cover image, footer image, last page image |

### 2.3 Acceptance Flow

1. Client reviews proposal
2. Client enters their **signer name**
3. Client optionally draws/types/uploads a **signature**
4. Client clicks "Accept"
5. System records acceptance with metadata:
   - Signer name
   - Signature image (base64 PNG data URL)
   - IP address
   - User agent
   - Timestamp
6. Proposal status changes to `accepted`
7. Signature data stored on both the accept session and the proposal
8. **Wahoo emails** automatically triggered (client + staff templates)
9. Activity log entry created

### 2.4 Rejection Flow

1. Client clicks "Decline"
2. System records rejection with IP and user agent
3. Proposal status changes to `rejected`
4. Activity log entry created

### 2.5 Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Token not found | Error: "Link not found" |
| Session already accepted | Shows resolved status page with details |
| Session already rejected | Shows resolved status page with details |
| Token expired | Error: "This link has expired" |
| Proposal deleted | Error: "Proposal not found" |

---

## 3. Signature System

### 3.1 SignaturePad Component

The signature capture supports three input modes:

| Mode | Description |
|------|-------------|
| **Draw** | Canvas-based drawing with `react-signature-canvas` |
| **Type** | Text input rendered as cursive signature |
| **Upload** | File upload of signature image |

### 3.2 Signature Validation

| Rule | Detail |
|------|--------|
| Must be a valid data URL | Starts with `data:image/` |
| Supported formats | PNG, JPG, WebP |
| Maximum size | ~1.1 MB base64 (fits within Convex document limits) |
| Empty signatures | Rejected with error |
| Signer name required | Cannot submit without a name |

### 3.3 Signature Storage

Signatures are stored as base64 data URLs directly on:
- The `proposalAcceptSessions` record
- The `proposals` record (in `signatureData` object)
- The `engagementLetters` record (for engagement letter signing)

Signature data includes: `signerName`, `signatureImage`, `signedAt`, `ipAddress`, `userAgent`

---

## 4. Engagement Letter Signing Portal

### 4.1 Access Flow

1. Firm generates a signing link for an engagement letter
2. Link format: `/sign/{token}`
3. Token is 64 characters, randomly generated
4. Token expires after **30 days**

### 4.2 Signing Session Data Model

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `letterId` | UUID (FK) | Engagement letter being signed |
| `token` | string (64 chars) | Secure random access token |
| `status` | enum | `pending` \| `signed` \| `expired` |
| `createdBy` | UUID (FK) | User who created the signing link |
| `expiresAt` | datetime | 30 days from creation |
| `signedAt` | datetime (optional) | When signed |
| `createdAt` | datetime | Creation timestamp |

### 4.3 Signing Page Content

| Section | Content |
|---------|---------|
| **Firm name** | Name of the accounting firm |
| **Client name** | Client company name |
| **Letter content** | Full engagement letter HTML |
| **Letter number** | e.g. "ENG-2026-001" |
| **SignaturePad** | Draw / Type / Upload modes |
| **Signer details** | Name, IP address, user agent |

### 4.4 On Signing

1. Signing session status → `signed`
2. Engagement letter status → `signed`
3. Signature data stored on letter: `signerName`, `signatureImage`, `signedAt`, `ipAddress`, `userAgent`
4. Activity log entry created
5. Notification sent to the firm user who created the signing link
6. Signing session timestamp recorded

---

## 5. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proposals/accept/:token` | Get proposal accept session (public, no auth) |
| POST | `/api/proposals/accept/:token/accept` | Accept proposal with signature |
| POST | `/api/proposals/accept/:token/reject` | Reject proposal |
| POST | `/api/engagement-letters/:id/signing-link` | Generate signing link |
| GET | `/api/signing/:token` | Get signing session details (public, no auth) |
| POST | `/api/signing/:token/submit` | Submit engagement letter signature |
| GET | `/api/signing-sessions` | List signing sessions for firm |

---

## 6. Security Considerations

| Aspect | Detail |
|--------|--------|
| No authentication required for client actions | Token-based access only |
| Tokens are 64-char random strings | High entropy, not guessable |
| Sessions expire | Proposal: based on `validUntil`; Signing: 30 days |
| IP and user agent recorded | Legal audit trail for signature validity |
| Signature images validated | Format and size checks before storage |
| Already-actioned sessions show status | Cannot double-accept or double-reject |
