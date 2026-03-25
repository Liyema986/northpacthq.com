# Core Entities & Glossary

## Entity Relationship Diagram

```mermaid
erDiagram
    MockUser ||--o{ Firm : has
    ClientGroup ||--o{ Firm : has
    Entity ||--o{ ClientGroup : has
    Entity ||--o{ Firm : has
    ContactPerson ||--o{ ClientGroup : has
    ContactPerson ||--o{ Firm : has
```

## Entity Definitions

### MockUser
**Table**: `mockusers`

| Field | Type | Required |
|-------|------|----------|
| id | string | âœ… |
| firmId | string | âœ… |
| email | string | âœ… |
| password | string; // mock only — plain text for prototype | âœ… |
| name | string | âœ… |
| role | UserRole | âœ… |
| isActive | boolean | âœ… |
| avatarUrl | string | âŒ |

### AuthSession
**Table**: `authsessions`

| Field | Type | Required |
|-------|------|----------|
| user | MockUser | âœ… |
| token | string | âœ… |
| createdAt | number | âœ… |
| updatedAt | number | âŒ |

### Firm
**Table**: `firms`

| Field | Type | Required |
|-------|------|----------|
| id | string | âœ… |
| name | string | âœ… |
| email | string | âœ… |
| phone | string | âœ… |
| physicalAddress | string | âœ… |
| registrationNumber | string | âŒ |
| taxNumber | string | âŒ |
| vatNumber | string | âŒ |

### ClientGroup
**Table**: `clientgroups`

| Field | Type | Required |
|-------|------|----------|
| id | string | âœ… |
| firmId | string | âœ… |
| name | string | âœ… |
| groupNumber | string | âŒ |
| industry | string | âŒ |
| notes | string | âŒ |
| isArchived | boolean | âœ… |
| createdAt | string | âœ… |

### Entity
**Table**: `entitys`

| Field | Type | Required |
|-------|------|----------|
| id | string | âœ… |
| clientGroupId | string | âœ… |
| firmId | string | âœ… |
| name | string | âœ… |
| entityType | EntityType | âœ… |
| registrationNumber | string | âŒ |
| taxNumber | string | âŒ |
| vatNumber | string | âŒ |

### ContactPerson
**Table**: `contactpersons`

| Field | Type | Required |
|-------|------|----------|
| id | string | âœ… |
| clientGroupId | string | âœ… |
| firmId | string | âœ… |
| firstName | string | âœ… |
| lastName | string | âœ… |
| email | string | âœ… |
| phone | string | âŒ |
| position | string | âŒ |

### ClientGroupWithDetails
**Table**: `clientgroupwithdetails`

| Field | Type | Required |
|-------|------|----------|
| entities | Entity[] | âœ… |
| contacts | ContactPerson[] | âœ… |
| proposalCount | number | âœ… |
| createdAt | number | âœ… |
| updatedAt | number | âŒ |

### ServiceCategory
**Table**: `servicecategorys`

| Field | Type | Required |
|-------|------|----------|
| id | string | âœ… |
| firmId | string | âœ… |
| name | string | âœ… |
| icon | string | âœ… |
| colour | string | âœ… |
| sortOrder | number | âœ… |
| isActive | boolean | âœ… |
| createdAt | string | âœ… |


## Glossary

| Term | Definition |
|------|------------|
| At-Risk | Student performing below 50% |
| Intervention | Support action for struggling students |
| Coordinator | Staff managing tutoring programs |
| Performance Status | doing_well, needs_support, at_risk |
