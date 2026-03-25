# Error Handling Implementation â€” TPP Platform

## ERR-### Code Registry

| Code | HTTP | Message | User Action | Severity |
|------|------|---------|-------------|----------|
| ERR-001 | â€” | Authentication required | See toast | ERROR |
| ERR-002 | â€” | Permission denied | See toast | WARNING |
| ERR-003 | â€” | Resource not found | See toast | WARNING |
| ERR-004 | â€” | Validation failed | See toast | WARNING |
| ERR-005 | â€” | Duplicate entry | See toast | WARNING |
| ERR-006 | â€” | Database error | See toast | ERROR |
| ERR-007 | â€” | Network error | See toast | ERROR |
| ERR-008 | â€” | Rate limit exceeded | See toast | WARNING |
| ERR-009 | â€” | Service unavailable | See toast | ERROR |
| ERR-010 | â€” | Request timeout | See toast | ERROR |

## Implementation Architecture

### 1. Convex Functions (Server-Side)
```typescript
// All mutations throw with ERR-### prefix
throw new Error("ERR-001: Authentication required");
throw new Error("ERR-002: Permission denied");
throw new Error("ERR-003: Resource not found");
```

### 2. Error Handler (Client-Side)
File: `lib/error-handling.ts`

```typescript
export function handleConvexError(error: unknown): void {
  // 1. Extract ERR-### code from message
  // 2. Look up in ERROR_REGISTRY
  // 3. Display appropriate toast
  // 4. Log to console for debugging
}
```

### 3. Component Integration
```typescript
const handleCreate = async (data) => {
  const toastId = toast.loading("Creating...");
  try {
    await create(data);
    toast.success("Created successfully!", { id: toastId });
  } catch (error) {
    handleConvexError(error); // Auto-maps ERR-### to toast
  }
};
```

## Error Boundary
```
app/error.tsx â€” Global error boundary
app/dashboard/error.tsx â€” Dashboard-specific boundary
```

## Toast Patterns

| Scenario | Toast Type | Duration | Action |
|----------|-----------|----------|--------|
| Success | toast.success | 3s auto | None |
| Validation | toast.error | Manual | Fix inputs |
| Permission | toast.warning | 5s | Contact admin |
| Network | toast.error | Manual | Retry button |
| Server | toast.error | Manual | Try again later |
