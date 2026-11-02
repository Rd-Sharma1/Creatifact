import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Creatifact — Make your work easier to share",
    description: "Turn GitHub activity into evidence-backed drafts you can review, edit, and approve.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
