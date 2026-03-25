# NorthPact PRD — Approval Workflow

**Source:** Root NorthPact `convex/approvals.ts`, `convex/schema.ts` (approvalRequests table)

---

## 1. Overview

NorthPact includes a configurable **proposal approval workflow** that prevents proposals from being sent to clients without review by an authorised senior user. When enabled (via `requireApprovalBeforeSend` in firm settings), proposals in draft must go through an approval cycle before they can be emailed to clients.

---

## 2. Workflow

```
Draft
  │
  ├──[requireApprovalBeforeSend = false]──→ Send directly
  │
  └──[requireApprovalBeforeSend = true]
        │
        ▼
  Request Approval (select approver + optional message)
        │
        ▼
  Pending Approval
        │
        ├──[Approved]──→ Approved ──→ Can now send to client
        │
        └──[Rejected (comment required)]──→ Back to Draft (with feedback)
```

### Proposal Status Flow (with Approval)

`draft` → `pending-approval` → `approved` → `sent` → `viewed` → `accepted` / `rejected` / `expired`

---

## 3. Data Model — ApprovalRequest

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `proposalId` | UUID (FK) | Proposal being reviewed |
| `requestedBy` | UUID (FK) | User who requested approval |
| `assignedTo` | UUID (FK) | Approver (must have `canApproveProposals` permission) |
| `message` | string (optional) | Optional message from requester to approver |
| `status` | enum | `pending` \| `approved` \| `rejected` |
| `reviewedBy` | UUID (FK, optional) | User who reviewed (same as assignedTo) |
| `reviewComment` | string (optional) | Comment from reviewer (required for rejection) |
| `requestedAt` | datetime | When approval was requested |
| `reviewedAt` | datetime (optional) | When approval was reviewed |

### Database Indexes

| Index | Fields | Purpose |
|-------|--------|---------|
| `by_firm` | `firmId` | List approvals for a firm |
| `by_proposal` | `proposalId` | Get approval for a specific proposal |
| `by_assignee` | `assignedTo`, `status` | List pending approvals for an approver |
| `by_requester` | `requestedBy` | List user's own requests |

---

## 4. Business Rules

| Rule | Detail |
|------|--------|
| Only users with `canApproveProposals` can be selected as approvers | Roles: owner, admin, senior |
| Only draft proposals can request approval | Status must be `draft` |
| One pending approval per proposal at a time | Reject existing before re-requesting |
| Rejection requires a comment | Provides feedback for the requester |
| Rejection returns proposal to `draft` | Requester can edit and re-request |
| Approval changes proposal status to `approved` | Can now be sent to client |
| Both request and review create notifications | In-app notification for the recipient |
| Both request and review are audit-logged | Activity record with metadata |

---

## 5. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proposals/:id/request-approval` | Request approval (body: `assignedTo`, `message?`) |
| POST | `/api/approvals/:id/approve` | Approve (body: `comment?`) |
| POST | `/api/approvals/:id/reject` | Reject (body: `comment` — required) |
| GET | `/api/proposals/:id/approval` | Get latest approval request for a proposal |
| GET | `/api/approvals/pending` | List pending approvals for current user |
| GET | `/api/approvals/metrics` | Approval metrics (pending, approved, rejected, avg time) |
| GET | `/api/approvals/approvers` | List users who can approve proposals |

---

## 6. Approval Metrics

| Metric | Calculation |
|--------|-------------|
| **Pending** | Count where `status = 'pending'` |
| **Approved** | Count where `status = 'approved'` |
| **Rejected** | Count where `status = 'rejected'` |
| **Avg Approval Time** | Mean of `(reviewedAt - requestedAt)` for completed requests, in hours |

---

## 7. UI Components

| Component | Location | Description |
|-----------|----------|-------------|
| **Request Approval Button** | Proposal detail page | Opens modal to select approver and add optional message |
| **Approver Select** | Approval modal | Dropdown of users with `canApproveProposals` (name, email, role) |
| **Pending Approval Badge** | Proposal card / list | Visual indicator that proposal is awaiting approval |
| **Approval Panel** | Proposal detail page | Shows approval status, approver name, comment, timestamps |
| **Pending Approvals List** | Dashboard / Admin | Table of pending approvals with proposal title, requester, time elapsed |
| **Approve / Reject Actions** | Approval panel | Approve button + reject button (with required comment field) |

---

## 8. Firm Setting

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `requireApprovalBeforeSend` | boolean | false | When true, proposals must be approved before sending |

When disabled, proposals can be sent directly from draft status without going through the approval cycle.
