# NorthPact PRD — Apps Map (Integration Hub)

**Source:** Root NorthPact `app/(app)/appsmap/page.tsx`, `convex/integrations.ts`, `convex/schema.ts`

---

## 1. Overview

The **Apps Map** is a visual integration hub where firms can see and manage their connected applications. It provides a canvas-based view of all integration points, connection status, sync history, and automation configuration.

---

## 2. Apps Map Canvas

### 2.1 Visual Layout

The Apps Map is a **drag-and-drop canvas** where each connected app is represented as a card:

| Feature | Description |
|---------|-------------|
| **Draggable app cards** | Each app is a card with logo, name, and status |
| **Connection lines** | Visual lines connecting related apps with labels |
| **Canvas editor** | Pan and zoom, rearrange app positions |
| **Position persistence** | App positions saved on proposals (for proposal-specific app maps) |

### 2.2 App Card Data

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | App identifier |
| `name` | string | App display name |
| `logo` | string | App logo URL |
| `position` | `{ x: number, y: number }` | Position on canvas |

### 2.3 Connection Data

| Field | Type | Description |
|-------|------|-------------|
| `from` | string | Source app ID |
| `to` | string | Target app ID |
| `label` | string | Connection description |

---

## 3. Integration Management

### 3.1 Firm Integrations

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `provider` | string | Integration provider (e.g. "xero") |
| `createdAt` | datetime | When integration was added |

### 3.2 Integration Connections (OAuth)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `provider` | string | Provider name |
| `accessToken` | string (encrypted) | OAuth access token |
| `refreshToken` | string (encrypted) | OAuth refresh token |
| `expiresAt` | datetime | Token expiry |
| `tenantId` | string (optional) | Provider tenant/org ID (e.g. Xero organisation) |
| `createdAt` | datetime | Connection timestamp |
| `updatedAt` | datetime | Last token refresh |

### 3.3 Sync Logs

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `provider` | string | Provider name |
| `syncedAt` | datetime | When sync ran |
| `status` | enum | `success` \| `error` |
| `recordCount` | number (optional) | Records synced |

### 3.4 Integration Automations

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `name` | string | Automation name |
| `provider` | string | Related provider |
| `enabled` | boolean | Active state |
| `createdAt` | datetime | Creation timestamp |
| `updatedAt` | datetime | Last modification |

---

## 4. Apps Map Statistics

| Stat | Source |
|------|--------|
| **Connected** | Count of `firmIntegrations` |
| **Available** | Total apps in library minus connected |
| **Pending** | Apps with incomplete setup |
| **Automations** | Count of enabled `integrationAutomations` |
| **Syncs today** | Count of `integrationSyncLogs` from today |

---

## 5. Apps Library

Pre-defined list of available integrations:

| App | Category | Description |
|-----|----------|-------------|
| Xero | Accounting | Contact and group syncing |
| Stripe | Payments | Subscription billing |
| Resend | Email | Transactional email delivery |
| Google Workspace | Productivity | Calendar, Drive integration |
| Microsoft 365 | Productivity | Outlook, Teams integration |
| Slack | Communication | Notifications and alerts |
| Zapier | Automation | Connect to 5000+ apps |
| HubSpot | CRM | Client relationship management |

---

## 6. Proposal-Level Apps Map

Each proposal can store its own **apps map data** showing which tools are relevant to that specific engagement:

```
proposal.appsMapData = {
  apps: [{ id, name, logo, position: { x, y } }],
  connections: [{ from, to, label }]
}
```

This allows proposals to visually show the client's technology stack and how NorthPact integrates with it.

---

## 7. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations` | List firm integrations |
| POST | `/api/integrations` | Add integration (idempotent) |
| DELETE | `/api/integrations/:provider` | Remove integration |
| POST | `/api/integrations/:provider/sync` | Trigger manual sync |
| GET | `/api/integrations/stats` | Apps map statistics |
| GET | `/api/integrations/xero/connection` | Get Xero connection status |
| DELETE | `/api/xero/disconnect` | Disconnect Xero (matches §11 Xero Integration API) |
