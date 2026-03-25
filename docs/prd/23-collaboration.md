# NorthPact PRD — Real-Time Collaboration

**Source:** Root NorthPact `convex/collaboration.ts`, `convex/schema.ts` (presence table)

---

## 1. Overview

NorthPact supports **real-time multi-user collaboration** on proposals. Multiple team members can view and edit the same proposal simultaneously, with live presence indicators showing who is currently active and where their cursor is positioned.

---

## 2. Presence System

### 2.1 Data Model — Presence

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `proposalId` | UUID (FK) | Proposal being edited |
| `userId` | UUID (FK) | User who is present |
| `userName` | string | Display name for the presence indicator |
| `userColor` | hex string | Unique color assigned to user for cursor display |
| `cursorPosition` | object (optional) | `{ field: string, offset: number }` — which field and position |
| `isActive` | boolean | Whether user is currently active |
| `lastActiveAt` | datetime | Last heartbeat timestamp |

### 2.2 Database Indexes

| Index | Fields | Purpose |
|-------|--------|---------|
| `by_proposal` | `proposalId` | Get all presence for a proposal |
| `by_user` | `userId` | Get user's presence records |
| `by_proposal_active` | `proposalId`, `isActive` | Active users for a proposal |

---

## 3. User Color Assignment

Each user is assigned a deterministic color based on their user ID hash:

```
Colors: Red (#EF4444), Orange (#F59E0B), Green (#10B981), Blue (#3B82F6),
        Purple (#8B5CF6), Pink (#EC4899), Teal (#14B8A6), Orange (#F97316)

Assignment: hash(userId) % 8 → color index
```

---

## 4. Lifecycle

| Event | Action |
|-------|--------|
| **User opens proposal** | `joinProposal` — creates or reactivates presence record |
| **User types / interacts** | `updateCursor` — updates field and offset |
| **Periodic (every 10s)** | `heartbeat` — keeps presence marked active |
| **User navigates away** | `leaveProposal` — marks presence inactive |
| **30 seconds of inactivity** | Considered stale; filtered from active users |
| **Cleanup job (periodic)** | `cleanupStalePresences` — marks all 60s+ inactive presences |

---

## 5. Activity Logging

Collaboration edits are logged to the activity feed:

| Field | Description |
|-------|-------------|
| `action` | Edit type (e.g. "updated field") |
| `field` | Which field was changed (e.g. "title", "introText") |
| `oldValue` | Previous value (truncated for display) |
| `newValue` | New value (truncated for display) |
| `userName` | Who made the change |
| `timestamp` | When the change occurred |

Activity history is queryable per proposal with configurable limit (default 50 entries).

---

## 6. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proposals/:id/collaboration/join` | Join editing session |
| POST | `/api/proposals/:id/collaboration/leave` | Leave editing session |
| POST | `/api/proposals/:id/collaboration/heartbeat` | Keep presence alive |
| POST | `/api/proposals/:id/collaboration/cursor` | Update cursor position |
| GET | `/api/proposals/:id/collaboration/active-users` | List active users |
| GET | `/api/proposals/:id/collaboration/activity` | Get activity history |

---

## 7. UI Components

| Component | Description |
|-----------|-------------|
| **ActiveUsers** | Avatar stack in proposal header showing who's currently editing |
| **ActivityFeed** | Timeline of recent edits on the proposal |
| **Cursor Indicator** | Colored cursor / highlight on fields being edited by other users |
| **Presence Badge** | Count of active editors on proposal cards in the list |
