# Rollback Plan â€” TPP Platform

## Rollback Triggers
- P1 bug affecting > 50% of users
- Security vulnerability discovered
- Data corruption detected
- Performance degradation > 5x baseline

## Rollback Procedures

### Frontend Rollback (Vercel)
```bash
# Option 1: Instant rollback to previous deployment
vercel rollback

# Option 2: Redeploy specific commit
git checkout <previous-commit>
vercel --prod
```

### Backend Rollback (Convex)
```bash
# Convex deployments are versioned
# Redeploy previous version
git checkout <previous-commit>
npx convex deploy

# CAUTION: Schema changes may need manual migration
```

### Database Rollback
- Convex provides automatic backups
- Contact Convex support for point-in-time recovery
- Backup frequency: continuous (managed by Convex)

## Rollback Decision Matrix

| Scenario | Frontend | Backend | Database | Time |
|----------|----------|---------|----------|------|
| UI-only bug | Rollback | Keep | Keep | 2 min |
| API bug | Keep | Rollback | Keep | 5 min |
| Schema migration issue | Rollback | Rollback | Restore | 30 min |
| Security breach | Rollback | Rollback | Audit | 1 hour |

## Communication During Rollback
1. Notify development team immediately
2. Post status update within 15 minutes
3. Root cause analysis within 24 hours
4. Post-mortem within 48 hours

## Responsible Parties

| Role | Responsibility |
|------|---------------|
| Lead Developer | Execute rollback, coordinate |
| Project Owner | Approve rollback, communicate to stakeholders |
| Convex Support | Database recovery if needed |
