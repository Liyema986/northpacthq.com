# Data Backup & Recovery Plan â€” TPP Platform

## Backup Strategy

| Data | Provider | Frequency | Retention | Recovery |
|------|----------|-----------|-----------|----------|
| Database | Convex | Continuous | Managed | Point-in-time |
| File Storage | Convex | Continuous | Managed | By storage ID |
| Source Code | GitHub | Every push | Unlimited | Git checkout |
| Environment Config | Vercel/Convex | Manual | Current | Redeploy |
| Auth Data | Clerk | Continuous | Managed | Clerk support |

## Recovery Procedures

### Scenario 1: Accidental Data Deletion
1. Identify affected records (soft delete should prevent this)
2. Use Convex dashboard to query deleted records
3. Restore via mutation: update status from "archived" to "active"
4. Verify data integrity

### Scenario 2: Schema Corruption
1. Stop Convex deployment: `npx convex cancel`
2. Contact Convex support for backup restore
3. Redeploy known-good schema version
4. Validate all tables and indexes

### Scenario 3: Complete System Recovery
1. Restore source code: `git clone` from GitHub
2. Set environment variables in Vercel
3. Deploy frontend: `vercel --prod`
4. Deploy backend: `npx convex deploy`
5. Request Convex data restore if needed
6. Verify all routes and functions

## Recovery Time Objectives (RTO)

| Scenario | Target RTO | Process |
|----------|-----------|---------|
| Frontend down | 5 minutes | Vercel auto-recovery or redeploy |
| Backend down | 15 minutes | Convex auto-recovery or redeploy |
| Data loss | 1 hour | Convex restore + verification |
| Full system | 2 hours | Full redeploy + restore |
