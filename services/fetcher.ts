import logger from "@/src/utils/logger";

let isRefreshing = false;
let failedQueue: {
    resolve: (value?: any) => void;
    reject: (reason?: any) => void;
}[] = [];

const processQueue = (error: any, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

async function refreshToken() {
    try {
        const proxyUrl = process.env.NEXT_PUBLIC_AUTH_PROXY;
        if (!proxyUrl) {
            throw new Error("Missing NEXT_PUBLIC_AUTH_PROXY env variable.");
        }

        const response = await fetch(`${proxyUrl}/auth/travel-split/refresh`, {
            credentials: "include", // Send cookies
        });

        if (!response.ok) {
            throw new Error("Failed to refresh token.");
        }

        const { id_token } = await response.json();
        return id_token;
    } catch (error) {
        logger.error("Could not refresh token:", error);
        // If refresh fails, we should probably force a logout
        // For now, just re-throw
        throw error;
    }
}

export async function apiFetch(url: string, options: RequestInit = {}) {
    try {
        const response = await fetch(url, options);

        // Check for TOKEN_EXPIRED error in the response body if the call was not ok but was a 401
        if (!response.ok && response.status === 401) {
            const errorBody = await response.json().catch(() => null);
            if (
                errorBody?.error?.code === "TOKEN_INVALID" ||
                errorBody?.error?.code === "TOKEN_EXPIRED"
            ) {
                throw new Error("TOKEN_EXPIRED");
            }
        }

        // Also need to handle cases where our api wrapper throws this
        if (
            response.headers.get("Content-Type")?.includes("application/json")
        ) {
            const clonedResponse = response.clone();
            const body = await clonedResponse.json();
            if (
                body.error &&
                (body.error.code === "TOKEN_EXPIRED" ||
                    body.error.code === "TOKEN_INVALID")
            ) {
                throw new Error("TOKEN_EXPIRED");
            }
        }

        return response;
    } catch (error: any) {
        if (error.message !== "TOKEN_EXPIRED") {
            throw error;
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then(() => apiFetch(url, options));
        }

        isRefreshing = true;

        try {
            await refreshToken();
            processQueue(null);
            return apiFetch(url, options); // Retry the request
        } catch (refreshError) {
            processQueue(refreshError);
            // On refresh failure, redirect to login
            window.location.href = "/";
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
}
