# Compliance Report â€” TPP Platform

## POPIA (Protection of Personal Information Act â€” South Africa)

| Principle | Implementation | Status |
|-----------|---------------|--------|
| Accountability | Designated information officer | Pending |
| Processing Limitation | Only collect necessary data | Implemented |
| Purpose Specification | Privacy policy + consent | Pending |
| Further Processing | No secondary use without consent | Implemented |
| Information Quality | Data validation (Zod) | Implemented |
| Openness | Privacy notice on registration | Pending |
| Security Safeguards | Encryption, RBAC, audit logs | Implemented |
| Data Subject Participation | View/export/delete own data | Partial |

## Data Retention Policy

| Data Type | Retention Period | Deletion Method |
|-----------|-----------------|-----------------|
| User accounts | Active + 2 years after deactivation | Soft delete â†’ Hard delete |
| Academic records | 7 years (regulatory) | Archived â†’ Purged |
| Messages | 1 year | Auto-archive |
| Audit logs | 3 years | Auto-purge |
| Session data | 30 days | Auto-expire (Clerk) |

## Right to Erasure (POPIA Section 24)
1. User requests deletion via Settings page
2. System archives all user data (soft delete)
3. After 30-day grace period, data is permanently removed
4. Confirmation email sent to user
5. Audit log entry created (anonymized)

## Data Processing Register

| Process | Legal Basis | Data Categories | Recipients |
|---------|-------------|-----------------|------------|
| User authentication | Consent | Email, name | Clerk |
| Academic tracking | Legitimate interest | Grades, performance | Internal |
| Communication | Consent | Messages | Internal |
| Analytics | Legitimate interest | Aggregated stats | Funders (anonymized) |
