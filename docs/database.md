# AI Hiring Intelligence Platform - Database Architecture

The primary database is PostgreSQL. We use Prisma ORM for schema management and migrations.

## 1. Design Principles

- **Multi-Tenancy:** Every entity (except users and global enums) must have an `organizationId` foreign key.
- **Primary Keys:** UUIDs (`String @id @default(uuid())`) are used to obscure row counts and prevent enumeration attacks.
- **Timestamps:** Every model includes `createdAt` and `updatedAt`.
- **Soft Deletes:** Optional, but critical entities like `User`, `Organization`, or `Job` may implement `deletedAt` for soft-deletion.
- **Indexes:** Strategic indexing on foreign keys (e.g., `organizationId`) and frequently queried fields (e.g., `status`, `email`).

## 2. Core Prisma Schema Outline

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==========================================
// 1. Core Platform Entities
// ==========================================

model User {
  id             String               @id @default(uuid())
  email          String               @unique
  passwordHash   String
  firstName      String?
  lastName       String?
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  memberships    OrganizationMember[]
}

model Organization {
  id             String               @id @default(uuid())
  name           String
  slug           String               @unique
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  members        OrganizationMember[]
  jobs           Job[]
  assessments    Assessment[]
  candidates     Candidate[]
}

model OrganizationMember {
  id             String       @id @default(uuid())
  role           Role         @default(RECRUITER)
  userId         String
  organizationId String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
  @@index([organizationId])
}

enum Role {
  SUPER_ADMIN
  ORG_ADMIN
  RECRUITER
  REVIEWER
}

// ==========================================
// 2. ATS & Job Entities
// ==========================================

model Job {
  id             String       @id @default(uuid())
  title          String
  description    String?      @db.Text
  status         JobStatus    @default(DRAFT)
  organizationId String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  skills         JobSkill[]
  candidates     Candidate[]

  @@index([organizationId])
}

enum JobStatus {
  DRAFT
  PUBLISHED
  CLOSED
}

model JobSkill {
  id             String       @id @default(uuid())
  name           String
  importance     SkillLevel   @default(REQUIRED)
  jobId          String
  createdAt      DateTime     @default(now())

  job            Job          @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
}

enum SkillLevel {
  NICE_TO_HAVE
  REQUIRED
  CRITICAL
}

// ==========================================
// 3. Assessment & Candidate Entities
// ==========================================

model Assessment {
  id             String       @id @default(uuid())
  title          String
  durationMins   Int          @default(60)
  organizationId String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  interviews     Interview[]
}

model Candidate {
  id             String       @id @default(uuid())
  email          String
  firstName      String?
  lastName       String?
  resumeUrl      String?
  organizationId String
  jobId          String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  job            Job          @relation(fields: [jobId], references: [id])
  interviews     Interview[]

  @@unique([email, jobId]) // A candidate can apply to the same job once
  @@index([organizationId])
  @@index([jobId])
}

// ==========================================
// 4. Interview & Evaluation
// ==========================================

model Interview {
  id             String           @id @default(uuid())
  status         InterviewStatus  @default(INVITED)
  candidateId    String
  assessmentId   String
  score          Float?
  feedback       String?          @db.Text
  startedAt      DateTime?
  completedAt    DateTime?
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  candidate      Candidate        @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  assessment     Assessment       @relation(fields: [assessmentId], references: [id], onDelete: Cascade)

  @@index([candidateId])
}

enum InterviewStatus {
  INVITED
  IN_PROGRESS
  COMPLETED
  EVALUATED
  EXPIRED
}
```

## 3. Future Entities (To Be Added)

- `CodingChallenge`, `CodeSubmission`, `CodeExecution`: For Phase 7.
- `Question`, `QuestionVersion`: For Phase 4 Question Bank.
- `IntegrityEvent`: Tracking tab switches or pastes.
- `Subscription`, `UsageRecord`: For Phase 10 Billing.
