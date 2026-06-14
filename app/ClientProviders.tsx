"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { StartupLoading } from "../components/StartupLoading";
import { queryClient } from "@/services/queryClient";
import { isPublicTravelBookPath } from "@/src/travel/registry";

const Providers = dynamic(
    () => import("../components/Providers").then((mod) => mod.ReactQueryProvider),
    {
        ssr: false,
        loading: () => (
            <StartupLoading
                value="saved app data"
                detail="Restoring cached trip settings and expenses from this device."
            />
        ),
    }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    if (isPublicTravelBookPath(pathname)) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    }

    return <Providers>{children}</Providers>;
}
