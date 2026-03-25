# NorthPact PRD — Security & Access Control (§13)

**Enhanced with root project implementation details (5 roles, 13 permissions)**

---

## 1. Authentication

Authentication is fully handled by **Clerk (`@clerk/nextjs` 6.37.3)**. NorthPact does not store or manage passwords.

### 1.1 Login Methods

| Method | Detail |
|--------|--------|
| **Email + Password** | Managed by Clerk — bcrypt hashing, breach detection, complexity enforcement |
| **Google OAuth** | Clerk `oauth_google` strategy |
| **Microsoft OAuth** | Clerk `oauth_microsoft` strategy |
| **MFA** | Supported via Clerk (TOTP / email code) |

### 1.2 Login Security

| Feature | Detail |
|---------|--------|
| **Lockout** | Clerk enforces brute-force protection automatically |
| **Session management** | Clerk manages secure, httpOnly session cookies and JWT rotation |
| **Password complexity** | Enforced by Clerk at registration |
| **Convex JWT** | Clerk issues a JWT; Convex validates it on every request via `ctx.auth.getUserIdentity()` |
| **Clerk webhook** | `POST /api/webhooks/clerk` (Next.js route handler) — syncs Clerk user creation/update/deletion to the Convex `users` table via Svix signature verification |

### 1.3 Firm Registration

1. User signs up via Clerk (email/password or OAuth)
2. Clerk webhook fires → Next.js route handler → `api.users.syncFromClerk` mutation
3. Convex mutation creates `firm` record (defaults: trial subscription, ZA jurisdiction, ZAR currency)
4. Convex mutation creates `user` record with `clerkId`, `firmId`, `role: "owner"`
5. User lands on `/dashboard` — all subsequent auth is handled by Clerk + Convex JWT validation

---

## 2. Authorisation — Role-Based Access Control

### 2.1 Roles (5 roles from root project)

| Role | Description |
|------|-------------|
| **Owner** | Full access to everything including firm management, billing, and user ownership |
| **Admin** | Manage users, templates, clients, and all proposals; cannot manage firm or billing |
| **Senior** | Approve proposals, edit pricing, create proposals, view reports |
| **Staff** | Create and send proposals, manage clients; cannot approve, edit pricing, or view reports |
| **View-only** | Read-only access to proposals and clients |

### 2.2 Permission Matrix (13 permissions)

| Permission | Owner | Admin | Senior | Staff | View-only |
|------------|:-----:|:-----:|:------:|:-----:|:---------:|
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

### 2.3 Management PRD Role Mapping

The management PRD specified 4 roles (Admin, Partner, Manager, Staff). These map to the root project roles:

| Management PRD Role | Root Project Role | Notes |
|---------------------|-------------------|-------|
| Admin | Owner + Admin | Combined as top-tier |
| Partner | Senior | Approval authority |
| Manager | Staff | Create + edit own |
| Staff | View-only | Read-only access |

### 2.4 Permission Enforcement Pipeline

```
Every Convex query or mutation:
  1. ctx.auth.getUserIdentity() → validate Clerk JWT
  2. Look up Convex user record by clerkId → get role and firmId
  3. Check role has required permission via ROLE_PERMISSIONS map
  4. Verify firmId scope (multi-tenant isolation) via verifyFirmAccess()
  5. Sole-member fallback: if user is the only member of their firm, bypass permission check
  6. Allow or throw ConvexError with specific error message
```

### 2.5 Utility Functions

| Function | Purpose |
|----------|---------|
| `hasPermission(role, permission)` | Check if role has a specific permission |
| `getPermissionsForRole(role)` | Get all permissions for a role |
| `verifyFirmAccess(ctx, userId, firmId)` | Verify user belongs to firm (Row-Level Security) |
| `getAuthenticatedUser(ctx, userId)` | Get user or throw |
| `checkPermission(ctx, userId, permission)` | Check permission, return boolean |
| `requirePermission(ctx, userId, permission)` | Check permission, throw if denied |
| `getUserFirmId(ctx, userId)` | Get user's firmId |
| `getUserFirmIdSafe(ctx, userId)` | Get firmId or null (non-throwing) |
| `withFirmScope(ctx, userId)` | Get firmId + user + permission checker helper |

### 2.6 Special Rules

| Rule | Detail |
|------|--------|
| **Owner protection** | Owner role cannot be changed or removed by anyone |
| **Sole member fallback** | If a user is the only member of their firm, they are treated as having all permissions (prevents lockout) |
| **Deactivation** | Admin sets `deactivatedAt` timestamp → user cannot log in |

---

## 3. Data Security

| Measure | Detail |
|---------|--------|
| **Encryption at rest** | Convex encrypts all stored data at rest (AES-256) |
| **Encryption in transit** | TLS 1.3 for all data in transit (Convex + Clerk + Vercel) |
| **POPIA compliance** | South African personal data protection requirements met |
| **Xero tokens** | OAuth tokens stored in Convex `integrationConnections` table, scoped by `firmId` |
| **Rate limiting** | Convex function-level rate limits; Next.js middleware rate limits for webhook routes |
| **Input validation** | Convex argument validators (`v.string()`, `v.number()`, etc.) on every function; Zod schemas on all forms |
| **Injection** | Not applicable — Convex uses a typed document model, not SQL |
| **XSS prevention** | Next.js default CSP headers; React's JSX escaping; `worker-src 'self' blob:` for Clerk CAPTCHA |
| **CSRF protection** | Clerk handles CSRF for auth flows; Convex uses JWT auth (not cookies) for mutations |
| **Signature validation** | data URL format check, image type check, 1.5MB size limit |
| **Password storage** | Managed entirely by Clerk — NorthPact never stores passwords |

---

## 4. Multi-Tenant Isolation

| Rule | Enforcement |
|------|-------------|
| Every database record has `firmId` | Schema-level constraint on all tables |
| All queries filter by `firmId` | Application-level via `withFirmScope` / `getUserFirmId` |
| Users can never access another firm's data | `verifyFirmAccess` check on sensitive operations |
| Xero tokens scoped to firm | `integrationConnections` table keyed by `firmId` + `provider` |
| Index support | `by_firm` index on every table for efficient scoping |

---

## 5. Session Security

Session security is managed entirely by **Clerk**:

| Aspect | Detail |
|--------|--------|
| Session storage | Clerk manages httpOnly cookie + JWT token pair |
| Session timeout | Configurable in Clerk Dashboard (default: 7 days) |
| Concurrent sessions | Allowed (multiple devices) — visible in Clerk user sessions list |
| Session revocation | Via Clerk Dashboard or `clerkClient.sessions.revokeSession()` |
| Last active tracking | `lastActiveAt` field on Convex `users` table, updated on Convex function calls |

---

## 6. Audit Trail

All significant actions are logged to the `activities` table:

| Field | Description |
|-------|-------------|
| `firmId` | Firm scope |
| `userId` | Who performed the action |
| `entityType` | What type of entity (proposal, client, service, etc.) |
| `entityId` | Which specific entity |
| `action` | What was done (40+ action types — see §31 Admin Panel) |
| `metadata` | Additional context (old/new values, approver name, etc.) |
| `timestamp` | When it happened |

See [§31 Admin Panel](./31-admin-panel.md) for the full list of audit actions.
