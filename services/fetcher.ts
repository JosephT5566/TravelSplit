import logger from "@/src/utils/logger";

let isRefreshing = false;
let failedQueue: {
    resolve: () => void;
    reject: (reason?: unknown) => void;
}[] = [];

const processQueue = (error?: unknown) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });

    failedQueue = [];
};

const isUnauthorizedResponse = async (response: Response) => {
    if (response.ok) {
        return false;
    }

    if (response.status === 401 || response.status === 403) {
        return true;
    }

    const errorBody = await response
        .clone()
        .json()
        .catch(() => null);

    const errorCode = errorBody?.error?.code;
    return errorCode === "UNAUTHORIZED" || errorCode === "TOKEN_EXPIRED";
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
    } catch (error) {
        logger.error("Could not refresh token:", error);
        throw error;
    }
}

export async function apiFetch(
    url: string,
    options: RequestInit = {},
    hasRetried = false,
): Promise<Response> {
    try {
        const response = await fetch(url, options);

        if (!(await isUnauthorizedResponse(response))) {
            return response;
        }

        if (hasRetried) {
            return response;
        }

        if (isRefreshing) {
            return new Promise<void>((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then(() => apiFetch(url, options, true));
        }

        isRefreshing = true;

        try {
            await refreshToken();
            processQueue();
            return apiFetch(url, options, true); // Retry the request
        } catch (refreshError) {
            processQueue(refreshError);
            if (typeof window !== "undefined") {
                window.location.href = "/";
            }
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    } catch (error) {
        logger.log(
            "apiFetch error:",
            error instanceof Error ? error.message : error,
        );

        throw error;
    }
}
