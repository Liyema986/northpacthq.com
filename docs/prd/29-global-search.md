# NorthPact PRD — Global Search & Command Palette

**Source:** Root NorthPact `convex/search.ts`, `components/CommandPalette.tsx`

---

## 1. Overview

NorthPact provides a **global search** system accessible via a command palette (Cmd+K / Ctrl+K). It searches across all major entities — proposals, clients, services, and templates — and returns grouped, ranked results.

---

## 2. Search Behaviour

| Aspect | Detail |
|--------|--------|
| **Minimum query length** | 2 characters |
| **Results per category** | Max 5 per entity type |
| **Search scope** | Always filtered by `firmId` (multi-tenant isolation) |
| **Match type** | Case-insensitive substring matching |
| **Client filter** | Excludes archived clients |
| **Service filter** | Only active services |

---

## 3. Searchable Entities

### 3.1 Proposals

| Field Searched | Returned Fields |
|----------------|-----------------|
| `name` | `_id`, `name`, `clientGroupName` (denormalized), `status`, `acv` |
| `proposalNumber` | |
| ClientGroup `name` (via join) | |
| ContactPerson `email` (via join) | |

### 3.2 Clients (Client Groups)

| Field Searched | Returned Fields |
|----------------|-----------------|
| `name` (ClientGroup) | `_id`, `name`, `groupType`, `contactName` (attention-to), `entityCount` |
| ContactPerson `fullName` | |
| ContactPerson `email` | |
| Entity `name` | |

### 3.3 Services

| Field Searched | Returned Fields |
|----------------|-----------------|
| `name` | `_id`, `name`, `category`, `price` (fixedPrice or hourlyRate) |
| `category` | |
| `description` | |

### 3.4 Templates

| Field Searched | Returned Fields |
|----------------|-----------------|
| `name` | `_id`, `name`, `serviceType`, `isDefault` |
| `serviceType` | |

---

## 4. Full-Text Search on Clients

In addition to the global search, clients have a dedicated **full-text search index** using a denormalized `searchText` field:

```
searchText = clientGroupName + " " + contactFullName + " " + contactEmail + " " + entityNames
```

| Feature | Detail |
|---------|--------|
| Minimum query | 2 characters |
| Search field | `searchText` (denormalized) |
| Filter field | `firmId` |
| Max results | 50 |
| Backfill mutation | `backfillClientSearchText` — fills `searchText` for existing records |

---

## 5. Search Suggestions

When the search input is empty or before typing, the system shows **suggestions** based on recent activity:

| Source | Max Items |
|--------|-----------|
| Recent proposals (newest first) | 3 |
| Top clients (non-archived) | 5 |

Total suggestions capped at 5.

---

## 6. UI Components

### 6.1 Command Palette

| Feature | Detail |
|---------|--------|
| **Trigger** | Cmd+K (Mac) / Ctrl+K (Windows) |
| **Position** | Centered modal overlay |
| **Input** | Search input with auto-focus |
| **Results** | Grouped by entity type with icons |
| **Navigation** | Arrow keys to navigate, Enter to select |
| **Action** | Navigates to the selected entity's detail page |

### 6.2 Result Groups

| Group | Icon | Navigation Target |
|-------|------|-------------------|
| Proposals | FileText | `/proposals/:id` |
| Clients | Users | `/clients/:id` |
| Services | Settings | `/services` (filtered) |
| Templates | File | `/templates` (filtered) |

### 6.3 Result Count

Total count displayed at the bottom of results showing matches across all categories.

---

## 7. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search?q=term&limit=5` | Global search across all entities |
| GET | `/api/search/suggestions` | Get search suggestions from recent activity |
| GET | `/api/client-groups/search?q=term` | Full-text search on client groups (dedicated) |
