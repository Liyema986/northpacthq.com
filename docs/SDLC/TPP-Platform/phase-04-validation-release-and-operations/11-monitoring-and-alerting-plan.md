# Monitoring & Alerting Plan â€” TPP Platform

## Monitoring Dashboard

### Vercel Analytics (Frontend)
- Page views, unique visitors
- Core Web Vitals (LCP, FID, CLS)
- Error rate, success rate
- Geographic distribution

### Convex Dashboard (Backend)
- Function execution time
- Query and mutation counts
- Database size and growth
- Bandwidth usage
- Error logs

### Clerk Dashboard (Auth)
- Active users, sign-ups
- Auth failures, lockouts
- Session duration

## Alert Configuration

| Alert | Condition | Channel | Severity |
|-------|-----------|---------|----------|
| High Error Rate | > 10 errors/min for 5 min | Email | P1 |
| Slow Response | P95 > 3s for 10 min | Email | P2 |
| Auth Failure Spike | > 50 failures/hour | Email | P1 |
| Database Near Limit | > 80% storage | Email | P2 |
| Deploy Failure | Build fails on main | Email | P1 |
| SSL Expiry | < 14 days to expiry | Email | P2 |

## On-Call Rotation
- **Primary**: Lead Developer (24/7 for P1)
- **Secondary**: Project Owner (business hours)
- **Escalation**: Convex/Vercel/Clerk support (platform issues)

## Health Check Endpoints
```
GET / â†’ 200 (public page loads)
GET /api/health â†’ 200 (API responds) [to be implemented]
GET /dashboard â†’ 302 or 200 (auth works)
```
