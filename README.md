# What is this app?

We used to utilize Google Sheets for travel accounting, including expense splitting. In the past, I used Google Forms as the entry point. Now, this project implements a modern Frontend App to make the experience prettier and more user-friendly.

# How do we start the app?

## Google Sheet Setup

1. Create a new Google Sheet.
2. Create and link a Google App Scripts (GAS) project to serve as the backend.
3. **Config Tab**: The 1st tab in the sheet is used for configuration. It requires the following rows (headers in column A, values in column B/C...):
    1. `users`: Comma-separated list of user identifiers/names.
    2. `categories`: Comma-separated list of expense categories.
    3. `currencies`: Supported currencies.
    4. `startDate`: Trip start date (YYYY-MM-DD).
    5. `endDate`: Trip end date (YYYY-MM-DD).
4. **User Tabs**: Create tabs starting from the 2nd position that match the `users` defined in the config.
5. **Columns**: Set the columns for each user tab as follows:
    1. `timestamp`
    2. `date`
    3. `weekday`
    4. `category`
    5. `itemName`
    6. `amount`
    7. `currency`
    8. `exchangeRate`
    9. `payer`
    10. `<user1>` (Split amount for user 1)
    11. `<user2>` (Split amount for user 2)
    12. ... (Add columns for all users)

## Repository Configuration

### GitHub (Variables)
To deploy this frontend to GitHub Pages, you need to configure the following environment variables in your repository settings (Settings > Secrets and variables > Actions > Variables):

1. **`NEXT_PUBLIC_AUTH_PROXY`**: The URL of your deployed authentication proxy service (e.g., `https://auth.yourdomain.com`).
   - This URL is used by the frontend to redirect users for login/logout and to proxy API requests.

### Cloudflare (Worker/KV)
The Auth Proxy (running on Cloudflare Workers) requires its own configuration, typically stored in **Cloudflare KV** or **Worker Variables**:
(Please check the Cloudflare Workers KV page)

1. **`key: config:<app-id>`**: A JSON configuration object containing:
    - `allowed_origins`: A list of domains allowed to use the proxy (e.g., `["https://tripsplit.yourdomain.com", "http://localhost:3000"]`).
    - `gas_url`: The Web App URL of your deployed Google Apps Script (backend).
    - `allowed_emails`: A whitelist of email addresses allowed to sign in and access the app.

# App Structure

## Auth

Authentication is handled via a centralized **Auth Proxy**. This application does not manage OAuth tokens directly (Client-Side). instead, it relies on secure HttpOnly cookies set by the proxy.

- **Flow**:
    1.  User clicks "Sign in".
    2.  App redirects to the Proxy's login endpoint.
    3.  Proxy handles Google OAuth2 consent.
    4.  Proxy sets a session cookie (`session_id`) and a flag cookie (`is_logged_in`).
    5.  Proxy redirects back to this app.
    6.  The app detects the `is_logged_in` cookie and fetches user profile via the proxy.

## Auth Routes
The application interacts with the **Auth Proxy** through the following standard routes:

-   `GET /auth/travel-split/login?redirect_to=...`: Initiates the Google OAuth2 login flow.
-   `GET /auth/travel-split/logout?redirect_to=...`: Clears session cookies and logs the user out.
-   `GET /auth/travel-split/me`: Returns the current authenticated user's profile (email, name, picture).
-   `POST /auth/travel-split/api`: Proxies requests to the Google Apps Script backend, attaching the necessary credentials server-side.

## Tech Note

### Stack
-   **Framework**: [Next.js](https://nextjs.org/) (App Router)
-   **Language**: TypeScript
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/)
-   **State Management**: React Context + [TanStack Query](https://tanstack.com/query/latest) (for server state & caching)
-   **Persistence**: `idb-keyval` (IndexedDB wrapper) for offline-first capabilities and persisting query cache.

### Deployment
-   **Frontend**: Deployed to **GitHub Pages** as a static export.
-   **Domain & CDN**: Custom domain managed via **Cloudflare CDN** for edge caching and optimized delivery.
-   **Backend**: Google Apps Script (GAS) acting as a database and business logic layer for Google Sheets.
-   **Auth & Proxy**: A separate Cloudflare Worker (or similar edge function) that handles OAuth2, session management via HttpOnly cookies, and CORS policies. This architecture keeps sensitive tokens out of the browser.

# Run Locally

**Prerequisites:** Node.js (v18 or v20 recommended)

1. **Install dependencies:**

    ```bash
    npm install
    ```

2. **Configure Environment:**
   Create a `.env.local` file in the root directory:

    ```env
    NEXT_PUBLIC_AUTH_PROXY=https://your-auth-proxy-url.com
    ```
    Or we can run a proxy locally, please check https://github.com/JosephT5566/my-oauth

3. **Run the app:**
    ```bash
    npm run dev
    ```
