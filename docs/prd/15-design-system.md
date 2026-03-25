# NorthPact PRD — Design System & UI/UX (§11)

---

## 0. UI Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Component library** | shadcn/ui (new-york style, neutral base) | latest |
| **CSS framework** | Tailwind CSS | v4 |
| **Animation** | Framer Motion | 12.31.0 |
| **Icons** | Lucide React | 0.5x |
| **Toast / notifications** | Sonner | 2.x |
| **Drag & drop** | @dnd-kit/core + @dnd-kit/sortable | 6.x / 10.x |
| **Rich text** | TipTap | 3.x |
| **Charts** | Recharts | 3.7.0 |

---

## 1. Theme Tokens

| Token | Purpose |
|-------|---------|
| `--background` | Page background |
| `--foreground` / `--foreground-strong` | Default and emphasised text |
| `--card` | Card surfaces |
| `--secondary` | Subtle backgrounds |
| `--accent` | Primary action colour |
| `--muted-foreground` | Secondary text |
| `--success` | Positive values and accepted status |
| `--destructive` | Delete actions, expired status, errors |
| `--category-monthly` / `--category-monthly-border` | Monthly billing category (blue) |
| `--category-yearly` / `--category-yearly-border` | Yearly billing category (violet) |
| `--category-onceoff` / `--category-onceoff-border` | Once-off billing category (amber) |
| `--sidebar` / `--sidebar-*` | Navigation sidebar |

---

## 2. Component Library

Built on **shadcn/ui** components (Radix UI primitives + **Tailwind CSS v4**):

**Base components:** Button, Card, Dialog, Sheet, Select, Popover, Collapsible, Tabs, Badge, Tooltip, ScrollArea, Accordion, Input, Textarea, Label, Checkbox, RadioGroup, Switch, Separator, Skeleton, Progress, DropdownMenu, Form.

**Custom components:**

| Component | Location | Purpose |
|-----------|----------|---------|
| `ProposalCard` | Proposal builder | Service card on the canvas |
| `ProposalCanvas` | Proposal builder | Centre panel with drop zones |
| `ServiceLibrary` | Proposal builder | Left panel with draggable services |
| `LiveSummary` | Proposal builder | Right panel with real-time calculations |
| `ServiceConfigDrawer` | Proposal builder | 720px sheet for service configuration |
| `EntitySetupPanel` | Proposal builder | Entity toggle and management |
| `DropZone` | Proposal builder | Category-specific drop target |
| `NavLink` | Layout | Active-aware navigation link |
| `ClientGroupSelector` | Proposal builder | Group selection with search |
| `AttentionToSelector` | Proposal builder | Contact person picker |
| `EngagementLetterPreview` | Engagement | Letter preview with merge fields resolved |

---

## 3. Visual Patterns

| Pattern | Usage |
|---------|-------|
| Card shadow with hover elevation | All interactive cards |
| Consistent category colour coding (blue/violet/amber) | Across all billing category indicators |
| Collapsible sections with chevron toggle | Entity cards, category groups |
| Filter chips as rounded pill buttons | Entity and status filtering |
| Segmented toggles | Mode switches (Single Entity / Client Group) |
| Status badges | Draft (grey), Pending-Approval (orange), Approved (teal), Sent (blue), Viewed (indigo), Accepted (green), Rejected (red), Expired (amber) |

---

## 4. Status Badge Colours

| Status | Background | Text | Usage |
|--------|-----------|------|-------|
| Draft | `bg-gray-100` | `text-gray-700` | Proposal not yet sent |
| Pending-Approval | `bg-orange-100` | `text-orange-700` | Awaiting internal approval |
| Approved | `bg-teal-100` | `text-teal-700` | Approved, ready to send |
| Sent | `bg-blue-100` | `text-blue-700` | Proposal sent to client |
| Viewed | `bg-indigo-100` | `text-indigo-700` | Client opened the proposal |
| Accepted | `bg-green-100` | `text-green-700` | Client accepted |
| Rejected | `bg-red-100` | `text-red-700` | Client rejected |
| Expired | `bg-amber-100` | `text-amber-700` | Past validity date |

---

## 5. Billing Category Colours

| Category | Primary | Border | Background |
|----------|---------|--------|------------|
| Monthly | Blue-500 | Blue-300 | Blue-50 |
| Yearly | Violet-500 | Violet-300 | Violet-50 |
| Once-off | Amber-500 | Amber-300 | Amber-50 |

---

## 6. Icons

Using **Lucide React** icon library.

| Icon | Usage |
|------|-------|
| `LayoutDashboard` | Dashboard nav |
| `FileText` | Proposals |
| `Users` | Clients / Payroll |
| `Layers` | Services |
| `PenTool` | Engagement letters |
| `Settings` | Settings |
| `DollarSign` | Cash flow |
| `Calendar` | Work planning |
| `BookOpen` | Bookkeeping category |
| `TrendingUp` | Advisory category |
| `Shield` | Compliance category |
| `Building` | Company Secretarial |
| `Briefcase` | Once-off Projects |
| `Wrench` | Custom category |
| `GripVertical` | Drag handles |
| `Plus` | Create/add |
| `Search` | Search inputs |
| `ChevronDown` | Expand/collapse |

---

## 7. Typography

| Element | Size | Weight |
|---------|------|--------|
| H1 | `text-3xl` | `font-bold` |
| H2 | `text-2xl` | `font-semibold` |
| H3 | `text-xl` | `font-semibold` |
| H4 | `text-lg` | `font-medium` |
| Body | `text-base` | `font-normal` |
| Small | `text-sm` | `font-normal` |
| Caption | `text-xs` | `font-medium` |

---

## 8. Responsive Design

| Component | Mobile/Tablet | Desktop |
|-----------|--------------|---------|
| Sidebar | Sheet/drawer (hidden by default) | Fixed sidebar |
| Proposal Builder | Stacked panels (library → canvas → summary) | 3-column side-by-side |
| Data tables | Card list format | Full table with columns |
| Service Config Drawer | Full-screen sheet | 720px side sheet |
| Dashboard | Stacked KPI cards | Grid layout |
| Settings | Single-column tabs | Sidebar + content layout |

**Note:** The proposal builder is optimised for desktop. Other pages are fully responsive.

---

## 9. Accessibility (WCAG 2.1 AA)

| Requirement | Implementation |
|-------------|---------------|
| Keyboard navigation | All interactive elements reachable via Tab/Enter/Space |
| Focus management | Focus trapped in modals/drawers, restored on close |
| Screen reader labels | ARIA labels on all custom components |
| Colour contrast | Minimum 4.5:1 for text, 3:1 for large text |
| Reduced motion | Respect `prefers-reduced-motion` media query |
| Drag-and-drop alternative | Keyboard-based reordering (up/down buttons) |
