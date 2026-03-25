# Error Handling & Feedback

## Error Code Registry (ERR-###)

### ERR-001
- **Message**: Authentication required
- **Category**: Auth
- **Severity**: ERROR
- **User Action**: [Appropriate action]

### ERR-002
- **Message**: Permission denied
- **Category**: Auth
- **Severity**: WARNING
- **User Action**: [Appropriate action]

### ERR-003
- **Message**: Resource not found
- **Category**: Data
- **Severity**: WARNING
- **User Action**: [Appropriate action]

### ERR-004
- **Message**: Validation failed
- **Category**: Input
- **Severity**: WARNING
- **User Action**: [Appropriate action]

### ERR-005
- **Message**: Duplicate entry
- **Category**: Data
- **Severity**: WARNING
- **User Action**: [Appropriate action]

### ERR-006
- **Message**: Database error
- **Category**: System
- **Severity**: ERROR
- **User Action**: [Appropriate action]

### ERR-007
- **Message**: Network error
- **Category**: System
- **Severity**: ERROR
- **User Action**: [Appropriate action]

### ERR-008
- **Message**: Rate limit exceeded
- **Category**: System
- **Severity**: WARNING
- **User Action**: [Appropriate action]

### ERR-009
- **Message**: Service unavailable
- **Category**: System
- **Severity**: ERROR
- **User Action**: [Appropriate action]

### ERR-010
- **Message**: Request timeout
- **Category**: System
- **Severity**: ERROR
- **User Action**: [Appropriate action]


## Feedback Patterns

### Toast Notifications
- Success: Green, checkmark icon, auto-dismiss
- Error: Red, alert icon, manual dismiss
- Warning: Yellow, info icon, auto-dismiss
- Info: Blue, info icon, auto-dismiss

### Form Validation
- Inline errors below fields
- Red border on invalid
- Helper text for format requirements
