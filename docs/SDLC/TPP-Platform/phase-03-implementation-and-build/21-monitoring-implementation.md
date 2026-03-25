# Monitoring Implementation â€” TPP Platform

## Monitoring Stack

| Aspect | Tool | Purpose |
|--------|------|---------|
| Error Tracking | Convex logs + console | Runtime errors |
| Performance | Vercel Analytics | Core Web Vitals |
| Uptime | Vercel (built-in) | Availability |
| Database | Convex Dashboard | Query performance |
| Auth | Clerk Dashboard | Auth events |

## Key Metrics

### Application Metrics
- Error rate (errors/minute)
- P95 response time
- Active users (concurrent)
- Mutation success rate

### Infrastructure Metrics
- Convex function execution time
- Database document count
- File storage usage
- Bandwidth consumption

## Alerting Rules

| Metric | Threshold | Action |
|--------|----------|--------|
| Error rate | > 10/min | Email alert |
| Response time P95 | > 2000ms | Slack alert |
| Auth failures | > 50/hour | Security review |
| Storage usage | > 80% | Capacity planning |

## Logging Pattern
```typescript
// All Convex mutations log operations
console.log(`[AUDIT] ${user.email} ${action} ${entity} ${id}`);
console.error(`[ERROR] ${errorCode} ${message}`);
```
