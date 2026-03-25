# NorthPact PRD — API Specifications (§14)

All endpoints require authentication. All responses use JSON format. All endpoints are scoped to the authenticated user's firm.

---

## 1. Client Groups API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/client-groups` | List all client groups with pagination and search |
| POST | `/api/client-groups` | Create a new client group |
| GET | `/api/client-groups/:id` | Get client group with entities and contacts |
| PUT | `/api/client-groups/:id` | Update client group |
| DELETE | `/api/client-groups/:id` | Archive client group (soft delete) |
| POST | `/api/client-groups/import-xero` | Import contact groups from Xero |

### Query Parameters (GET /api/client-groups)
| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Full-text search across group name, entity names, contacts |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

### Request Body (POST /api/client-groups)
```json
{
  "name": "Smith Family Group",
  "groupType": "family_trust",
  "notes": "Referred by John Doe",
  "entities": [
    {
      "name": "Smith Trading (Pty) Ltd",
      "entityType": "pty_ltd",
      "registrationNumber": "2020/123456/07",
      "taxNumber": "9012345678",
      "vatNumber": "4012345678"
    }
  ],
  "contacts": [
    {
      "fullName": "John Smith",
      "salutation": "Mr",
      "email": "john@smithtrading.co.za",
      "phone": "+27 82 123 4567",
      "role": "Director"
    }
  ]
}
```

---

## 2. Entities API (nested under Client Groups)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/client-groups/:groupId/entities` | Add entity to group |
| PUT | `/api/client-groups/:groupId/entities/:id` | Update entity |
| DELETE | `/api/client-groups/:groupId/entities/:id` | Remove entity |

---

## 3. Contact Persons API (nested under Client Groups)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/client-groups/:groupId/contacts` | Add contact person |
| PUT | `/api/client-groups/:groupId/contacts/:id` | Update contact |
| DELETE | `/api/client-groups/:groupId/contacts/:id` | Remove contact |

---

## 4. Proposals API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proposals` | List proposals with filters (status, client, date range) |
| POST | `/api/proposals` | Create new proposal for a client group |
| GET | `/api/proposals/:id` | Get full proposal with items and calculations |
| PUT | `/api/proposals/:id` | Update proposal (items, pricing, entities) |
| POST | `/api/proposals/:id/send` | Send proposal to client (status → sent) |
| POST | `/api/proposals/:id/accept` | Mark as accepted (triggers downstream) |
| POST | `/api/proposals/:id/reject` | Mark as rejected |
| GET | `/api/proposals/:id/engagement-letter` | Get generated engagement letter |
| POST | `/api/proposals/:id/engagement-letter/send` | Send engagement letter to client |
| POST | `/api/proposals/:id/duplicate` | Duplicate proposal as new draft |

### Query Parameters (GET /api/proposals)
| Param | Type | Description |
|-------|------|-------------|
| `status` | enum | Filter by: draft, pending-approval, approved, sent, viewed, accepted, rejected, expired |
| `clientGroupId` | UUID | Filter by client group |
| `fromDate` | date | Created after date |
| `toDate` | date | Created before date |
| `page` | number | Page number |
| `limit` | number | Items per page |

### Request Body (POST /api/proposals)
```json
{
  "clientGroupId": "uuid",
  "name": "Smith Family Group 2026",
  "attentionToId": "uuid",
  "clientGroupMode": "client_group",
  "paymentFrequency": "monthly",
  "validUntil": "2026-04-19",
  "entityIds": ["uuid1", "uuid2", "uuid3"],
  "items": [
    {
      "serviceTemplateId": "uuid",
      "name": "Monthly Bookkeeping",
      "category": "monthly",
      "pricingMethod": "per_transaction",
      "pricingDriver": "Transactions per month",
      "quantity": 120,
      "unitPrice": 18,
      "discount": 0,
      "taxRate": 15,
      "deliveryFrequency": "monthly",
      "entityAssignmentMode": "all_entities",
      "entityPricingMode": "price_per_entity",
      "timeMethod": "volume_based",
      "timeInputMinutes": 6,
      "isOptional": false
    }
  ]
}
```

### Response (GET /api/proposals/:id)
Includes full proposal with all items, calculated totals, entity breakdowns, and cash flow projections.

---

## 5. Services API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/services` | List all service templates with categories |
| POST | `/api/services` | Create new service template |
| PUT | `/api/services/:id` | Update service template |
| DELETE | `/api/services/:id` | Delete service template |
| GET | `/api/service-categories` | List service categories |
| POST | `/api/service-categories` | Create service category |
| PUT | `/api/service-categories/:id` | Update service category |
| DELETE | `/api/service-categories/:id` | Delete service category |
| PUT | `/api/services/:id/paragraphs` | Manage engagement paragraphs for a service |
| POST | `/api/services/:id/reorder` | Reorder service within category |

---

## 6. Engagement Letters API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/engagement-paragraphs` | List all paragraphs (standard + service-specific) |
| POST | `/api/engagement-paragraphs` | Create new paragraph |
| PUT | `/api/engagement-paragraphs/:id` | Update paragraph content |
| DELETE | `/api/engagement-paragraphs/:id` | Delete paragraph |
| POST | `/api/engagement-paragraphs/reorder` | Reorder paragraphs |

---

## 7. Xero Integration API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/xero/auth-url` | Get Xero OAuth authorization URL |
| POST | `/api/xero/callback` | Handle OAuth callback and store tokens |
| GET | `/api/xero/status` | Check connection status |
| POST | `/api/xero/sync` | Trigger manual sync of contacts and groups |
| DELETE | `/api/xero/disconnect` | Disconnect Xero integration |

---

## 8. Dashboard API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/kpis` | Get KPI card values |
| GET | `/api/dashboard/recent-proposals` | Get recent proposals with status |
| GET | `/api/dashboard/activity` | Get recent activity feed |
| GET | `/api/dashboard/pipeline` | Get pipeline funnel data |

---

## 9. Work Planning API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/work-planning` | Get work plan entries with filters |
| GET | `/api/work-planning/kpis` | Get work planning KPI values |
| PUT | `/api/work-planning/:id/status` | Update entry status |

### Query Parameters
| Param | Type | Description |
|-------|------|-------------|
| `month` | number | Filter by month (1-12) |
| `team` | string | Filter by responsible team |
| `clientGroupId` | UUID | Filter by client |
| `status` | enum | planned, in_progress, completed, overdue |

---

## 10. Cash Flow API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cash-flow` | Get 12-month cash flow projections |
| GET | `/api/cash-flow/by-client` | Cash flow broken down by client group |
| GET | `/api/cash-flow/export` | Export cash flow data (CSV/XLSX) |

---

## 11. Settings API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get all firm settings |
| PUT | `/api/settings` | Update firm settings |
| POST | `/api/settings/logo` | Upload firm logo |

---

## 12. Error Response Format

All error responses follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Client group name is required",
    "details": [
      { "field": "name", "message": "Required" }
    ]
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate or state conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 13. Additional API Endpoints (from Root Project)

The following endpoints are implemented in the root project and must be carried into the new build. See the referenced PRD documents for full details.

### 13.1 Approval Workflow API

See [§22 Approval Workflow](./22-approval-workflow.md).

| Method | Endpoint |
|--------|----------|
| POST | `/api/proposals/:id/request-approval` |
| POST | `/api/approvals/:id/approve` |
| POST | `/api/approvals/:id/reject` |
| GET | `/api/proposals/:id/approval` |
| GET | `/api/approvals/pending` |
| GET | `/api/approvals/metrics` |
| GET | `/api/approvals/approvers` |

### 13.2 Collaboration API

See [§23 Collaboration](./23-collaboration.md).

| Method | Endpoint |
|--------|----------|
| POST | `/api/proposals/:id/collaboration/join` |
| POST | `/api/proposals/:id/collaboration/leave` |
| POST | `/api/proposals/:id/collaboration/heartbeat` |
| POST | `/api/proposals/:id/collaboration/cursor` |
| GET | `/api/proposals/:id/collaboration/active-users` |
| GET | `/api/proposals/:id/collaboration/activity` |

### 13.3 Notification API

See [§24 Notifications](./24-notifications.md).

| Method | Endpoint |
|--------|----------|
| GET | `/api/notifications` |
| GET | `/api/notifications/unread-count` |
| PUT | `/api/notifications/:id/read` |
| PUT | `/api/notifications/read-all` |
| DELETE | `/api/notifications/:id` |

### 13.4 Email API

See [§25 Email System](./25-email-system.md).

| Method | Endpoint |
|--------|----------|
| POST | `/api/proposals/:id/send-email` |
| POST | `/api/proposals/:id/schedule-email` |
| GET | `/api/proposals/:id/emails` |
| POST | `/api/webhooks/resend` |
| GET | `/api/track-open/:proposalId` |

### 13.5 Versioning API

See [§26 Proposal Versioning](./26-proposal-versioning.md).

| Method | Endpoint |
|--------|----------|
| POST | `/api/proposals/:id/update-pricing` |
| GET | `/api/proposals/:id/versions` |
| GET | `/api/proposals/grouped-by-client` |
| DELETE | `/api/proposal-versions/:id` |

### 13.6 Client Portal API

See [§27 Client Portal](./27-client-portal.md).

| Method | Endpoint |
|--------|----------|
| GET | `/api/proposals/accept/:token` |
| POST | `/api/proposals/accept/:token/accept` |
| POST | `/api/proposals/accept/:token/reject` |
| POST | `/api/engagement-letters/:id/signing-link` |
| GET | `/api/signing/:token` |
| POST | `/api/signing/:token/submit` |

### 13.7 Pricing Intelligence API

See [§28 Pricing Intelligence](./28-pricing-intelligence.md).

| Method | Endpoint |
|--------|----------|
| GET | `/api/pricing/suggest` |
| POST | `/api/pricing/feedback` |
| GET | `/api/pricing/settings` |
| PUT | `/api/pricing/settings` |
| POST | `/api/pricing/tax-rates` |
| PUT | `/api/pricing/tax-rates/:id` |
| DELETE | `/api/pricing/tax-rates/:id` |
| PUT | `/api/pricing/tax-rates/:id/default` |

### 13.8 Global Search API

See [§29 Global Search](./29-global-search.md).

| Method | Endpoint |
|--------|----------|
| GET | `/api/search?q=term` |
| GET | `/api/search/suggestions` |

### 13.9 Templates & Packages API

See [§30 Proposal Templates](./30-proposal-templates.md).

| Method | Endpoint |
|--------|----------|
| GET/POST | `/api/templates` |
| GET/PUT/DELETE | `/api/templates/:id` |
| GET | `/api/templates/default?serviceType=...` |
| GET/POST | `/api/packages` |
| GET/PUT/DELETE | `/api/packages/:id` |

### 13.10 Admin & User API

See [§31 Admin Panel](./31-admin-panel.md).

| Method | Endpoint |
|--------|----------|
| GET | `/api/users` |
| POST | `/api/users/invite` |
| PUT | `/api/users/:id/role` |
| PUT | `/api/users/:id/deactivate` |
| DELETE | `/api/users/:id` |

### 13.11 PDF API

See [§32 PDF Generation](./32-pdf-generation.md).

| Method | Endpoint |
|--------|----------|
| GET | `/api/proposals/:id/pdf-data` |
| POST | `/api/proposals/:id/pdf-upload-url` |
| PUT | `/api/proposals/:id/pdf` |
| GET | `/api/proposals/:id/pdf` |
| POST | `/api/proposals/:id/pdf-metadata` |

### 13.12 Billing API

See [§33 Subscription & Billing](./33-subscription-billing.md).

| Method | Endpoint |
|--------|----------|
| POST | `/api/billing/checkout` |
| POST | `/api/billing/portal` |
| POST | `/api/webhooks/stripe` |

### 13.13 Integration API

See [§35 Apps Map](./35-apps-map.md).

| Method | Endpoint |
|--------|----------|
| GET | `/api/integrations` |
| POST | `/api/integrations` |
| DELETE | `/api/integrations/:provider` (for non-Xero; Xero uses `/api/xero/disconnect`) |
| POST | `/api/integrations/:provider/sync` |
| GET | `/api/integrations/stats` |

### 13.14 Webhook Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/clerk-webhook` | POST | Clerk user sync (Svix signature verification) |
| `/api/integrations/xero/store-tokens` | POST | Xero OAuth callback token storage |
| `/api/webhooks/resend` | POST | Resend email event handling |
| `/api/webhooks/stripe` | POST | Stripe subscription event handling |
| `/api/track-open/:proposalId` | GET | Email open tracking pixel (1×1 GIF) |

### 13.15 Line Items (Service Management) API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sections` | List sections with services |
| POST | `/api/sections` | Create section |
| PUT | `/api/sections/:id` | Update section |
| DELETE | `/api/sections/:id` | Delete section + services |
| POST | `/api/sections/:id/reorder` | Move section up/down |
| POST | `/api/sections/import` | Import from templates |
| POST | `/api/sections/:id/services` | Create service in section |
| PUT | `/api/services/:id` | Update service |
| DELETE | `/api/services/:id` | Delete service |
| POST | `/api/services/:id/duplicate` | Duplicate service |
| POST | `/api/services/global-price-adjustment` | Adjust all prices |
| POST | `/api/sections/:id/price-adjustment` | Adjust section prices |
