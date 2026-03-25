# NorthPact PRD — Notification System

**Source:** Root NorthPact `convex/notifications.ts`, `convex/schema.ts` (notifications table)

---

## 1. Overview

NorthPact provides an **in-app notification system** that keeps users informed of important events — approval requests, proposal status changes, and engagement letter signings. Notifications appear in a dropdown accessible from the main navigation header.

---

## 2. Data Model — Notification

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `firmId` | UUID (FK) | Firm scope |
| `userId` | UUID (FK) | Recipient user |
| `type` | enum | Notification category (see types below) |
| `title` | string | Short notification title |
| `message` | string | Detailed notification message |
| `relatedId` | string (optional) | ID of related entity (proposal, approval, letter) |
| `relatedType` | string (optional) | Entity type: `"proposal"`, `"approval"`, `"engagement-letter"` |
| `isRead` | boolean | Whether the notification has been read |
| `createdAt` | datetime | Creation timestamp |

### Database Indexes

| Index | Fields | Purpose |
|-------|--------|---------|
| `by_user` | `userId`, `isRead` | List notifications for user, filtered by read status |
| `by_firm` | `firmId` | List all notifications for a firm |

---

## 3. Notification Types

| Type | Trigger | Title | Message Pattern |
|------|---------|-------|-----------------|
| `approval-request` | User requests approval for a proposal | "Approval Request" | "{requester} requested approval for proposal "{title}"" |
| `approval-approved` | Approver approves a proposal | "Proposal Approved" | "Your proposal "{title}" has been approved by {approver}" |
| `approval-rejected` | Approver rejects a proposal | "Proposal Changes Requested" | "{approver} requested changes to "{title}": {comment}" |
| `proposal-sent` | Proposal sent to client | "Proposal Sent" | "Proposal "{title}" has been sent to {client}" |
| `proposal-viewed` | Client views proposal via link | "Proposal Viewed" | "Client viewed proposal "{title}"" |
| `proposal-accepted` | Client accepts proposal OR engagement letter signed | "Proposal Accepted" / "Document Signed!" | Varies by context |

---

## 4. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List notifications for current user (paginated) |
| GET | `/api/notifications/unread-count` | Get count of unread notifications |
| PUT | `/api/notifications/:id/read` | Mark single notification as read |
| PUT | `/api/notifications/read-all` | Mark all notifications as read |
| DELETE | `/api/notifications/:id` | Delete a notification |

---

## 5. User Notification Preferences

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `emailNotifications` | boolean | true | Whether to send email copies of notifications |
| `notificationDigest` | enum | `"instant"` | `instant` \| `daily` \| `weekly` — email digest frequency |

---

## 6. UI Components

| Component | Location | Description |
|-----------|----------|-------------|
| **NotificationsDropdown** | Header navigation | Bell icon with unread badge; dropdown list of recent notifications |
| **Unread Badge** | Bell icon | Red dot / count showing number of unread notifications |
| **Notification Item** | Dropdown list | Title, message, timestamp, read/unread styling |
| **Mark All Read** | Dropdown header | Button to mark all notifications as read |
| **Notification Click** | Each item | Navigates to related entity (proposal detail, approval panel, etc.) |

---

## 7. Notification Creation Rules

| Rule | Detail |
|------|--------|
| Notifications are created by backend mutations, never by the frontend | Ensures consistency |
| Notifications are always scoped to `firmId` | Multi-tenant isolation |
| Each notification has a specific `relatedId` + `relatedType` | Enables click-through navigation |
| Approval notifications go to the assigned approver or requester | Based on the action |
| Signing notifications go to the user who created the signing session | Informs the sender |
