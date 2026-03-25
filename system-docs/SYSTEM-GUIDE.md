# TPP Platform â€” System Guide

## 1. What This System Does

The TPP (Tertiary Preparation Programme) Platform is a comprehensive student performance tracking and intervention management system for Sol Plaatje University. It enables educators, coordinators, and administrators to:

- Track student academic performance across multiple terms
- Identify at-risk students using automated algorithms
- Coordinate tutoring interventions
- Manage tutoring groups and schedules
- Facilitate communication between stakeholders
- Generate reports and analytics

## 2. Architecture

### Tech Stack
| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Convex (serverless database + functions) |
| Authentication | Clerk |
| Deployment | Vercel |
| File Storage | Convex File Storage |

### Data Flow
```
User â†’ Clerk Auth â†’ JWT Token â†’ Convex Functions â†’ Database
                â†“
              Real-time subscriptions â†’ UI Updates
```

## 3. User Roles & Permissions

| Role | Can View | Can Create | Can Update | Can Delete |
|------|----------|------------|------------|------------|
| Student | Own records | âŒ | Own profile | âŒ |
| Parent | Linked child's records | âŒ | Own profile | âŒ |
| Tutor | Assigned students | Comments | Own profile | âŒ |
| Coordinator | All students/staff | Students, Groups, Interventions | All records | âŒ |
| Admin | Everything | Everything | Everything | Soft delete |
| Management | Everything | Everything | Everything | Soft delete |
| Funder | Reports, Analytics | âŒ | âŒ | âŒ |

## 4. Route Map

| Route | Access | Purpose |
|-------|--------|---------|
| / | Public | Landing page |
| /auth/login | Public | Sign in |
| /auth/register | Public | Sign up |
| /dashboard | Auth | Main dashboard |
| /dashboard/students | Admin/Coordinator | Student management |
| /dashboard/academics | Auth | Academic records |
| /dashboard/tutoring | Auth | Tutoring groups |
| /dashboard/interventions | Auth | Intervention tracking |
| /dashboard/reports | Auth | Reports |
| /dashboard/analytics | Coordinator+ | Analytics dashboard |
| /dashboard/funder | Funder | Funder reports |
| /settings | Auth | User settings |
| /profile | Auth | User profile |

## 5. Database Schema Summary

### Core Tables
- **users**: User accounts with Clerk integration
- **academicRecords**: Student academic performance
- **tutoringGroups**: Tutoring group assignments
- **interventions**: Intervention tracking
- **notifications**: User notifications
- **messages**: User-to-user messaging
- **comments**: Comments on student records

### Key Indexes
- by_clerkId (users)
- by_userId (all related tables)
- by_status
- by_createdAt

## 6. Error Codes Reference

| Code | Message | User Action |
|------|---------|-------------|
| ERR-001 | Please sign in to continue | Sign in |
| ERR-002 | You don't have permission to do that | Contact admin |
| ERR-003 | Record not found | Check URL |
| ERR-004 | Invalid data provided | Check inputs |
| ERR-005 | Duplicate entry | Use different values |
| ERR-006 | Something went wrong on our end | Try again |
| ERR-007 | Network error | Check connection |

## 7. Operational Runbook

### How to Add a User
1. New users sign up via /auth/register
2. User is automatically synced to Convex
3. Admin can change role via user management

### How to Reset a Password
1. User clicks "Forgot password" on login
2. Clerk sends reset email
3. User follows email link
4. Password is updated in Clerk

### How to Create a Tutoring Group
1. Navigate to /dashboard/tutoring
2. Click "Create Group"
3. Select subject, tutor, and students
4. Save group

### How to Mark a Student At-Risk
1. Navigate to student's academic record
2. Update performance status to "at_risk"
3. System automatically creates notification
4. Coordinator receives alert

## 8. Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Clerk public key | Yes |
| CLERK_SECRET_KEY | Clerk secret key | Yes |
| NEXT_PUBLIC_CONVEX_URL | Convex deployment URL | Yes |
| RESEND_API_KEY | Email service API key | No |
| PASSWORD_PEPPER | Password hashing secret | Yes |

## 9. Known Constraints

- Maximum 10,000 concurrent users (Convex limit)
- File uploads limited to 10MB per file
- Real-time sync requires WebSocket connection
- Mobile app not included (responsive web only)

## 10. Glossary

| Term | Definition |
|------|------------|
| At-Risk | Student with performance below 50% |
| Intervention | Support action for struggling students |
| Coordinator | Staff managing tutoring programs |
| Convex | Serverless database and backend platform |
| Clerk | Authentication and user management service |

---

**Generated**: 2026-03-23T12:05:25.148Z
**Version**: 1.0.0
**System**: TPP Platform
