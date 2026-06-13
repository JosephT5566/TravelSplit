"use client";

import dynamic from "next/dynamic";
import { StartupLoading } from "../components/StartupLoading";

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
    return <Providers>{children}</Providers>;
}
