import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "../src/stores/AuthStore";
import { ConfigProvider } from "../src/stores/ConfigStore";
import { ExpensesProvider } from "../src/stores/ExpensesStore";
import { UIProvider } from "../src/stores/UIStore";
import { AppShell } from "../components/AppShell";
import { ClientProviders } from "./ClientProviders";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { PWARegister } from "@/components/PWARegister";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
    title: "TripSplit",
    description: "Split expenses for your trips",
    applicationName: "TripSplit",
    manifest: `${basePath}/manifest.webmanifest`,
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "TripSplit",
    },
    icons: {
        icon: [
            {
                url: `${basePath}/icons/icon-192.png`,
                sizes: "192x192",
                type: "image/png",
            },
            {
                url: `${basePath}/icons/icon-512.png`,
                sizes: "512x512",
                type: "image/png",
            },
        ],
        apple: [
            {
                url: `${basePath}/icons/apple-touch-icon.png`,
                sizes: "180x180",
                type: "image/png",
            },
        ],
    },
};

export const viewport: Viewport = {
    themeColor: "#4b9da9",
    colorScheme: "light",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={cn("font-sans", geist.variable)}>
            <head>
            </head>
            <body className="bg-background text-text-main transition-colors duration-200">
                <PWARegister />
                <ClientProviders>
                    <AuthProvider>
                        <ConfigProvider>
                            <ExpensesProvider>
                                <UIProvider>
                                    <AppShell>{children}</AppShell>
                                </UIProvider>
                            </ExpensesProvider>
                        </ConfigProvider>
                    </AuthProvider>
                </ClientProviders>
            </body>
        </html>
    );
}
