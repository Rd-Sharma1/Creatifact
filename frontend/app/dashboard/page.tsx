"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, apiUrl, AuthenticationRequiredError, getCurrentUser, getRepositories, logout, type AuthorizedRepository, type CurrentUser } from "@/lib/api";

type DashboardState = "loading" | "ready" | "error";

export default function DashboardPage() {
    const router = useRouter();
    const [status, setStatus] = useState<DashboardState>("loading");
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [repositories, setRepositories] = useState<AuthorizedRepository[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);

    const load = useCallback(async () => {
        setStatus("loading");
        setError(null);
        try {
            const [current, repositoryResult] = await Promise.all([getCurrentUser(), getRepositories()]);
            setUser(current);
            setRepositories(repositoryResult.repositories);
            setStatus("ready");
        } catch (reason) {
            if (reason instanceof AuthenticationRequiredError || (reason instanceof ApiClientError && reason.status === 401)) {
                router.replace("/");
                return;
            }
            setError(reason instanceof Error ? reason.message : "The dashboard could not be loaded.");
            setStatus("error");
        }
    }, [router]);

    useEffect(() => { void load(); }, [load]);

    async function handleLogout() {
        setLoggingOut(true);
        try {
            await logout();
            router.replace("/");
        } catch (reason) {
            if (reason instanceof AuthenticationRequiredError) router.replace("/");
            else setError(reason instanceof Error ? reason.message : "Sign out failed.");
            setLoggingOut(false);
        }
    }

    return (
        <main className="min-h-screen px-5 py-6 md:px-10 md:py-8">
            <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-[var(--line)] pb-5">
                <a href="/dashboard" className="font-serif text-2xl tracking-tight">Creatifact<span className="text-[var(--amber)]">.</span></a>
                <button onClick={handleLogout} disabled={loggingOut} className="font-mono text-xs uppercase tracking-widest text-[var(--muted)] hover:text-[var(--paper)] disabled:opacity-50">
                    {loggingOut ? "Signing out…" : "Sign out"}
                </button>
            </header>

            <section className="mx-auto max-w-6xl py-16 md:py-24">
                <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-[var(--amber)]">Workspace / Overview</p>
                <div className="flex flex-wrap items-end justify-between gap-6">
                    <div>
                        <h1 className="font-serif text-5xl leading-none tracking-tight md:text-7xl">Your work, <span className="italic text-[var(--muted)]">in context.</span></h1>
                        {user && <p className="mt-5 text-sm text-[var(--muted)]">Signed in as <span className="text-[var(--paper)]">@{user.githubName}</span></p>}
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">V1 · GitHub activity</span>
                </div>

                <div className="mt-14 border-y border-[var(--line)]">
                    <div className="flex items-center justify-between border-b border-[var(--line)] py-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                        <span>Authorized repositories</span>
                        <span>{status === "ready" ? String(repositories.length).padStart(2, "0") : "—"}</span>
                    </div>
                    {status === "loading" && <p className="py-10 text-sm text-[var(--muted)]">Loading your workspace…</p>}
                    {status === "error" && (
                        <div className="py-10" role="alert">
                            <p className="mb-4 text-sm text-red-300">{error}</p>
                            <button onClick={() => void load()} className="font-mono text-xs uppercase tracking-widest text-[var(--amber)]">Try again</button>
                        </div>
                    )}
                    {status === "ready" && repositories.length > 0 && (
                        <ul className="divide-y divide-[var(--line)]">
                            {repositories.map(repository => (
                                <li key={repository.id} className="flex items-center justify-between py-5">
                                    <span className="text-base">{repository.owner}<span className="text-[var(--muted)]"> / </span>{repository.name}</span>
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Connected</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {status === "ready" && repositories.length === 0 && (
                        <div className="max-w-xl py-10">
                            <h2 className="font-serif text-3xl">Connect a repository.</h2>
                            <p className="my-4 text-sm leading-6 text-[var(--muted)]">Install the Creatifact GitHub App on an account or organization to make its repositories available here.</p>
                            <form action={apiUrl("/api/auth/github/install")} method="post">
                                <button type="submit" className="min-h-11 border border-[var(--line)] px-4 text-sm hover:border-[var(--amber)] hover:text-[var(--amber)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--paper)]">
                                    Install GitHub App <span aria-hidden="true">↗</span>
                                </button>
                            </form>
                        </div>
                    )}
                </div>
                <p className="mt-6 max-w-xl font-mono text-[10px] leading-5 text-[var(--muted)]">Artifact requests and candidate review will appear here in the next frontend milestone.</p>
            </section>
        </main>
    );
}
