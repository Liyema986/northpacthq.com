# NorthPact PRD — Client & Group Management (§6.1)

This module manages the creation and maintenance of client groups and their constituent entities. It serves as the foundation for all proposals.

---

## 1. Client Group

A client group represents a family of related legal entities managed as a single client relationship.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Unique identifier |
| `firmId` | UUID (FK) | Auto | Firm this group belongs to |
| `name` | string | Yes | Group display name (e.g. "Smith Family Group") |
| `groupType` | enum | Yes | `holding_company` \| `family_trust` \| `partnership` \| `individual` \| `other` |
| `xeroContactGroupId` | string | No | Linked Xero contact group ID (if imported) |
| `attentionToId` | UUID (FK) | No | Primary contact person for the group |
| `notes` | text | No | Internal notes about the group |
| `createdAt` | datetime | Auto | Creation timestamp |
| `updatedAt` | datetime | Auto | Last modification timestamp |

---

## 2. Entity (within a Group)

Each entity is a distinct legal entity — a company, trust, close corporation, etc. — that may receive different services with different pricing.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Unique identifier |
| `clientGroupId` | UUID (FK) | Yes | Parent group reference |
| `name` | string | Yes | Legal entity name |
| `entityType` | enum | Yes | `pty_ltd` \| `cc` \| `trust` \| `sole_prop` \| `partnership` \| `npc` \| `other` |
| `registrationNumber` | string | No | CIPC or trust registration number |
| `taxNumber` | string | No | SARS income tax number |
| `vatNumber` | string | No | VAT registration number |
| `xeroContactId` | string | No | Linked Xero contact ID |
| `isActive` | boolean | Yes | Whether entity is currently active |
| `notes` | text | No | Entity-specific notes |

### Entity Type Reference

| Type | Code | Description |
|------|------|-------------|
| Private Company | `pty_ltd` | (Pty) Ltd — standard SA company |
| Close Corporation | `cc` | CC — legacy entity type, still common |
| Trust | `trust` | Family, business, or testamentary trust |
| Sole Proprietor | `sole_prop` | Individual trading in own name |
| Partnership | `partnership` | Two or more partners |
| Non-Profit Company | `npc` | Section 21 / NPC |
| Other | `other` | Any other legal form |

---

## 3. Contact Person

Contacts are linked to a client group and can serve as the attention-to person on proposals.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Unique identifier |
| `clientGroupId` | UUID (FK) | Yes | Parent group reference |
| `fullName` | string | Yes | Contact full name |
| `salutation` | string | No | Mr / Mrs / Ms / Dr etc. |
| `email` | string | Yes | Primary email address (used for proposal delivery) |
| `phone` | string | No | Phone number |
| `role` | string | No | Role or designation |
| `linkedEntityId` | UUID (FK) | No | Primary entity association |

---

## 4. Client Group Mode

The proposal builder supports two modes:

| Mode | Behaviour |
|------|-----------|
| **Single Entity** | One entity form, no "Add Entity" button, simplified header. Used for sole proprietors or single-company clients. |
| **Client Group** | Group-level metadata (name, type, notes) plus multiple collapsible entity cards. Used for family groups, holding structures, etc. |

**Switching from Client Group to Single Entity** retains only the first entity and cleans up all multi-entity service assignments.

---

## 5. Client Management Features

| Feature | Description |
|---------|-------------|
| Create client group | Define group name, type, notes; add entities inline |
| Edit client group | Update group details, add/remove entities |
| Archive client group | Soft delete — preserves linked proposals |
| Add/edit/remove entities | Manage entities within a group with all registration fields |
| Manage contact persons | Add, edit, remove contacts per group |
| Search and filter | Search across group names, entity names, contact names |
| Proposal history | View all proposals linked to a client group |
| Import from Xero | Sync contact groups and contacts (see §11) |
| Manual/Xero sync status | Indicator showing whether entity was imported or manually created |

---

## 6. Relationships

```
ClientGroup ──1:N──> Entity
ClientGroup ──1:N──> ContactPerson
ClientGroup ──1:N──> Proposal
Entity ──assigned to──> ProposalItem (many-to-many via assignedEntityIds)
ContactPerson ──serves as──> Proposal.attentionTo
```

---

## 7. Xero Import Mapping

| Xero Concept | NorthPact Concept | Mapping |
|-------------|-------------------|---------|
| Contact Group | Client Group | Group name and ID synced |
| Contact (within group) | Entity | Contact name, registration details mapped to entity fields |
| Contact Person | Contact Person | First/last name, email, phone mapped |

For full Xero integration details, see [§11 Xero Integration](./11-xero-integration.md).
