# System Architecture

## Tech Stack
- Frontend: Next.js 16 + React + TypeScript
- Styling: Tailwind CSS + shadcn/ui
- Backend: Convex (serverless)
- Auth: Clerk
- Hosting: Vercel

## Architecture Diagram

```
[User] â†’ [Vercel Edge] â†’ [Next.js App]
                     â†“
              [Clerk Auth]
                     â†“
              [Convex DB]
```

## Security Layers
1. Vercel Edge protection
2. Clerk JWT validation
3. Convex auth checks
4. RBAC permission checks
