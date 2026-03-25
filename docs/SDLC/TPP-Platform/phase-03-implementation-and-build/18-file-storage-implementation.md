# File Storage Implementation â€” TPP Platform

## Provider: Convex File Storage

### Upload Flow
```typescript
// 1. Generate upload URL
const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// 2. Upload from client
const uploadUrl = await generateUploadUrl();
const result = await fetch(uploadUrl, { method: "POST", body: file });
const { storageId } = await result.json();

// 3. Store reference in database
await createReport({ storageId, fileName: file.name });
```

### Download Flow
```typescript
// Get URL for stored file
const getFileUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
```

### File Types & Limits
| Type | Extensions | Max Size |
|------|-----------|----------|
| Reports | .pdf, .xlsx, .csv | 10MB |
| Avatars | .jpg, .png, .webp | 2MB |
| Documents | .pdf, .doc, .docx | 10MB |

### Security
- Auth required for upload URL generation
- Storage IDs are opaque (unguessable)
- Permission check before serving files
- Virus scanning: not included (Convex limitation)
