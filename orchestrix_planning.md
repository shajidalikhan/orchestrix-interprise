# Orchestrix Enterprise: Overall Application Architecture & Modules (SaaS & Mobile-Ready)

This document outlines the overall modular structure, roles, and responsibilities of the Orchestrix Enterprise Task Planning and Evaluation platform. It is designed as a decoupled, API-first Software-as-a-Service (SaaS) application capable of serving web clients, mobile apps (iOS/Android), and third-party integrations.

---

## Architecture Design Principles (Mobile & Cross-Platform Ready)
- **API-First & Stateless:** The backend acts strictly as a headless API service. Authentication relies on stateless JWTs compatible with web cookies and mobile secure storage (APNs Keychains/Keystores).
- **Offline Sync Ready:** REST endpoints support incremental delta-fetching (`last_sync_timestamp`) and conflict resolution timestamps to allow mobile clients to work offline and sync when connected.
- **Shared Data Contracts:** Request/Response validation rules (DTOs) and TypeScript interfaces are isolated in a shared definition folder to be reused by Next.js (web) and future mobile clients (e.g., React Native).

---

## 1. Multi-Tenancy & Identity Module (SaaS Core)
**Role:** Manages system users and organized teams (groups) segregated strictly by Organization (Tenant), and enforces secure, context-aware access controls.

*   **Tenant Isolation Engine:** Restricts data access strictly to a company's partition. Every query resolves against the user's specific `tenant_id`.
*   **User Directory Management:** Handles tenant registration, user profiles, and stateless authentication (JWT tokens, refresh tokens, SAML/OIDC SSO).
*   **Cross-Platform JWT Strategy:** Secure storage guidelines for both HttpOnly cookies (web) and Keychain/SecureStore (mobile).
*   **Contextual & Task-Level RBAC Engine:** Maps project-specific roles (Project Owner, Manager, Evaluator, Assignee) dynamically. Additionally, supports fine-grained task execution/delegation permissions.

---

## 2. Project Management Module
**Role:** Serves as the workspace container for tasks, configuration settings, and quality standards within a single tenant partition.

*   **Workspace Control:** Handles project creation, status transitions, and project-wide member assignments.
*   **Evaluation Matrix Configurator:** Defines custom criteria (e.g., Code Quality, Timeliness) and relative weights (adding up to 100%) for task evaluation.

---

## 3. Hierarchical Task Planning Module
**Role:** Powers the Work Breakdown Structure (WBS) by supporting recursive subtasks and managing task lifecycles, deadlines, and resource assignments.

*   **Recursive Task Engine:** Supports infinite levels of child tasks under a parent task to model complex plans.
*   **Delegation & Self-Structuring Controls:** Evaluates assignee permissions per task (Strict Task Mode, Self-Breakdown Mode, Delegation Mode).
*   **Progress Rollup Engine:** Automatically calculates parent task progress based on child task completion status and weights.
*   **Resource Allocation:** Assigns tasks to individual users or groups within the tenant.
*   **Evaluator Assignment:** Links specific individuals or groups as designated quality reviewers.

---

## 4. Automated Integration & Verification Module
**Role:** Eliminates manual verification by automatically checking external systems to confirm that task deliverables are complete.

*   **Endpoint Configuration:** Configures an external HTTP URL (GET/POST) and expected success payload for a task.
*   **Secure Secrets Manager:** Encrypts and securely stores headers/API keys used to call external verification endpoints.
*   **Background Polling & Trigger Worker:** Periodically checks or reacts to webhook completions, verifying and updating task states.

---

## 5. Evaluation & Performance Analytics Module
**Role:** Captures qualitative feedback, scores performances against defined project matrices, synthesizes multi-project involvement, and leverages AI to generate comprehensive appraisals.

*   **Evaluator Console with Remarks:** Interface for evaluators to grade task completions against criteria weights and submit qualitative feedback.
*   **Cross-Project Involvement Aggregator:** Collects metrics across all tasks, projects, and groups an employee has participated in.
*   **Automated LLM Evaluation Reporter:** Integrates an LLM service to analyze numerical performance data, metadata, and qualitative remarks to generate appraisal reports.
*   **Management Analytics Dashboards:** Interactive diagnostic charts displaying KPI ratings, deadline compliance rates, task velocity, workflow blockages, and peer benchmarks.

---

## 6. Agentic RAG & Support Bot Module (Metered)
**Role:** Provides AI-driven query resolution regarding projects or platform operations, and acts as an intelligent support concierge that can escalate problems by raising and routing issues.

*   **Project & Platform Knowledge Base (RAG):** Indexes project documentation, task history, and platform guides. Allows users to query project progress, requirements, or platform usage in natural language.
*   **Support Escalation Bot:** Interacts with users to troubleshoot issues. If unresolved, it drafts and files a structured "Issue" ticket automatically.
*   **Intelligent Issue Routing:** Analyzes the context of the issue and automatically routes/assigns it to the appropriate individual or group.
*   **Resource Metering:** Tracks and limits LLM/RAG API usage per tenant to prevent abuse and manage API costs.

---

## 7. Subscription, Billing & Provisioning Module (SaaS Billing)
**Role:** Manages subscription tiers, tenant sign-ups, seat licenses, payment gateways, and feature access limits.

*   **Billing Gateway Integration:** Seamless integration with billing processors (e.g., Stripe) to manage monthly/annual subscriptions, invoices, and credit card payments.
*   **Feature Gate & License Engine:** Dynamically restricts access to specific features (e.g., Automated Verification, Enterprise SSO, or RAG limits) and enforces seat limits based on the active subscription plan.
*   **Tenant Admin Dashboard:** Allows Tenant Admins to manage subscription plans, purchase additional seat licenses, view invoices, and configure tenant settings.

---

## 8. Audit Logging & Compliance Module
**Role:** Provides absolute transparency and security compliance for enterprise tenants by recording critical operations.

*   **Action Tracking:** Records critical modifications (e.g., project setting changes, task deletions, evaluation grade updates, security configuration changes).
*   **Audit Viewer:** Exposes search/filter interfaces to Tenant Admins to review activity logs for compliance.

---

## 9. Freelancer Onboarding & Assessment Module
**Role:** Handles public freelancer recruitment, custom pre-requisite testing, grading, and automated project gatekeeping.

*   **Tokenized Onboarding Link Generator:** Generates unique, secure public invite URLs linked to specific projects or tasks.
*   **Assessment Builder:** Allows Project Managers to configure testing materials (MCQs, coding challenges, or text questions) required before project access is unlocked.
*   **Grading & Gatekeeper Engine:** Automatically grades submissions. If a candidate passes the target score, they are automatically provisioned as a user under the tenant with a restricted `Freelancer` role.
*   **Freelancer Sandboxed Portal:** A restricted workspace dashboard where freelancers can take assessments, interact with their assigned tasks, submit verification URLs, and view evaluations.

---

## 10. Developer API & Webhook Module (Integrations)
**Role:** Exposes platform data and functionality securely to external corporate systems (like HR portals, BI tools, and custom dashboards), making the platform fully extendable and integratable.

*   **Developer API Key Portal:** Enables Tenant Admins to generate, scope, and rotate secure API tokens/keys.
*   **Data Integration REST Endpoints:** Exposes robust JSON endpoints to manage tasks/projects and export raw analytics or evaluation data.
*   **Outbound Webhook Delivery Engine:** Fires HTTP notifications to third-party URLs on platform events.
*   **Out-of-the-Box Integrations:** Ready-made connectors (Slack, Microsoft Teams, GitHub, GitLab) to push task updates.

---

## 11. Multi-Channel Push Notification & Sync Module (Mobile Enabled)
**Role:** Keeps mobile app users and web users updated in real-time with push alerts, badges, and offline synchronization capabilities.

*   **Device Token Registry:** Stores and registers active device notification tokens (FCM for Android, APNs for iOS, and Web Push for browsers) associated with user accounts.
*   **Real-time Push Dispatcher:** Triggers instant notifications when a task is assigned, deadline is near, evaluation is published, or support tickets are routed.
*   **Delta-Sync REST Endpoints:** A specialized api endpoint that accepts a client's `last_sync_timestamp` and returns only modified, deleted, or new entities since that timestamp, keeping mobile memory and network consumption lightweight.
