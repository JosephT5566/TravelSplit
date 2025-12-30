import "./globals.css";
import Script from "next/script";
import { AppProvider } from "../components/AppContext";

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
                <AppProvider>{children}</AppProvider>
            </body>
        </html>
    );
}
