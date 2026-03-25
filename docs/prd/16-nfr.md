# NorthPact PRD — Non-Functional Requirements (§12)

---

## 1. Performance

| Requirement | Target | Notes |
|-------------|--------|-------|
| **Page Load Time** | < 2 seconds | Initial load with cached assets |
| **Calculation Latency** | < 100ms | Live summary updates after service changes in builder |
| **API Response Time** | < 500ms | 95th percentile for standard CRUD operations |
| **Search Response** | < 300ms | Client and service search results |

---

## 2. Scalability

| Requirement | Target | Notes |
|-------------|--------|-------|
| **Concurrent Users** | 50+ per firm | Support multiple users editing different proposals |
| **Client Groups** | 10,000+ per firm | Large firms with extensive client bases |
| **Proposals** | 50,000+ per firm | Historical and active proposals |
| **Service Templates** | 500+ per firm | Extensive service catalogs |

---

## 3. Reliability

| Requirement | Target | Notes |
|-------------|--------|-------|
| **Uptime** | 99.5% availability | Scheduled maintenance windows excluded |
| **Data Backup** | Daily automated backups | Point-in-time recovery for 30 days |
| **Disaster Recovery** | RTO < 4 hours, RPO < 1 hour | Recovery time and point objectives |

---

## 4. Browser Support

| Browser | Versions |
|---------|----------|
| Chrome | Latest 2 versions |
| Edge | Latest 2 versions |
| Safari | Latest 2 versions |
| Firefox | Latest 2 versions |

**Primary target:** Desktop browsers.  
**Secondary:** Responsive layouts for tablet and mobile (builder optimised for desktop).

---

## 5. Accessibility

| Requirement | Target |
|-------------|--------|
| Standard | WCAG 2.1 AA compliance |
| Keyboard navigation | All interactive elements accessible |
| Screen reader support | Proper ARIA labels and announcements |
| Colour contrast | Minimum 4.5:1 ratio |
| Reduced motion | Respect user preferences |

---

## 6. Data Export

| Format | Use Case |
|--------|----------|
| **CSV** | Client lists, proposal data, cash flow projections |
| **XLSX** | Detailed reports with formatting |
| **PDF** | Proposals and engagement letters |
| **DOCX** | Editable engagement letters |

---

## 7. Audit Trail

| Requirement | Detail |
|-------------|--------|
| All proposal state changes logged | Who changed what and when |
| Entity modifications tracked | Changes to client groups and entities |
| User actions recorded | Login, proposal creation, sending, acceptance |
| Retention | Audit log retained for minimum 2 years |

---

## 8. Internationalisation (Future)

| Aspect | Current | Future |
|--------|---------|--------|
| Currency | ZAR only | Multi-currency support |
| Language | English only | Afrikaans, other official SA languages |
| Date format | DD/MM/YYYY | Configurable per firm |
| Number format | Space as thousands separator | Configurable |
