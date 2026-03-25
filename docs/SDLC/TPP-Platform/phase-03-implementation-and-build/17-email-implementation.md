# Email Implementation â€” TPP Platform

## Provider: Resend (via Convex Actions)

### Setup
```typescript
// convex/actions/sendEmail.ts
import { action } from "../_generated/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
```

### Email Templates

| Template | Trigger | Recipients |
|----------|---------|------------|
| Welcome | User registration | New user |
| At-Risk Alert | Performance < 50% | Coordinator + Parent |
| Intervention Created | New intervention | Student + Tutor |
| Weekly Digest | Cron (weekly) | All coordinators |
| Password Reset | User request | Requesting user |

### Implementation Pattern
```typescript
export const sendAtRiskAlert = action({
  args: { studentId: v.id("users"), coordinatorId: v.id("users") },
  handler: async (ctx, args) => {
    const student = await ctx.runQuery(api.users.getById, { id: args.studentId });
    const coordinator = await ctx.runQuery(api.users.getById, { id: args.coordinatorId });

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: coordinator.email,
      subject: `At-Risk Alert: ${student.name}`,
      html: renderAtRiskTemplate(student),
    });
  },
});
```

### Environment Variables
- `RESEND_API_KEY` â€” Set in Convex dashboard (not .env.local)
- `RESEND_FROM_EMAIL` â€” Verified domain email
