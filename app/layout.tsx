import Script from "next/script";
import { AuthProvider } from "../src/stores/AuthStore";
import { ConfigProvider } from "../src/stores/ConfigStore";
import { ExpensesProvider } from "../src/stores/ExpensesStore";
import { UIProvider } from "../src/stores/UIStore";
import { AppShell } from "../components/AppShell";

import "./globals.css";

export const metadata = {
    title: "TripSplit",
    description: "Split expenses for your trips",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <Script
                    src="https://accounts.google.com/gsi/client"
                    async
                    defer
                ></Script>
            </head>
            <body className="bg-background text-text-main transition-colors duration-200">
                <AuthProvider>
                    <ConfigProvider>
                        <ExpensesProvider>
                            <UIProvider>
                                <AppShell>{children}</AppShell>
                            </UIProvider>
                        </ExpensesProvider>
                    </ConfigProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
