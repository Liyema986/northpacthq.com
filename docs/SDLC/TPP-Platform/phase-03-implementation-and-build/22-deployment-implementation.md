# Deployment Implementation â€” TPP Platform

## Deployment Pipeline

```mermaid
flowchart LR
    A[Git Push] --> B[Vercel Build]
    B --> C{Build OK?}
    C -->|No| D[Notify: Build Failed]
    C -->|Yes| E[Deploy Preview]
    E --> F{Is main branch?}
    F -->|No| G[Preview URL ready]
    F -->|Yes| H[Deploy Production]
    H --> I[Convex Deploy]
    I --> J[Health Check]
    J --> K{Healthy?}
    K -->|Yes| L[Complete]
    K -->|No| M[Auto-Rollback]
```

## Environment Setup

### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add NEXT_PUBLIC_CONVEX_URL
```

### Convex
```bash
# Development
npx convex dev

# Production deploy
npx convex deploy

# Set Convex env vars
npx convex env set RESEND_API_KEY re_xxx
npx convex env set CLERK_WEBHOOK_SECRET whsec_xxx
```

## Production Checklist
- [ ] All env vars set in Vercel
- [ ] All env vars set in Convex
- [ ] Clerk production instance configured
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Security headers verified
- [ ] Error tracking configured
- [ ] Backup strategy confirmed
