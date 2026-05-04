# What is this app?

We used to utilize Google Sheets for travel accounting, including expense splitting. In the past, I used Google Forms as the entry point. Now, this project implements a modern Frontend App to make the experience prettier and more user-friendly.

# How do we start the app?

## Google Sheet Setup

1. Create a new Google Sheet.
2. **Share with Service Account**: Share the sheet with the Google Cloud Function's service account email with "Editor" permissions.
3. **Config Tab**: The 1st tab in the sheet is used for configuration. It requires the following rows (headers in column A, values in column B/C...):
    1. `users`: Comma-separated list of user identifiers/names.
    2. `categories`: Comma-separated list of expense categories.
    3. `currencies`: Supported currencies.
    4. `startDate`: Trip start date (YYYY-MM-DD).
    5. `endDate`: Trip end date (YYYY-MM-DD).
    6. `allowedUsers`: Comma-separated list of Google account emails allowed to access the application.
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

1. **`NEXT_PUBLIC_AUTH_PROXY`**: The URL of your deployed authentication worker (e.g., `https://auth.yourdomain.com`). This service handles the OAuth token exchange.
2. **`NEXT_PUBLIC_TRAVEL_SPLIT_GCF`**: The URL of your Google Cloud Function (e.g., `travel-split-gcf.yourdomain.com`).
3. **`NEXT_PUBLIC_SHEET_ID`**: The ID of the Google Sheet used as the database.

# App Structure

## Auth

Authentication is handled by a **Cloudflare Worker** acting as a "Token Issuer" and a **Google Cloud Function** acting as the "Resource Server." This architecture avoids exposing sensitive credentials to the frontend.

- **Flow**:
    1.  User clicks "Sign in".
    2.  The app initiates the Google OAuth2 flow.
    3.  After user consent, Google redirects back to the frontend with an authorization `code`.
    4.  The frontend sends this `code` to the Cloudflare Worker's `/auth/exchange` endpoint.
    5.  The Worker securely exchanges the `code` for an `id_token` using its `CLIENT_SECRET`.
    6.  The Worker returns the `id_token` to the frontend and sets it in a secure, `HttpOnly` cookie.
    7.  For all subsequent API calls, the frontend sends the `id_token` (as a Bearer token or via the cookie) directly to the GCF.
    8.  The GCF verifies the `id_token` and authorizes the user.

### Authentication Cookies

To maintain a secure session, the authentication proxy (Cloudflare Worker) sets the user's `id_token` in a browser cookie with strict security attributes:

-   **`HttpOnly`**: This is a critical security measure that prevents the cookie from being accessed by client-side JavaScript. By making the token inaccessible to the browser's document object, it provides strong protection against Cross-Site Scripting (XSS) attacks.

-   **`Secure`**: This attribute ensures that the cookie is only transmitted over an encrypted HTTPS connection. During local development, this requires running the development server with HTTPS enabled (`--experimental-https`), as configured in the `dev` script.

-   **`SameSite=Strict`**: This attribute provides a strong defense against Cross-Site Request Forgery (CSRF) attacks. It ensures that the cookie is only sent with requests originating from the same site that set it.

-   **`Domain`**: For the cookie to be correctly shared between the frontend application and the authentication proxy during development, they must share a common parent domain. For example, if the app runs on `travel-split-dev.josephtseng-tw.com` and the proxy on `auth.josephtseng-tw.com`, the cookie's `Domain` attribute would be set to `.josephtseng-tw.com`. This is crucial for seamless authentication across the different local services.

## Auth Routes
The application interacts with two main services:

### Cloudflare Worker (Token Issuer)
-   `GET /auth/travel-split/login?redirect_to=...`: Initiates the Google OAuth2 login flow.
-   `POST /auth/travel-split/exchange`: Exchanges an OAuth `code` for an `id_token`.
-   `GET /auth/travel-split/logout?redirect_to=...`: Clears session cookies and logs the user out.

### Google Cloud Function (Resource Server)
-   `GET /setting`: Fetches the sheet configuration.
-   `GET /data`: Fetches expenses for the user.
-   `POST /add`: Adds a new expense.
-   `DELETE /delete`: Deletes an expense.

## Tech Note

### Stack
-   **Framework**: [Next.js](https://nextjs.org/) (App Router)
-   **Language**: TypeScript
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [DaisyUI](https://daisyui.com/)
-   **State Management**: React Context + [TanStack Query](https://tanstack.com/query/latest) (for server state & caching)
-   **Persistence**: `idb-keyval` (IndexedDB wrapper) for offline-first capabilities and persisting query cache.

### Deployment
-   **Frontend**: Deployed to **GitHub Pages** as a static export.
-   **Domain & CDN**: Custom domain managed via **Cloudflare CDN**.
-   **Backend**: **Google Cloud Function (GCF)** providing a REST API over the Google Sheet.
-   **Auth**: A **Cloudflare Worker** that handles the OAuth2 token exchange, keeping the client secret and other sensitive tokens out of the browser.

# Run Locally

**Prerequisites:** Node.js (v18 or v20 recommended)

1. **Install dependencies:**

    ```bash
    npm install
    ```

2. **Configure Environment:**
   Create a `.env.local` file in the root directory:

    ```env
    NEXT_PUBLIC_AUTH_PROXY=https://your-auth-worker-url.com
    NEXT_PUBLIC_TRAVEL_SPLIT_GCF=https://your-gcf-url.cloudfunctions.net
    NEXT_PUBLIC_SHEET_ID=your_google_sheet_id
    ```
    For local development, you will typically point `NEXT_PUBLIC_AUTH_PROXY` and `NEXT_PUBLIC_TRAVEL_SPLIT_GCF` to their respective local URLs.

3. **Run the app:**
    ```bash
    npm run dev
    ```

### Local Development Setup

To run the entire TravelSplit stack locally for development, you will need to set up and run three main components:

1.  **Frontend App (This Repository)**:
    *   First, install dependencies: `npm install`
    *   Then, run the development server: `npm run dev`
    *   The frontend app will run on `https://travel-split-dev.josephtseng-tw.com:3000` as configured in `package.json`.

2.  **Authentication Proxy (Cloudflare Worker)**:
    *   This component handles the OAuth token exchange. You will need to clone and set up its repository.
    *   Refer to the [my-oauth repository](https://github.com/JosephT5566/my-oauth) for detailed instructions on how to set up and run the Cloudflare Worker locally (e.g., using `wrangler dev`).
    *   Once running locally, update your `.env.local` file in this project to point `NEXT_PUBLIC_AUTH_PROXY` to its local development URL (e.g., `http://localhost:8787`).

3.  **Travel Split GCF (Google Cloud Function)**:
    *   This is your backend API interacting with Google Sheets. You will need its source code to run it locally.
    *   Instructions for setting up and running the Google Cloud Function locally are typically found in its dedicated repository. You might use tools like `functions-framework` to serve it.
    *   Once running locally, update your `.env.local` file in this project to point `NEXT_PUBLIC_TRAVEL_SPLIT_GCF` to its local development URL (e.g., `http://localhost:8080`).

Ensure all three components are running and correctly configured in your `.env.local` for a complete local development experience.
