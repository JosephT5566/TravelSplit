import "./globals.css";
import Script from "next/script";
import { AuthProvider } from "../src/stores/AuthStore";
import { ConfigProvider } from "../src/stores/ConfigStore";
import { ExpensesProvider } from "../src/stores/ExpensesStore";
import { UIProvider } from "../src/stores/UIStore";
import { AppShell } from "../components/AppShell";
import { ClientProviders } from "./ClientProviders";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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
        <html lang="en" className={cn("font-sans", geist.variable)}>
            <head>
            </head>
            <body className="bg-background text-text-main transition-colors duration-200">
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
