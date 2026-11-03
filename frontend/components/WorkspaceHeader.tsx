"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api";

export function WorkspaceHeader({ githubName }: { githubName: string }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function signOut() {
        setBusy(true);
        setError(null);
        try {
            await logout();
            router.replace("/");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Sign out failed.");
            setBusy(false);
        }
    }

    return (
        <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--page-bg)]/95 backdrop-blur">
            <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-5 px-5 md:px-9">
                <a href="/dashboard" className="shrink-0 font-serif text-[25px] tracking-[-0.06em]">
                    Creatifact<span className="text-[var(--amber)]">.</span>
                </a>
                <nav aria-label="Workspace" className="hidden items-center gap-7 sm:flex">
                    <a href="/dashboard" className="font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--paper-dim)] transition-colors hover:text-[var(--paper)]">Workspace</a>
                    <a href="/dashboard#new-request" className="font-mono text-[10px] uppercase tracking-[0.13em] text-[var(--paper-dim)] transition-colors hover:text-[var(--amber)]">New request <span aria-hidden="true">↘</span></a>
                </nav>
                <div className="flex items-center gap-3 md:gap-5">
                    <span className="hidden max-w-36 truncate font-mono text-[10px] text-[var(--muted)] md:inline">@{githubName}</span>
                    <button type="button" onClick={() => void signOut()} disabled={busy} className="min-h-10 border border-[var(--line)] px-3 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--paper-dim)] transition-colors hover:border-[var(--amber)] hover:text-[var(--paper)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--amber)] disabled:opacity-50">
                        {busy ? "Signing out…" : "Sign out"}
                    </button>
                </div>
            </div>
            {error && <p role="alert" className="mx-auto max-w-7xl px-5 pb-3 text-xs text-red-300 md:px-9">{error}</p>}
        </header>
    );
}
