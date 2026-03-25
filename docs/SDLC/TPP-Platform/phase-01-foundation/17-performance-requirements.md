# Performance Requirements

## Core Web Vitals Targets

| Metric | Target | Good |
|--------|--------|------|
| LCP (Largest Contentful Paint) | < 2.5s | < 1.5s |
| FID (First Input Delay) | < 100ms | < 50ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0 |
| TTFB (Time to First Byte) | < 600ms | < 200ms |

## Optimization Strategies
- Image optimization via Next.js Image
- Code splitting
- Convex query caching
- Skeleton loading states
- Preload critical resources
