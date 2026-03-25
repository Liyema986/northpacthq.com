# NorthPact PRD — Admin Panel & User Management

**Source:** Root NorthPact `app/(admin)/admin/page.tsx`, `convex/users.ts`, `convex/lib/permissions.ts`, `convex/lib/auditLog.ts`

---

## 1. Overview

NorthPact includes a comprehensive **admin panel** for firm administrators to manage users, roles, permissions, and monitor firm-wide activity. The admin panel is accessible only to users with the `owner` or `admin` role.

---

## 2. Admin Dashboard Tabs

### 2.1 Overview

| Component | Description |
|-----------|-------------|
| **Stats Cards** | Total users, active proposals, total revenue, recent activity count |
| **Weekly Activity Chart** | Bar chart showing proposal activity over the past weeks |
| **Role Distribution** | Pie chart showing how many users per role |
| **Recent Activity** | Timeline of recent actions across the firm |

### 2.2 Activity Log

Full activity/audit log table with:

| Column | Description |
|--------|-------------|
| User | Who performed the action |
| Action | What was done (see §6 Audit Actions) |
| Entity | What was affected (proposal, client, service, etc.) |
| Timestamp | When it happened |
| Metadata | Additional details (e.g. old/new values) |

### 2.3 Reports

| Report | Description |
|--------|-------------|
| **Proposal Counts** | Total proposals by status |
| **Status Bar Chart** | Visual breakdown of draft, sent, accepted, rejected, expired |
| **Pipeline Summary** | Total value at each stage |
| **Conversion Metrics** | Win rate, average time to accept, average deal size |

### 2.4 Team Members

| Feature | Description |
|---------|-------------|
| User table | List all users with name, email, role, last active, status |
| Role filter | Filter by role |
| Edit role | Change user role (owner cannot be changed) |
| Edit profile | Admin can update user name |
| Deactivate | Set `deactivatedAt` — user cannot log in |
| Reactivate | Clear `deactivatedAt` |
| Remove | Hard delete user (requires `canDeleteRecords`) |

### 2.5 Invite Users

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full name |
| `email` | string | Yes | Email address |
| `role` | enum | Yes | `admin` \| `senior` \| `staff` \| `view-only` |

Invitation creates a user record in the firm. The invited user receives credentials to log in.

### 2.6 Role Management

Visual display of all roles with descriptions and user counts:

| Role | Description |
|------|-------------|
| **Owner** | Full access to everything including firm management and billing |
| **Admin** | Manage users, templates, clients, and all proposals |
| **Senior** | Approve proposals, edit pricing, create proposals |
| **Staff** | Create and send proposals, manage clients |
| **View-only** | Read-only access to proposals and clients |

### 2.7 Permissions Matrix

Interactive grid showing the complete permission matrix:

| Permission | Owner | Admin | Senior | Staff | View-only |
|------------|-------|-------|--------|-------|-----------|
| `canManageFirm` | ✓ | — | — | — | — |
| `canManageBilling` | ✓ | — | — | — | — |
| `canManageUsers` | ✓ | ✓ | — | — | — |
| `canManageTemplates` | ✓ | ✓ | — | — | — |
| `canEditPricing` | ✓ | ✓ | ✓ | — | — |
| `canApproveProposals` | ✓ | ✓ | ✓ | — | — |
| `canCreateProposals` | ✓ | ✓ | ✓ | ✓ | — |
| `canSendProposals` | ✓ | ✓ | ✓ | ✓ | — |
| `canViewProposals` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `canManageClients` | ✓ | ✓ | ✓ | ✓ | — |
| `canViewClients` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `canDeleteRecords` | ✓ | ✓ | — | — | — |
| `canViewReports` | ✓ | ✓ | ✓ | — | — |

### 2.8 Access Audit

Audit log specifically for access-related events:
- Login attempts (successful and failed)
- Role changes
- User invitations and removals
- Deactivation/reactivation events

### 2.9 Settings Links

Quick links to main application settings:
- Profile settings
- Security settings
- Notification preferences
- Danger zone (account deletion, data clear)

---

## 3. User Management API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users in firm |
| POST | `/api/users/invite` | Invite new user |
| PUT | `/api/users/:id/role` | Update user role |
| PUT | `/api/users/:id/profile` | Admin edit user profile |
| PUT | `/api/users/:id/deactivate` | Deactivate user |
| PUT | `/api/users/:id/reactivate` | Reactivate user |
| DELETE | `/api/users/:id` | Remove user |
| PUT | `/api/users/me/profile` | Self profile update |
| GET | `/api/users/me` | Get current user |

---

## 4. Business Rules

| Rule | Detail |
|------|--------|
| Owner role cannot be changed | Protected from demotion |
| Owner role cannot be deleted | At least one owner must exist |
| Only users with `canManageUsers` can invite/edit/remove | Owner and Admin |
| Deactivated users cannot log in | `deactivatedAt` checked on auth |
| Self-profile update available to all | Users can update their own name |
| Sole member fallback | If user is the only firm member, they bypass permission checks |

---

## 5. Authentication System

### 5.1 Login

| Feature | Detail |
|---------|--------|
| Method | Email + password (SHA-256 hashed) |
| Lockout | 5 failed attempts → 15-minute lockout |
| Tracking | `loginAttempts`, `lastLoginAttempt`, `lockedUntil` fields |
| Clerk integration | Optional SSO via Clerk with user sync |
| Clerk webhook | `POST /clerk-webhook` syncs/links Clerk users |

### 5.2 Firm Registration

New firms are created via `registerFirm`:
1. Create firm record with defaults (trial subscription, jurisdiction, currency)
2. Create owner user record
3. Hash password (SHA-256)
4. Return auth session

---

## 6. Audit Log Actions

### 6.1 Action Categories

| Category | Actions |
|----------|---------|
| **Proposals** | `proposal.created`, `proposal.updated`, `proposal.sent`, `proposal.viewed`, `proposal.accepted`, `proposal.rejected`, `proposal.deleted` |
| **Approvals** | `approval.requested`, `approval.approved`, `approval.rejected` |
| **Engagement Letters** | `letter.created`, `letter.sent`, `letter.signed` |
| **Users** | `user.invited`, `user.role_changed`, `user.removed`, `user.deactivated`, `user.activated`, `user.profile_updated` |
| **Clients** | `client.created`, `client.updated`, `client.deleted` |
| **Services** | `service.created`, `service.updated`, `service.deleted` |
| **Templates** | `template.created`, `template.updated`, `template.deleted` |
| **Auth** | `auth.login`, `auth.logout`, `auth.password_changed`, `auth.lockout` |
| **Email** | `email.sent`, `email.bounced`, `email.opened` |
| **PDF** | `pdf.generated`, `pdf.downloaded` |
| **Settings** | `settings.updated`, `firm.updated` |

### 6.2 Entity Types

`proposal`, `client`, `service`, `user`, `firm`, `template`, `approval`, `engagement-letter`, `email`, `pdf`

---

## 7. Rate Limiting

| Limit Type | Window | Max Requests |
|------------|--------|--------------|
| `standard` | Per minute | Default rate |
| `email` | Per hour | Email sending cap |
| `auth` | Per minute | Login attempt limit |
| `report` | Per minute | Report generation limit |

Rate limiting is activity-based, checking recent activity count within the time window.
