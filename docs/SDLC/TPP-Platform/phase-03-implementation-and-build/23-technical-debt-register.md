# Technical Debt Register â€” TPP Platform

## Current Debt Items

| ID | Description | Priority | Effort | Impact |
|----|-------------|----------|--------|--------|
| TD-001 | Replace regex AST with Babel parser for component transforms | Medium | 3 days | Handles edge cases |
| TD-002 | Add comprehensive input sanitization | High | 1 day | Security hardening |
| TD-003 | Implement proper rate limiting | Medium | 2 days | Abuse prevention |
| TD-004 | Add proper logging/monitoring integration | Medium | 2 days | Observability |
| TD-005 | Optimize Convex queries with compound indexes | Low | 1 day | Performance at scale |
| TD-006 | Add offline support / PWA | Low | 5 days | Mobile UX |
| TD-007 | Implement proper i18n framework | Low | 3 days | Localization |
| TD-008 | Add end-to-end encryption for messages | Medium | 3 days | Privacy |
| TD-009 | Implement audit log viewer in admin | Medium | 2 days | Compliance |
| TD-010 | Add data export functionality (GDPR/POPIA) | High | 2 days | Legal compliance |

## Debt Categories

| Category | Items | Total Effort |
|----------|-------|--------------|
| Security | TD-002, TD-003, TD-008 | 6 days |
| Performance | TD-001, TD-005 | 4 days |
| Compliance | TD-009, TD-010 | 4 days |
| Features | TD-006, TD-007 | 8 days |
| Observability | TD-004 | 2 days |

## Resolution Strategy
1. **Sprint allocation**: 20% of each sprint for debt reduction
2. **Priority**: Security > Compliance > Performance > Features
3. **Review**: Monthly debt assessment
