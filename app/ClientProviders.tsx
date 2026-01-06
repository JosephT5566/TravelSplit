"use client";

import dynamic from "next/dynamic";

const Providers = dynamic(
    () => import("../components/Providers").then((mod) => mod.ReactQueryProvider),
    { ssr: false }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
    return <Providers>{children}</Providers>;
}
