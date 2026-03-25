# Use Case Diagrams â€” TPP Platform

## System Use Case Overview

```mermaid
graph TB
    subgraph "TPP Platform System"
        UC1[View Dashboard]
        UC2[Manage Students]
        UC3[Track Academics]
        UC4[Manage Tutoring Groups]
        UC5[Create Interventions]
        UC6[Send Messages]
        UC7[Generate Reports]
        UC8[Manage Users]
        UC9[View Analytics]
        UC10[View Child Progress]
    end

    Student((Student))
    Parent((Parent))
    Tutor((Tutor))
    Coordinator((Coordinator))
    Admin((Admin))
    Funder((Funder))

    Student --> UC1
    Student --> UC3
    Parent --> UC10
    Tutor --> UC1
    Tutor --> UC3
    Tutor --> UC6
    Coordinator --> UC1
    Coordinator --> UC2
    Coordinator --> UC3
    Coordinator --> UC4
    Coordinator --> UC5
    Coordinator --> UC7
    Coordinator --> UC9
    Admin --> UC8
    Admin --> UC2
    Admin --> UC7
    Admin --> UC9
    Funder --> UC9
    Funder --> UC7
```

## Use Case Details

### UC-001: View Dashboard
- **Actors**: All authenticated users
- **Precondition**: User is signed in
- **Main Flow**: System displays role-appropriate dashboard with stats cards, recent activity, and quick actions
- **Extensions**: Dashboard content varies by role (student sees own performance, coordinator sees all students)

### UC-002: Manage Students
- **Actors**: Coordinator, Admin, Management
- **Precondition**: User has VIEW_ALL_STUDENTS permission
- **Main Flow**: View student list â†’ Search/Filter â†’ View details â†’ Create/Edit/Archive student
- **Business Rules**: Only admin can archive; coordinator can create and edit

### UC-003: Track Academic Records
- **Actors**: Student (own), Tutor (assigned), Coordinator (all), Admin (all)
- **Precondition**: User has appropriate view permission
- **Main Flow**: Navigate to academics â†’ View records â†’ Filter by term/subject â†’ View trends

### UC-004: Manage Tutoring Groups
- **Actors**: Coordinator, Admin
- **Precondition**: User has CREATE_TUTORING_GROUP permission
- **Main Flow**: Create group â†’ Assign tutor â†’ Add students â†’ Set schedule â†’ Activate
