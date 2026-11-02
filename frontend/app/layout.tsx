import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Creatifact",
    description: "Turn engineering history into grounded artifacts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
