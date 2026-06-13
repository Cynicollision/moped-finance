# Project Context: Personal Finance Application

This document provides the high-level context and entry point for the Home Lab Finance application. It outlines the project's structure, rules, and available agent skills.

## 1. Project Overview
A web application dedicated to managing personal finances. The architecture follows a strict client/server/shared structure to cleanly separate concerns.

## 2. Technical Architecture
The codebase is divided into three primary packages:
- **`/client`**: The frontend web application (e.g., Angular/React).
- **`/server`**: The backend API services (e.g., Node.js/Express).
- **`/shared`**: Common models, types, schemas, and utilities shared between the client and server.

## 3. Agent Instructions & Rules
All code generation and modifications must adhere to the rules defined in the `.agents` directory. You should review these rules before suggesting architectural changes or writing code:
- [Coding Standards](file:///c:/code/HomeLab/.agents/rules/coding-standards.md)
- [Architecture Rules](file:///c:/code/HomeLab/.agents/rules/architecture.md)

## 4. Documentation
Detailed documentation is maintained in the `_docs` folder:
- **`_docs/`**: General project documentation (currently being rewritten for the standalone finance app).

## 5. Agent Skills & Workflows
Custom skills and automated workflows are located in the `.agents/skills` directory to assist with context, builds, and standard processes.
