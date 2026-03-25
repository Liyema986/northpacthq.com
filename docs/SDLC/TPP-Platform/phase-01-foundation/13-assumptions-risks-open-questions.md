# Assumptions, Risks & Open Questions

## Risk Register (RISK-###)

### RISK-001: Data migration failure
- **Probability**: LOW
- **Impact**: HIGH
- **Mitigation**: Backup before migration

### RISK-002: Authentication bypass
- **Probability**: LOW
- **Impact**: CRITICAL
- **Mitigation**: Clerk security best practices

### RISK-003: Performance degradation
- **Probability**: MEDIUM
- **Impact**: MEDIUM
- **Mitigation**: Convex indexes + caching

### RISK-004: Vendor lock-in (Convex)
- **Probability**: LOW
- **Impact**: MEDIUM
- **Mitigation**: Abstract data layer


## Assumptions
1. Users have stable internet connection
2. Modern browser usage (Chrome, Firefox, Safari, Edge)
3. Clerk and Convex services remain available
4. University provides student data export

## Open Questions
1. Integration with existing student information system?
2. SMS notification requirements?
3. Offline mode needed?
