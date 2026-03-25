# NorthPact PRD — State Management & Persistence (§10)

---

## 1. Current State (MVP)

The MVP uses React Context with hooks (`useState`, `useMemo`, `useCallback`). All data is held in client-side state and **lost on page refresh**. This must be replaced with a persistence layer.

---

## 2. Target State (Production)

| Aspect | Target |
|--------|--------|
| Backend | Convex 1.31.7 — queries, mutations, and actions (no separate REST API layer) |
| Database | Convex built-in document database — firmId-scoped with `by_firm` indexes on every table |
| Persistent reads | `useQuery(api.proposals.list, { firmId })` — reactive; UI updates automatically when data changes |
| Persistent writes | `useMutation(api.proposals.create)` — transactional; firm scope and permissions enforced in mutation |
| Real-time calculations | Client-side (`useMemo`) for responsiveness — Convex mutation verifies on save |
| Derived values | Calculated client-side AND re-verified in the Convex mutation handler before database write |
| Auth | Clerk `useUser()` on the client; Convex mutations receive `ctx.auth.getUserIdentity()` for server-side identity |
| Proposal state machine | `draft → pending-approval → approved → sent → viewed → accepted/rejected/expired` with Convex audit trail |

---

## 3. Context Providers

### 3.1 ProposalDraftProvider

The core state container for the proposal builder.

**State:**
```typescript
{
  clientGroup: ClientGroup | null;
  clientGroupMode: 'single_entity' | 'client_group';
  entities: Entity[];
  attentionTo: ContactPerson | null;
  items: ProposalItem[];
  paymentFrequency: 'as_delivered' | 'monthly' | 'quarterly' | 'annually';
}
```

**Derived state (useMemo):**
```typescript
{
  summary: {
    monthlyTotal: number;
    yearlyTotal: number;
    onceoffTotal: number;
    acv: number;
    year1Total: number;
    totalHours: number;
    effectiveRate: number;
    perCycle: number;
    entityBreakdowns: EntityBreakdown[];
  };
  cashFlowByMonth: { month: string; revenue: number; hours: number }[];
}
```

**Actions:**
| Action | Description |
|--------|-------------|
| `setClientGroup(group)` | Set the client group and load entities |
| `setClientGroupMode(mode)` | Toggle single entity / client group |
| `toggleEntity(entityId)` | Enable/disable entity for this proposal |
| `setAttentionTo(contact)` | Set the attention-to contact person |
| `addItem(serviceTemplate)` | Add service from catalog with template defaults |
| `updateItem(id, changes)` | Update any field on a ProposalItem |
| `removeItem(id)` | Remove from proposal |
| `duplicateItem(id)` | Clone with new ID |
| `moveItem(fromIndex, toIndex)` | Reorder within category |
| `moveItemToCategory(id, newCategory)` | Move between billing categories |
| `setPaymentFrequency(freq)` | Change payment frequency |
| `clearDraft()` | Reset all state |

### 3.2 ServiceCatalogProvider

**Note:** Catalog data that is read-only during proposal building is served directly via `useQuery(api.services.list, { firmId })`. The provider wraps this with local filter/search state only — no API calls inside the provider.

**State:**
```typescript
{
  categories: ServiceCategory[];   // from useQuery — reactive
  services: ServiceTemplate[];     // from useQuery — reactive
  searchQuery: string;             // local filter state
  selectedCategory: string | null; // local filter state
}
```

### 3.3 ClientProvider

**Note:** Client group data is served via `useQuery(api.clientGroups.list, { firmId })`. The provider holds selection state only.

**State:**
```typescript
{
  clientGroups: ClientGroup[];       // from useQuery — reactive
  selectedGroup: ClientGroup | null; // local selection state
}
```

**Mutations (called directly — not through provider):**
| Mutation | Description |
|--------|-------------|
| `api.clientGroups.create` | Create new client group |
| `api.clientGroups.update` | Update client group |
| `api.entities.create` | Add entity to group |
| `api.contacts.create` | Add contact person to group |
| `api.xero.syncContacts` | Trigger Xero contact import (Convex action) |

### 3.4 Auth (Clerk — No Custom Provider Needed)

Clerk manages auth state via `<ClerkProvider>`. Convex receives the Clerk JWT and validates it server-side.

**Client-side:**
```typescript
const { user, isSignedIn } = useUser()         // Clerk
const currentUser = useQuery(api.users.getCurrent) // Convex user record
```

**Server-side (in Convex functions):**
```typescript
const identity = await ctx.auth.getUserIdentity()
if (!identity) throw new ConvexError("Not authenticated")
```

---

## 4. Persistence Strategy

### Write Flow (Convex Mutation)

```
Component ("use client")
  → useMutation(api.proposals.update)
  → Convex mutation handler
      → ctx.auth.getUserIdentity() → verify Clerk JWT
      → requirePermission(ctx, userId, "canEditPricing")
      → verifyFirmAccess(ctx, userId, firmId)
      → validate args with Convex validators (v.string(), v.number(), etc.)
      → re-verify server-side calculations
      → ctx.db.patch(proposalId, changes)
  → Convex pushes update to all subscribed useQuery hooks
  → UI updates automatically (no manual refetch)
```

### Real-Time Sync (Built-In — No Extra Work)

Convex `useQuery` is reactive by default. When a mutation writes to the database, all clients subscribed to the affected query receive the update automatically over WebSocket. Real-time collaboration is available in Phase 2 (see §23 Collaboration) with no infrastructure changes required — only presence tracking needs to be added.

---

## 5. Data Flow: Builder to Convex

```
1. User modifies ProposalItem in builder
2. ProposalDraftProvider recalculates derived state (useMemo)
3. Live Summary updates instantly (client-side — <100ms)
4. On "Save Draft":
   a. Serialise ProposalDraftProvider state
   b. useMutation(api.proposals.saveDraft)(draftState)
   c. Convex mutation: verify identity, permissions, firm scope
   d. Convex mutation: re-validate calculations server-side
   e. ctx.db.patch(proposalId, serialisedDraft)
   f. All useQuery subscribers update automatically (no manual refetch)
5. On "Send to Client":
   a. useMutation(api.proposals.send)(proposalId)
   b. Convex mutation: status → 'sent', generate portal token
   c. Convex schedules action: sendProposalEmail (Resend)
   d. Client portal link activated via token-based route /portal/[token]
```
