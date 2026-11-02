"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, apiUrl, getCurrentUser } from "@/lib/api";

export default function SignInPage() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        getCurrentUser().then(() => {
            if (active) router.replace("/dashboard");
        }).catch((reason: unknown) => {
            if (!active) return;
            if (reason instanceof ApiClientError && reason.status === 401) setError(null);
            else setError(reason instanceof Error ? reason.message : "Could not check your session.");
        }).finally(() => {
            if (active) setChecking(false);
        });
        return () => { active = false; };
    }, [router]);

    return (
        <main className="flex min-h-screen items-center justify-center px-6 py-16">
            <section className="w-full max-w-lg border-t-2 border-[var(--amber)] pt-6">
                <p className="mb-16 font-mono text-xs uppercase tracking-[0.22em] text-[var(--muted)]">Creatifact <span className="text-[var(--amber)]">/</span> GitHub workspace</p>
                <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--amber)]">Sign in</p>
                <h1 className="font-serif text-5xl tracking-tight md:text-6xl">Your work, remembered.</h1>
                <p className="mt-5 max-w-md text-sm leading-6 text-[var(--muted)]">
                    Continue with GitHub to access your engineering history and workspace.
                </p>
                <div className="mt-10 min-h-12">
                    {checking ? (
                        <p className="font-mono text-xs uppercase tracking-widest text-[var(--muted)]">Checking session…</p>
                    ) : (
                        <a
                            className="inline-flex min-h-12 items-center gap-3 bg-[var(--amber)] px-5 text-sm font-semibold text-[var(--charcoal)] transition-colors hover:bg-[#db8c5e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--paper)]"
                            href={apiUrl("/api/auth/github")}
                        >
                            Continue with GitHub <span aria-hidden="true">↗</span>
                        </a>
                    )}
                </div>
                {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
                <p className="mt-20 border-t border-[var(--line)] pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Private workspace · GitHub activity</p>
            </section>
        </main>
    );
}
