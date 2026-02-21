# API Catalog

This document provides a high-level overview of the API endpoints, their primary consumers, and the core data entities they interact with.

| Route                      | Consumers              | Entities                               |
| :------------------------- | :--------------------- | :------------------------------------- |
| `/api/healthcheck`         | Monitoring             | N/A                                    |
| `/api/auth/login`          | Frontend (Core)        | `User`                                 |
| `/api/finance/composite/financialprofile`      | Frontend (Finance App) | `Asset`, `Liability`, `FinancialInstitution`                               |
| `/api/finance/data/asset`      | Frontend (Finance App) | `Asset`                                |
| `/api/finance/data/transaction` | Frontend (Finance App) | `Transaction`                                 |
| `/api/garden/composite/snapshot`    | Frontend (Garden App)  | `Planting`, `PlantVariety`, `Location`, `CareRule` |
| `/api/garden/data/task`    | Frontend (Garden App)  | `TaskLog`    |
| `/api/garden/data/planting`    | Frontend (Garden App)  | `Planting`    |