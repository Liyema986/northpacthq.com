# API Implementation Guide

## Creating a Query
```typescript
export const getAll = query({
  handler: async (ctx) => {
    // Auth check
    // Query database
    // Return results
  },
});
```

## Creating a Mutation
```typescript
export const create = mutation({
  args: { /* validators */ },
  handler: async (ctx, args) => {
    // Auth check
    // Validate input
    // Insert record
    // Return ID
  },
});
```
