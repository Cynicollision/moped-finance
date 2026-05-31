# Testing Strategy

This project uses **Jest** for server-side unit testing and **Supertest** for testing API routes.

## Testing Philosophy
* **Route-Level Integration**: We primarily test the system at the route level. This verifies the routing logic, authentication handling, parameter parsing, and controller logic in one go.
* **Mocked Data Layer**: To ensure tests are fast and deterministic, we mock the database/data providers. Tests should not require a running PostgreSQL instance.
* **Dependency Injection**: Routes and Controllers are designed to accept their dependencies (data providers, loggers, etc.), making it easy to swap them with mocks during testing.

## Running Tests

### Local Environment
If you have Node.js installed locally and have run `npm install` in the `server` directory:
```bash
cd server
npm test
```

### Docker Environment (Recommended)
To run tests inside the running server container:
```bash
docker-compose exec api npm test
```

### Continuous Testing (Watch Mode)
To keep tests running and re-executing on file changes:
```bash
# Local
npm run test:watch

# Docker
docker-compose exec api npm run test:watch
```

## Creating New Tests
* **Location**: Place `.spec.ts` files alongside the code they test (e.g., `server/src/routes/finance-routes.spec.ts`).
* **Pattern**: 
    1. Create mocks for the required `Data` interfaces.
    2. Use `createFeatureRouter(mockData, mockLogger)` to instantiate a testable router.
    3. Use `supertest` to make requests against an in-memory Express app.
