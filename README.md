# Employee Leave Management & Internal Help Desk System

A full-stack enterprise web application for employee management, leave requests and balance tracking, approval workflows, and internal IT help desk ticketing with SLA monitoring.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture & Domains](#system-architecture--domains)
- [User Personas](#user-personas)
- [Technology Stack](#technology-stack)
- [Project Directory Structure](#project-directory-structure)
- [Local Setup and Installation](#local-setup-and-installation)
  - [1. Database Setup](#1-database-setup)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
- [Running in VS Code](#running-in-vs-code)

---

## Overview

The system consolidates core employee workflows into a unified platform:
- **Identity & RBAC**: User accounts, departments, line manager reporting hierarchy, and role-based permissions.
- **Leave Management**: Leave policies, automatic allowance accruals, request state machines, and multi-stage manager/HR approvals.
- **Internal Help Desk**: Support ticket triage, priority levels, queue management, agent assignment, and SLA breach monitoring.
- **Out of Office (OOO) Integration**: When an agent's leave is approved, open tickets are automatically re-routed to active team members.

---

## System Architecture & Domains

```
[ Frontend: React + TypeScript (Vite) ]
                   |
            REST APIs / JWT
                   |
                   v
[ Backend: Spring Boot 3 (Port 8080) ]
  ├── auth/            (Authentication & Security)
  ├── identity/        (Users, Roles, Hierarchy)
  ├── leave/           (Leave State Machine & Accrual Engine)
  ├── helpdesk/        (Tickets, Triage & SLA Engine)
  └── notification/    (Email, Slack & OOO Sync Handler)
                   |
                   v
[ Database: PostgreSQL (leave_mgt_db) ]
```

---

## User Personas

1. **Employee (Requester)**
   - View leave balances and request leaves.
   - Submit help desk incident tickets and collaborate via comments.
2. **Line Manager (Approver)**
   - Review and approve/reject leave requests from direct reports.
3. **HR Admin**
   - Configure leave policies, allowances, and departments.
4. **Support Agent**
   - Resolve assigned help desk tickets and meet SLA targets.

---

## Technology Stack

### Backend
- **Language**: Java 19
- **Framework**: Spring Boot 3.2.3
- **Security**: Spring Security, JWT (jjwt 0.12.6)
- **Database Access**: Spring Data JPA, Hibernate, PostgreSQL JDBC Driver
- **Build Tool**: Maven Wrapper (`mvnw`, `mvnw.cmd`)
- **Productivity**: Project Lombok

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios

### Database
- **Engine**: PostgreSQL 14+ (Local: PostgreSQL 18 on `localhost:5432`)
- **Database Name**: `leave_mgt_db`
- **Schema**: `public` (23 relational tables)

---

## Project Directory Structure

```text
employee magt and internal help desk system/
├── backend/                               <-- Spring Boot 3 Application
│   ├── .mvn/                              <-- Maven Wrapper configuration
│   ├── mvnw, mvnw.cmd                     <-- Maven Wrapper scripts
│   ├── pom.xml                            <-- Maven dependencies & plugins
│   └── src/
│       ├── main/java/com/leavemgt/
│       │   ├── LeaveManagementApplication.java
│       │   ├── auth/                      <-- Authentication & JWT
│       │   ├── identity/                  <-- Users, Roles, Departments
│       │   ├── leave/                     <-- Requests, Balances, Policies
│       │   ├── helpdesk/                  <-- Tickets, Categories, SLA
│       │   ├── notification/              <-- Dispatchers & OOO Handler
│       │   └── common/                    <-- ApiResponse, Config, Exceptions
│       └── main/resources/
│           └── application.yml            <-- Database & server configuration
│
├── frontend/                              <-- React 18 + Vite Application
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       └── main.tsx
│
├── database/
│   └── schema.sql                         <-- Full PostgreSQL DDL (23 tables)
│
├── .vscode/
│   ├── launch.json                        <-- VS Code Run/Debug configurations
│   └── settings.json                      <-- Database Client connection profile
│
├── .gitignore
└── README.md
```

---

## Local Setup and Installation

### 1. Database Setup
The PostgreSQL database `leave_mgt_db` is already configured with all 23 tables. If you ever need to re-initialize:
```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d leave_mgt_db -f "database\schema.sql"
```

### 2. Backend Setup
Navigate into `backend/` and run using the Maven wrapper:
```powershell
cd backend
.\mvnw.cmd clean spring-boot:run
```
The backend starts on `http://localhost:8080`.

### 3. Frontend Setup
Navigate into `frontend/` and run:
```powershell
cd frontend
npm install
npm run dev
```
The frontend starts on `http://localhost:5173`.
