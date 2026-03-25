# Risk Management Plan â€” TPP Platform

## Risk Register (from Phase 1 RISK-### IDs)

### RISK-001: Data migration failure
- **Probability**: LOW
- **Impact**: HIGH
- **Risk Score**: 1 x 3 = 3
- **Mitigation**: Backup before migration
- **Contingency**: Activate rollback plan, notify stakeholders
- **Owner**: Lead Developer

### RISK-002: Authentication bypass
- **Probability**: LOW
- **Impact**: CRITICAL
- **Risk Score**: 1 x 4 = 4
- **Mitigation**: Clerk security best practices
- **Contingency**: Activate rollback plan, notify stakeholders
- **Owner**: Lead Developer

### RISK-003: Performance degradation
- **Probability**: MEDIUM
- **Impact**: MEDIUM
- **Risk Score**: 2 x 2 = 4
- **Mitigation**: Convex indexes + caching
- **Contingency**: Activate rollback plan, notify stakeholders
- **Owner**: Lead Developer

### RISK-004: Vendor lock-in (Convex)
- **Probability**: LOW
- **Impact**: MEDIUM
- **Risk Score**: 1 x 2 = 2
- **Mitigation**: Abstract data layer
- **Contingency**: Activate rollback plan, notify stakeholders
- **Owner**: Lead Developer


## Additional Technical Risks

### RISK-005: Convex Rate Limiting
- **Probability**: MEDIUM | **Impact**: MEDIUM
- **Mitigation**: Implement pagination, query optimization, Convex indexes
- **Contingency**: Request rate limit increase from Convex

### RISK-006: Clerk Service Outage
- **Probability**: LOW | **Impact**: HIGH
- **Mitigation**: Clerk has 99.99% SLA; implement graceful degradation
- **Contingency**: Cache auth state locally, show maintenance page

### RISK-007: Scope Creep
- **Probability**: HIGH | **Impact**: MEDIUM
- **Mitigation**: Strict MVP features per project-overview.md; change request process
- **Contingency**: Defer non-MVP features to v2

## Risk Response Strategies

| Strategy | When Used | Example |
|----------|-----------|---------|
| **Avoid** | Probability AND impact are high | Don't store PII client-side |
| **Mitigate** | Can reduce probability/impact | Add rate limiting, caching |
| **Transfer** | Someone else handles it better | Use Clerk for auth (not DIY) |
| **Accept** | Low risk, not worth mitigating | Minor UI inconsistencies |

## Risk Review Cadence
- **Weekly**: Review active risks during sprint
- **Monthly**: Full risk register review with sponsor
- **Per Release**: Pre-deploy risk assessment
