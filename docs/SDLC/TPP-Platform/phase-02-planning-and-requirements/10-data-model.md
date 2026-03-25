# Data Model

## Entity Relationship Diagram

See schema.ts for full definition.

## Key Relationships
- User 1:N AcademicRecords
- User 1:N TutoringGroups
- User 1:N Interventions
- TutoringGroup N:N Users (students)

## Indexes
See convex/schema.ts for index definitions.
