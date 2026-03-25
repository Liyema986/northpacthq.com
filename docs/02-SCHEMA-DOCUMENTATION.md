# Database Schema Documentation

## Overview
- **Total Tables**: 26
- **Generated**: 2026-03-23T12:05:19.342Z

## Entity Relationship Diagram

```mermaid
erDiagram
    MockUser ||--o{ Firm : many-to-one
    ClientGroup ||--o{ Firm : many-to-one
    Entity ||--o{ ClientGroup : many-to-one
    Entity ||--o{ Firm : many-to-one
    ContactPerson ||--o{ ClientGroup : many-to-one
    ContactPerson ||--o{ Firm : many-to-one
    ServiceCategory ||--o{ Firm : many-to-one
```

## Tables

### mockusers

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| firmId | string | âœ… | |
| email | string | âœ… | |
| password | string; // mock only — plain text for prototype | âœ… | |
| name | string | âœ… | |
| role | UserRole | âœ… | |
| isActive | boolean | âœ… | |
| avatarUrl | string | âŒ | |
| createdAt | string | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_firmId, by_createdAt


### authsessions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user | MockUser | âœ… | |
| token | string | âœ… | |
| createdAt | number | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_createdAt


### firms

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| name | string | âœ… | |
| email | string | âœ… | |
| phone | string | âœ… | |
| physicalAddress | string | âœ… | |
| registrationNumber | string | âŒ | |
| taxNumber | string | âŒ | |
| vatNumber | string | âŒ | |
| defaultTaxRate | number | âœ… | |
| currency | string | âœ… | |
| brandColors | { primary: string; secondary: string | âœ… | |
| createdAt | number | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_createdAt


### clientgroups

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| firmId | string | âœ… | |
| name | string | âœ… | |
| groupNumber | string | âŒ | |
| industry | string | âŒ | |
| notes | string | âŒ | |
| isArchived | boolean | âœ… | |
| createdAt | string | âœ… | |
| updatedAt | string | âœ… | |

**Indexes**: by_firmId, by_createdAt


### entitys

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| clientGroupId | string | âœ… | |
| firmId | string | âœ… | |
| name | string | âœ… | |
| entityType | EntityType | âœ… | |
| registrationNumber | string | âŒ | |
| taxNumber | string | âŒ | |
| vatNumber | string | âŒ | |
| tradingName | string | âŒ | |
| xeroContactId | string | âŒ | |
| financialYearEnd | string; // "MM-DD" format | âŒ | |
| isActive | boolean | âœ… | |
| createdAt | string | âœ… | |
| updatedAt | string | âœ… | |

**Indexes**: by_clientGroupId, by_firmId, by_xeroContactId


### contactpersons

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| clientGroupId | string | âœ… | |
| firmId | string | âœ… | |
| firstName | string | âœ… | |
| lastName | string | âœ… | |
| email | string | âœ… | |
| phone | string | âŒ | |
| position | string | âŒ | |
| isPrimary | boolean | âœ… | |
| createdAt | string | âœ… | |
| updatedAt | string | âœ… | |

**Indexes**: by_clientGroupId, by_firmId, by_createdAt


### clientgroupwithdetails

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| entities | Entity[] | âœ… | |
| contacts | ContactPerson[] | âœ… | |
| proposalCount | number | âœ… | |
| createdAt | number | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_createdAt


### servicecategorys

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| firmId | string | âœ… | |
| name | string | âœ… | |
| icon | string | âœ… | |
| colour | string | âœ… | |
| sortOrder | number | âœ… | |
| isActive | boolean | âœ… | |
| createdAt | string | âœ… | |
| updatedAt | string | âœ… | |

**Indexes**: by_firmId, by_createdAt


### tierlevels

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| from | number | âœ… | |
| to | number | null; // null = unlimited | âœ… | |
| price | number | âœ… | |
| createdAt | number | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_createdAt


### servicetemplates

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| firmId | string | âœ… | |
| categoryId | string | âœ… | |
| name | string | âœ… | |
| description | string | âŒ | |
| billingCategory | BillingCategory | âœ… | |
| pricingMethod | PricingMethod | âœ… | |
| unitPrice | number | âœ… | |
| quantity | number | âœ… | |
| discount | number | âœ… | |
| taxRate | number | âœ… | |
| frequency | Frequency | âœ… | |
| entityPricingMode | EntityPricingMode | âœ… | |
| transactionCount | number | âŒ | |
| employeeCount | number | âŒ | |
| payslipCount | number | âŒ | |
| invoiceCount | number | âŒ | |
| bankAccountCount | number | âŒ | |
| vatSubmissionCount | number | âŒ | |
| entityCount | number | âŒ | |
| timeMethod | TimeMethod | âœ… | |
| timeInputHours | number | âŒ | |
| timeInputMinutes | number | âŒ | |
| timeQuantity | number | âŒ | |
| minutesPerUnit | number | âŒ | |
| tiers | TierLevel[] | âŒ | |
| manualPrice | number | âŒ | |
| isActive | boolean | âœ… | |
| isOptional | boolean | âœ… | |
| sortOrder | number | âœ… | |
| createdAt | string | âœ… | |
| updatedAt | string | âœ… | |

**Indexes**: by_firmId, by_categoryId, by_createdAt


### servicetemplatewithcategorys

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| category | ServiceCategory | âœ… | |
| createdAt | number | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_createdAt


### proposalitems

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| proposalId | string | âœ… | |
| serviceTemplateId | string | âŒ | |
| firmId | string | âœ… | |
| name | string | âœ… | |
| description | string | âŒ | |
| billingCategory | BillingCategory | âœ… | |
| pricingMethod | PricingMethod | âœ… | |
| unitPrice | number | âœ… | |
| quantity | number | âœ… | |
| discount | number | âœ… | |
| taxRate | number | âœ… | |
| frequency | Frequency | âœ… | |
| entityPricingMode | EntityPricingMode | âœ… | |
| assignedEntityIds | string[] | âœ… | |
| customEntityPrices | Record<string, number> | âœ… | |
| transactionCount | number | âŒ | |
| employeeCount | number | âŒ | |
| payslipCount | number | âŒ | |
| invoiceCount | number | âŒ | |
| bankAccountCount | number | âŒ | |
| vatSubmissionCount | number | âŒ | |
| entityCount | number | âŒ | |
| timeMethod | TimeMethod | âœ… | |
| timeInputHours | number | âŒ | |
| timeInputMinutes | number | âŒ | |
| timeQuantity | number | âŒ | |
| minutesPerUnit | number | âŒ | |
| tiers | TierLevel[] | âŒ | |
| manualPrice | number | âŒ | |
| entityAssignmentMode | EntityAssignmentMode | âŒ | |
| pricingDriver | string | âŒ | |
| duePattern | string | âŒ | |
| itemNotes | string | âŒ | |
| baseAmount | number | âœ… | |
| subtotal | number | âœ… | |
| totalPrice | number | âœ… | |
| estimatedHours | number | âœ… | |
| isOptional | boolean | âœ… | |
| sortOrder | number | âœ… | |
| createdAt | string | âœ… | |
| updatedAt | string | âœ… | |

**Indexes**: by_proposalId, by_serviceTemplateId, by_firmId


### proposals

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| firmId | string | âœ… | |
| clientGroupId | string | âœ… | |
| attentionToContactId | string | âŒ | |
| proposalNumber | string | âœ… | |
| title | string | âœ… | |
| status | ProposalStatus | âœ… | |
| paymentFrequency | PaymentFrequency | âœ… | |
| commencementDate | string | âŒ | |
| expiryDate | string | âŒ | |
| notes | string | âŒ | |
| introText | string | âŒ | |
| termsText | string | âŒ | |
| monthlyTotal | number | âœ… | |
| yearlyTotal | number | âœ… | |
| onceoffTotal | number | âœ… | |
| totalHours | number | âœ… | |
| acv | number | âœ… | |
| year1Total | number | âœ… | |
| approvalRequestedAt | string | âŒ | |
| approvalRequestedById | string | âŒ | |
| approvedAt | string | âŒ | |
| approvedById | string | âŒ | |
| sentAt | string | âŒ | |
| sentById | string | âŒ | |
| viewedAt | string | âŒ | |
| acceptedAt | string | âŒ | |
| rejectedAt | string | âŒ | |
| rejectionReason | string | âŒ | |
| portalToken | string | âŒ | |
| createdById | string | âœ… | |
| createdAt | string | âœ… | |
| updatedAt | string | âœ… | |

**Indexes**: by_firmId, by_clientGroupId, by_attentionToContactId


### proposalwithdetails

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| clientGroup | ClientGroup | âœ… | |
| entities | Entity[] | âœ… | |
| contacts | ContactPerson[] | âœ… | |
| attentionTo | ContactPerson | âŒ | |
| items | ProposalItem[] | âœ… | |
| createdAt | number | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_createdAt


### proposalsummarys

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| monthlyTotal | number | âœ… | |
| yearlyTotal | number | âœ… | |
| onceoffTotal | number | âœ… | |
| acv | number | âœ… | |
| year1Total | number | âœ… | |
| totalHours | number | âœ… | |
| effectiveRate | number | âœ… | |
| perCycle | number | âœ… | |
| createdAt | number | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_createdAt


### cashflowmonths

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| month | number; // 1–12 | âœ… | |
| label | string; // "Jan", "Feb", etc. | âœ… | |
| monthly | number | âœ… | |
| yearly | number | âœ… | |
| onceoff | number | âœ… | |
| total | number | âœ… | |
| createdAt | number | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_createdAt


### workplanentrys

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| firmId | string | âœ… | |
| proposalId | string | âœ… | |
| proposalItemId | string | âœ… | |
| clientGroupId | string | âœ… | |
| serviceName | string | âœ… | |
| clientName | string | âœ… | |
| billingCategory | BillingCategory | âœ… | |
| frequency | Frequency | âœ… | |
| scheduledMonth | string; // "YYYY-MM" | âœ… | |
| estimatedHours | number | âœ… | |
| assignedUserId | string | âŒ | |
| status | WorkPlanStatus | âœ… | |
| notes | string | âŒ | |
| completedAt | string | âŒ | |
| createdAt | string | âœ… | |
| updatedAt | string | âœ… | |

**Indexes**: by_firmId, by_proposalId, by_proposalItemId


### engagementparagraphs

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| firmId | string | âœ… | |
| serviceTemplateId | string; // null = standard/firm-wide | âŒ | |
| type | "standard" | "service_specific" | âœ… | |
| title | string | âœ… | |
| content | string; // HTML | âœ… | |
| isRequired | boolean | âœ… | |
| sortOrder | number | âœ… | |
| createdAt | string | âœ… | |
| updatedAt | string | âœ… | |

**Indexes**: by_firmId, by_serviceTemplateId, by_createdAt


### engagementletters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| firmId | string | âœ… | |
| proposalId | string | âœ… | |
| clientGroupId | string | âœ… | |
| name | string | âœ… | |
| introduction | string | âœ… | |
| scope | string; // HTML | âœ… | |
| status | "draft" | "sent" | "signed" | "rejected" | âœ… | |
| sentAt | string | âŒ | |
| signedAt | string | âŒ | |
| signingToken | string | âŒ | |
| principalId | string | âŒ | |
| createdAt | string | âœ… | |
| updatedAt | string | âœ… | |

**Indexes**: by_firmId, by_proposalId, by_clientGroupId


### principals

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| firmId | string | âœ… | |
| name | string | âœ… | |
| qualification | string | âŒ | |
| roles | ("director" | "principal" | "statutory-auditor")[] | âœ… | |
| sortOrder | number | âœ… | |
| createdAt | string | âœ… | |
| updatedAt | string | âœ… | |

**Indexes**: by_firmId, by_createdAt


### firmsettings

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| firmId | string | âœ… | |
| defaultTaxRate | number | âœ… | |
| defaultPaymentFrequency | PaymentFrequency | âœ… | |
| defaultExpiryDays | number | âœ… | |
| proposalNumberPrefix | string | âœ… | |
| proposalNumberCounter | number | âœ… | |
| requireApproval | boolean | âœ… | |
| approverRoles | UserRole[] | âœ… | |
| updatedAt | string | âœ… | |
| createdAt | number | âœ… | |

**Indexes**: by_firmId, by_createdAt


### activityitems

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| description | string | âœ… | |
| entityId | string | âœ… | |
| entityName | string | âœ… | |
| userId | string | âœ… | |
| userName | string | âœ… | |
| createdAt | string | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_entityId, by_userId, by_createdAt


### proposalbuilderentitys

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | âœ… | |
| name | string | âœ… | |
| entityType | string | âœ… | |
| registrationNumber | string | âœ… | |
| taxNumber | string | âœ… | |
| vatNumber | string | âœ… | |
| notes | string | âœ… | |
| createdAt | number | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_createdAt


### proposalbuilderclientgroups

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | âœ… | |
| groupType | string | âœ… | |
| notes | string | âœ… | |
| createdAt | number | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_createdAt


### proposalentitysummarys

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| entityId | string | âœ… | |
| entityName | string | âœ… | |
| monthlyTotal | number | âœ… | |
| yearlyTotal | number | âœ… | |
| onceoffTotal | number | âœ… | |
| annualContractValue | number | âœ… | |
| year1Total | number | âœ… | |
| totalHours | number | âœ… | |
| isShared | boolean | âœ… | |
| createdAt | number | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_entityId, by_createdAt


### proposalbuildersummarys

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| itemCount | number | âœ… | |
| monthlyTotal | number | âœ… | |
| yearlyTotal | number | âœ… | |
| onceoffTotal | number | âœ… | |
| annualContractValue | number | âœ… | |
| year1Total | number | âœ… | |
| totalHours | number | âœ… | |
| perCycle | number | âœ… | |
| entityTotals | ProposalEntitySummary[] | âœ… | |
| createdAt | number | âœ… | |
| updatedAt | number | âŒ | |

**Indexes**: by_createdAt


