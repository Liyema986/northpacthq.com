# Form Validation Guide

## React Hook Form + Zod
```typescript
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

const form = useForm({
  resolver: zodResolver(schema),
});
```

## Error Display
Inline errors with FormMessage component.
