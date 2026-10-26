# Deploying online (Railway)

The app needs two things online: something to run the Node.js server, and a MySQL 8 database. [Railway](https://railway.com) hosts both in one project. Its MySQL is a real MySQL 8 server, so the triggers, stored procedures and views all work.

> Don't use TiDB Serverless or PlanetScale. They are MySQL-*compatible* but don't support triggers and stored procedures, which this project depends on.

Railway gives new accounts a free trial credit. After that a paid plan is needed. Check their current pricing page. For a college demo, the trial is usually enough.

## Steps

### 1. Create the project from GitHub
1. Sign in at https://railway.com using **Login with GitHub**.
2. Click **New Project → Deploy from GitHub repo** and choose **DBMS-Project**. If it isn't listed, use **Configure GitHub App** to give Railway access to the repository.
3. The first build may fail or show errors because there is no database yet. That's fine.

### 2. Pick the branch
Open the new service, go to **Settings → Source**, and set the branch to **`deployment`** (or `main`, once this branch is merged).

### 3. Add MySQL
In the project canvas, click **+ Create → Database → MySQL**. Wait until it shows as running.

### 4. Connect the app to MySQL
Open the **app service → Variables** and add:

| Variable | Value |
|---|---|
| `MYSQL_URL` | `${{MySQL.MYSQL_URL}}` (type it exactly; Railway fills in the real value) |
| `AUTH_SECRET` | any long random string, e.g. `k3J9x...` (keeps users logged in across restarts) |
| `SHOW_DEMO_ACCOUNTS` | `true` (shows the demo logins on the sign-in page; set `false` to hide them) |

If your MySQL service has a different name than `MySQL`, use that name in `${{...}}`.

Saving the variables triggers a new deploy.

### 5. Get a public URL
In the **app service → Settings → Networking**, click **Generate Domain**. You'll get an address like `https://dbms-project-production.up.railway.app`.

### 6. Check it worked
Open **Deployments → View logs** for the app. On the first start you should see:

```
Database 'inventory_db' is empty, creating schema and sample data...
Ran schema.sql (38 statements)
Ran seed.sql (11 statements)
Inventory system running on port 8080
```

Open the domain. You'll see the login page with the demo accounts.

## How it works

- **Connection:** the app reads `MYSQL_URL` (or `DATABASE_URL`). Locally it still uses `DB_HOST` / `DB_USER` / `DB_PASSWORD` from `.env`.
- **First start:** if the `inventory_db` database is missing or empty, the server runs `db/schema.sql` and `db/seed.sql` itself. If it already has tables, it is **never** touched, so your data survives restarts and redeploys. Set `AUTO_INIT_DB=false` to turn this off.
- **Waiting for MySQL:** on a fresh deploy MySQL may still be starting, so the server retries the connection for about a minute before giving up.
- **Health check:** `railway.json` tells Railway to check `/api/health` and restart the app if it crashes.

## Common tasks

**Reset the online database to the sample data.** Run the init script from your laptop against Railway's *public* URL:
1. In the **MySQL service → Variables**, copy `MYSQL_PUBLIC_URL`.
2. On your laptop, in the project folder (Windows Command Prompt):
   ```
   set MYSQL_URL=<paste MYSQL_PUBLIC_URL here>
   npm run db:init
   ```
   This **deletes all online data** and reloads the samples. Close that Command Prompt window afterwards, so your local `npm start` goes back to using your own MySQL.

**Change the demo passwords.** Log in as Admin, open **Users**, then **Edit** each account and set a new password. Also set `SHOW_DEMO_ACCOUNTS=false`.

**Using another MySQL host** (e.g. Aiven): set `MYSQL_URL` to its connection URL and `DB_SSL=true`. If the provider gives you a CA certificate, add it to the project and set `DB_SSL_CA` to its file path. The MySQL account needs permission to create a database, tables, triggers and procedures.
