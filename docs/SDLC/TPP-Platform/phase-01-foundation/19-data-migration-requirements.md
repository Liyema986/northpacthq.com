# Data Migration Requirements

## Migration Strategy
- Export from existing system
- Transform to Convex format
- Import via Convex dashboard
- Validate data integrity

## Data Mapping
| Source Field | Target Field | Transform |
|--------------|--------------|-----------|
| student_id | clerkId | Generate mapping |
| name | firstName, lastName | Split |
| email | email | Direct |
| grade | grade | Direct |

## Rollback Plan
- Maintain source system during migration
- Daily backups
- Test rollback procedure
