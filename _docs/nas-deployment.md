# Synology NAS Docker Deployment Guide

This guide provides a comprehensive, step-by-step walkthrough for deploying the Home Lab Platform as a Docker container on a Synology NAS. It is written specifically for beginners and works with your **unmodified** repository files.

Our deployment model relies on:
1. **GitHub Actions (CI/CD):** Automatically triggers when you push to `main`, runs your tests, builds a lean production Docker image, and pushes it to **GitHub Container Registry (GHCR)**.
2. **Synology NAS:** Pulls the private image from GHCR and runs it alongside a PostgreSQL database container using Docker Compose.

---

## Part 1: One-Time Setup (First Deployment)

Perform these steps **only once** to configure authentication, set up the NAS directory structure, and initialize your database.

### Step 1: Create a GitHub Personal Access Token (PAT)
Since your repository is private, the GitHub Container Registry (GHCR) requires authentication. A standard GitHub password will not work; instead, you must generate a Personal Access Token (PAT).

1. Log in to GitHub and click your profile picture in the top-right corner.
2. Go to **Settings** -> **Developer Settings** (at the very bottom of the left sidebar).
3. Select **Personal Access Tokens** -> **Tokens (classic)**.
4. Click the **Generate new token** dropdown and select **Generate new token (classic)**.
5. Provide a description (e.g., `Synology NAS Package Pull`).
6. Under **Select scopes**, check the box for:
   * **`read:packages`** (Allows your NAS to pull images from GHCR).
7. Scroll to the bottom and click **Generate token**.
8. **CRITICAL:** Copy the generated token (`ghp_...`) and store it safely in a password manager. **You will never be able to see it again after leaving the page.**

---

### Step 2: Configure GHCR in Synology Container Manager
Synology’s Container Manager (DSM 7.2+) or Docker (DSM 7.1 and below) includes a built-in GUI to register private Docker registries.

1. Open the **Container Manager** (or **Docker**) app on your Synology NAS.
2. Click on the **Registry** tab on the left sidebar.
3. Click **Settings** at the top menu bar.
4. Click **Add** to register GHCR:
   * **Registry Name:** `GitHub Container Registry` (or `GHCR`)
   * **Registry URL:** `https://ghcr.io`
   * **Username:** Your GitHub username (must be in lowercase, e.g. `cynicollision`)
   * **Password:** The **Personal Access Token (PAT)** you copied in Step 1.
5. Click **Apply**.

*Your Synology NAS is now authorized to pull private Docker images from your GitHub account!*

---

### Step 3: Set Up the NAS Directory Structure
We need a persistent folder on your NAS to hold the database files, the environment variables (`.env`), and the container orchestration configuration.

1. Open **File Station** on your NAS.
2. Locate the default `docker` shared folder.
3. Create a new folder inside it named `homelab` (resulting path: `/volume1/docker/homelab`).
4. Inside `homelab`, create a subfolder named `db_data` (resulting path: `/volume1/docker/homelab/db_data`). This folder securely stores all your database records so your data is never lost when containers are updated.
5. Inside `homelab`, create another subfolder named `scripts` (resulting path: `/volume1/docker/homelab/scripts`). We will put the raw SQL schema files here temporarily to initialize the database.

---

### Step 4: Create the Production Environment File (`.env`)
Environment variables configure secrets, passwords, and security settings in production without hardcoding them in your code.

1. Inside the `/volume1/docker/homelab` folder on your NAS, create a new file named `.env`.
   * *Tip:* You can install the **Text Editor** package from the Synology Package Center to create and edit files directly in File Station, or create the file on your computer and upload it.
2. Copy the template below, paste it into the `.env` file, and fill out the values:

```env
# ==============================================================================
# Database Configuration
# ==============================================================================
PGUSER=homelab_db_admin
PGPASSWORD=choose_a_strong_database_password_here
PGDATABASE=homelab_prod
PGPORT=5432

# ==============================================================================
# Application Configuration
# ==============================================================================
PORT=3000
NODE_ENV=production
# Generate a long, random string (e.g. 32+ characters) for session security
SESSION_SECRET=choose_a_long_random_session_secret_here
# Keep as false if accessing over http://<nas-ip>:3000 on your local home network.
# Set to true only if you set up an HTTPS reverse proxy (like Synology Reverse Proxy).
COOKIE_SECURE=false

# ==============================================================================
# Docker Image Path
# ==============================================================================
# Replace with your actual GitHub owner/repository name in LOWERCASE
DOCKER_IMAGE=ghcr.io/cynicollision/homelab:latest
```

3. Save the `.env` file.

---

### Step 5: Upload Configuration and Schema Files to the NAS
Using **File Station**, upload the following files from your local repository to the NAS:

1. Upload `docker-compose.prod.yml` to `/volume1/docker/homelab/`.
   * **Rename it** on the NAS to `docker-compose.yml` (this simplifies commands).
2. Upload the raw SQL database schemas from `server/scripts/` to `/volume1/docker/homelab/scripts/`. You will need:
   * `schema_core.sql`
   * `schema_finance.sql`
   * `schema_grounds.sql`

---

### Step 6: Connect to your NAS via SSH
We will use quick commands to start the containers and initialize the database.

1. Enable SSH on your NAS:
   * Go to **Control Panel** -> **Terminal & SNMP**.
   * Check **Enable SSH service** and click **Apply**.
2. Open a terminal on your computer:
   * **Windows:** Open *PowerShell* or *Command Prompt*.
   * **macOS/Linux:** Open *Terminal*.
3. Type the following command (replace with your Synology administrator username and your NAS's local network IP):
   ```bash
   ssh your_nas_admin@your_nas_ip
   ```
4. Enter your administrator password when prompted. You are now connected!

---

### Step 7: Pull the Images and Start the Containers
Navigate to your project directory and start the services.

1. Navigate to the homelab directory:
   ```bash
   cd /volume1/docker/homelab
   ```
2. Pull the database and application images:
   ```bash
   docker-compose pull
   ```
3. Start the containers in the background:
   ```bash
   docker-compose up -d
   ```
   *Docker will download the official PostgreSQL image, fetch your private image from GHCR, and spin them up.*

---

### Step 8: Initialize the Database Schemas
Since this is a fresh database, it starts empty. We will stream the raw SQL schema files from your NAS host folder directly into the database container's `psql` utility. 

Run these three commands in your SSH session:

```bash
# 1. Initialize the Core Schema
docker exec -i home_lab_db psql -U homelab_db_admin -d homelab_prod < scripts/schema_core.sql

# 2. Initialize the Finance Schema
docker exec -i home_lab_db psql -U homelab_db_admin -d homelab_prod < scripts/schema_finance.sql

# 3. Initialize the Grounds Schema
docker exec -i home_lab_db psql -U homelab_db_admin -d homelab_prod < scripts/schema_grounds.sql
```
*(If you changed `PGUSER` or `PGDATABASE` in your `.env` file, replace `homelab_db_admin` and `homelab_prod` in the commands above with your custom values).*

---

### Step 9: Bootstrap the Admin User
Since running typescript seeding scripts in production requires development tools that are omitted from your lean production container, we bootstrap your initial admin account directly in the database.

1. Run the following command in your SSH session to insert an admin user:
   ```bash
   docker exec -i home_lab_db psql -U homelab_db_admin -d homelab_prod -c "INSERT INTO core.users (id, display_name, username, password_hash) VALUES ('usr_bootstrapadmin', 'Administrator', 'admin', '\$2b\$10\$vI8aWBnd3G5C5k.fE7/LDO5eK/Uu0F4f/K22KskU0X1K7rA7Uo7mO') ON CONFLICT (id) DO NOTHING;"
   ```
   *(Note: The backslashes `\$` escape the dollar signs in the password hash so that your SSH shell does not parse them as variables).*

2. **Verify and Clean Up:**
   * Open your browser and navigate to `http://<your-nas-ip>:3000`.
   * Log in using:
     * **Username:** `admin`
     * **Password:** `admin123`
   * **IMPORTANT SECURITY STEP:** Once logged in, immediately click your profile/settings and **change your password** to a secure one.
   * **Clean Up:** You can now safely delete the `/volume1/docker/homelab/scripts/` folder via File Station since the schemas have been successfully applied.

---

## Part 2: Repeating Steps (Each Time Your App Changes)

Once the first-time setup is finished, deploying updates when you make code changes is completely automated and takes less than 30 seconds.

### Step 1: Commit and Push your Changes
Whenever you write new code or make changes locally:

1. Stage, commit, and push your changes to your GitHub repository's main branch:
   ```bash
   git add .
   git commit -m "Describe your code changes"
   git push origin main
   ```
2. Your **GitHub Actions CI/CD Pipeline** (`ci.yml`) will automatically trigger, build the new production image, and push it to GHCR with the `latest` tag.

---

### Step 2: Pull the Update on the NAS
Once the GitHub Action completes successfully, apply the update to your NAS:

1. Open your terminal and connect to your NAS via SSH:
   ```bash
   ssh your_nas_admin@your_nas_ip
   ```
2. Navigate to the project folder:
   ```bash
   cd /volume1/docker/homelab
   ```
3. Pull the updated Docker image from GHCR:
   ```bash
   docker-compose pull
   ```
4. Tell Docker Compose to re-create the running containers:
   ```bash
   docker-compose up -d
   ```
   *Docker Compose will detect that only the application image has changed, swap the running container in less than 5 seconds, and leave your PostgreSQL database running completely untouched. Your data is 100% safe and intact!*

---

## Troubleshooting & FAQ

#### Q: How do I view my application logs on the NAS?
Navigate to your `/volume1/docker/homelab` directory in SSH and run:
```bash
docker-compose logs -f api
```
*(Press `Ctrl+C` to exit the log viewer).*

#### Q: Do I need to run the schema initialization or user bootstrap every time?
No! You only run these commands during the **very first setup**. In subsequent updates, your database structure is preserved, and your data remains safely stored in the `db_data` directory.

#### Q: Can I run this without keeping SSH enabled?
Yes! Once the initial database is set up, you can disable the SSH service in DSM if you prefer. When updating the app, you can go to Container Manager, select your `homelab` project, and click **Action** -> **Clean** or **Rebuild**.
