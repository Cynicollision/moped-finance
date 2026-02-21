# Development Rules

1.  **Monolith Structure:** All code lives in one repo. Common UI components go in `client/src/app/common`.
    *   **Shared Code:** Isomorphic TypeScript code (types, interfaces, etc.) used by both client and server lives in the `shared/` directory.
2.  **API Consistency:** All API responses must handle errors gracefully (JSON).
3.  **Environment:** 
    * Development occurs on Windows (WSL2).
    * Production deployment is via Docker on a Synology NAS.
4.  **Backend:** The backend is a Node.js/Express application written in TypeScript, located in the `server/` directory.
5.  **Database Connection:** The Node.js backend manages a single connection pool to the database. Logical separation is achieved using PostgreSQL schemas.

## Docker Usage (Development)

To manage the development environment, use the following commands from the root directory:

*   **Start Environment:** `docker-compose up -d`
*   **Restart & Rebuild:** `docker-compose up -d --build --remove-orphans`
    *   *Use this after modifying Dockerfiles, environment variables, or when switching architectures.*
*   **Stop Environment:** `docker-compose down`
*   **View Logs:** `docker-compose logs -f`

### Troubleshooting
*   **Port 5432 already allocated:** This usually happens if an old container wasn't stopped correctly. Run `docker-compose down --remove-orphans` or manually stop the conflicting container with `docker stop <container_name>`.

## Angular Development (Frontend)

The frontend is an Angular application located in the `client/` directory.

### Shared Code
The client is configured to recognize path aliases for shared code. You can import from the shared directory like this:
`import { MyType } from '@shared/types/my-type';`

This is configured via `paths` in `client/tsconfig.json`.

### Running the Development Server
For hot-reloading and debugging, run the Angular dev server locally:
```powershell
cd client
npm install
ng serve
```
Access the app at `http://localhost:4200`.

### API Proxying
During development, the Angular dev server (port 4200) is configured via `client/proxy.conf.json` to proxy all `/api/*` requests to the Express backend (port 3000). This allows you to use relative URLs in your services (e.g., `/api/healthcheck`) without CORS issues.

### Building for Production
To build the application for the Express server to serve:
```powershell
cd client
ng build
```
The output is generated in `client/dist/home-lab-client`.

**Note:** The root `Dockerfile` handles this automatically during a Docker build by copying the build artifacts into the server's `public/` directory. If you are running the Express server locally (outside of Docker) and want it to serve the Angular app, you must manually copy the contents of `client/dist/home-lab-client` to `server/public`.

## Node.js Development (Backend)

The backend is a TypeScript Express application located in the `server/` directory. The main source file (`index.ts`) is in the root of this directory.

### Installing Dependencies
To install the necessary packages, run the following from the `server` directory:
```powershell
cd server
npm install
```

### Running the Development Server
The recommended way to run the backend during development is via `docker-compose up`. This will start the Node.js server with hot-reloading and an attached debugger on port 9229.

As an alternative, you can run the server locally without Docker. **Note:** You cannot run both the Docker container and the local server at the same time, as they will conflict over the same ports (3000 and 9229).

To run locally:
```powershell
cd server
npm run dev
```
