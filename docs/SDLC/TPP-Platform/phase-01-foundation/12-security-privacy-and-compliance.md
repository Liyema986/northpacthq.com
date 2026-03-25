# Security, Privacy & Compliance

## Security Controls (SEC-###)

### SEC-001: Input Validation
- **Description**: All user inputs validated server-side
- **Priority**: CRITICAL

### SEC-002: SQL Injection Prevention
- **Description**: Parameterized queries only (Convex enforced)
- **Priority**: CRITICAL

### SEC-003: XSS Prevention
- **Description**: Output encoding for all dynamic content
- **Priority**: CRITICAL

### SEC-004: CSRF Protection
- **Description**: JWT tokens with SameSite cookies
- **Priority**: HIGH

### SEC-005: Audit Logging
- **Description**: All data changes logged with user attribution
- **Priority**: HIGH


## Authentication
- JWT tokens via Clerk
- Token expiration: 7 days
- Refresh token rotation
- Session invalidation on logout

## Authorization
- Role-based access control (RBAC)
- Permission matrix enforced in Convex
- Middleware route protection

## Data Protection
- Passwords hashed with bcrypt
- PII encrypted at rest
- HTTPS only
- CSRF protection via SameSite cookies

## Compliance
- POPIA (South Africa) compliant
- Right to erasure supported
- Data retention: 7 years
