# Use Case Specifications

## UC-001: User Authentication
**Actor**: All users
**Precondition**: User has valid credentials

**Main Flow**:
1. User navigates to login
2. System displays login form
3. User enters credentials
4. System validates via Clerk
5. User is redirected to dashboard

## UC-002: View Academic Records
**Actor**: Student, Parent, Coordinator
**Precondition**: User is authenticated

**Main Flow**:
1. User navigates to Academics section
2. System queries academic records
3. System displays records with trends

## UC-003: Create Tutoring Group
**Actor**: Coordinator
**Precondition**: User has coordinator role

**Main Flow**:
1. Coordinator clicks "Create Group"
2. System displays form
3. Coordinator selects subject, tutor, students
4. System validates and creates group
