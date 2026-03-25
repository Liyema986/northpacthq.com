# Network Diagram â€” TPP Platform

## Infrastructure Topology

```mermaid
graph TB
    subgraph "Client Layer"
        B1[Browser - Desktop]
        B2[Browser - Mobile]
        B3[Browser - Tablet]
    end

    subgraph "CDN & Edge"
        V[Vercel Edge Network]
    end

    subgraph "Application Layer"
        NJ[Next.js App<br/>Server Components + Client Components]
        MW[Middleware<br/>Route Protection]
    end

    subgraph "Authentication"
        CK[Clerk<br/>JWT + Sessions]
    end

    subgraph "Backend"
        CV[Convex<br/>Serverless Functions]
        DB[(Convex Database)]
        FS[Convex File Storage]
    end

    subgraph "External Services"
        RS[Resend<br/>Email Delivery]
        WH[Webhooks<br/>Clerk Events]
    end

    B1 & B2 & B3 --> V
    V --> NJ
    NJ --> MW
    MW --> CK
    NJ --> CV
    CV --> DB
    CV --> FS
    CV --> RS
    CK --> WH
    WH --> CV
```

## Network Security

| Layer | Protection |
|-------|-----------|
| Client â†’ CDN | HTTPS (TLS 1.3) |
| CDN â†’ App | Vercel internal network |
| App â†’ Clerk | HTTPS + API keys |
| App â†’ Convex | HTTPS + JWT tokens |
| Convex â†’ DB | Internal (encrypted at rest) |

## DNS & Domains
- **Production**: tpp-platform.vercel.app (or custom domain)
- **Staging**: tpp-platform-git-*.vercel.app
- **Convex**: *.convex.cloud (managed)
- **Clerk**: *.clerk.accounts.dev (managed)
