# Project Context: Home Lab Platform (Modular Monolith)

This document provides a high-level entry point for the Home Lab project. Detailed documentation is maintained in the `_docs` folder.

## 1. Project Overview
A single, consolidated web platform to manage personal "Home Lab" domains, including Finance and Garden management.
* See [_docs/overview.md](_docs/overview.md) for goals and functional domains.

## 2. Technical Architecture
The platform is built as a Modular Monolith using Angular, Node.js/Express, and PostgreSQL.
* See [_docs/architecture.md](_docs/architecture.md) for stack details and deployment info.

## 3. Database Strategy
A single PostgreSQL instance manages multiple logical databases for each module.
* See [_docs/database.md](_docs/database.md) for schema details and logical database structure.

## 4. Development & Constraints
Guidelines for local development and maintaining the monolithic structure.
* See [_docs/development.md](_docs/development.md) for development rules and environment setup instructions.
