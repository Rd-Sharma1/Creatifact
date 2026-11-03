"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
    ApiClientError,
    AuthenticationRequiredError,
    createArtifactRequest,
    apiUrl,
    type ArtifactRequestScope,
    type ArtifactType,
    type AuthorizedRepository,
    type CurrentUser,
} from "@/lib/api";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import { initializeWorkspace } from "@/lib/workspaceInitialization";

type PageState = "loading" | "ready" | "error";
type ScopeChoice = Exclude<ArtifactRequestScope, { type: "DATE_RANGE" }>["type"] | "DATE_RANGE";

const artifactOptions: Array<{ type: ArtifactType; name: string; detail: string }> = [
    { type: "X_POST", name: "X post", detail: "Short-form" },
    { type: "LINKEDIN_POST", name: "LinkedIn post", detail: "Long-form" },
];

function todayInputValue(): string {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function scopePayload(scope: ScopeChoice, from: string, to: string): ArtifactRequestScope {
    if (scope === "DATE_RANGE") return { type: scope, from, to };
    return { type: scope };
}

export default function DashboardPage() {
    const router = useRouter();
    const [state, setState] = useState<PageState>("loading");
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [repositories, setRepositories] = useState<AuthorizedRepository[]>([]);
    const [selectedRepositoryId, setSelectedRepositoryId] = useState("");
    const [artifactTypes, setArtifactTypes] = useState<ArtifactType[]>(["X_POST"]);
    const [scope, setScope] = useState<ScopeChoice>("LATEST");
    const [from, setFrom] = useState(todayInputValue);
    const [to, setTo] = useState(todayInputValue);
    const [instructions, setInstructions] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadWorkspace = useCallback(async () => {
        setState("loading");
        setError(null);
        try {
            const workspace = await initializeWorkspace();
            setUser(workspace.user);
            setRepositories(workspace.repositories);
            setSelectedRepositoryId(current => current || workspace.repositories[0]?.id || "");
            setState("ready");
        } catch (reason) {
            if (reason instanceof AuthenticationRequiredError || (reason instanceof ApiClientError && reason.status === 401)) {
                router.replace("/");
                return;
            }
            setError(reason instanceof Error ? reason.message : "The workspace could not be loaded.");
            setState("error");
        }
    }, [router]);

    useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

    const selectedRepository = useMemo(
        () => repositories.find(repository => repository.id === selectedRepositoryId),
        [repositories, selectedRepositoryId],
    );

    function toggleArtifactType(type: ArtifactType) {
        setArtifactTypes(current => current.includes(type) ? current.filter(item => item !== type) : [...current, type]);
    }

    async function submitRequest(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedRepositoryId || artifactTypes.length === 0) return;
        if (scope === "DATE_RANGE" && (!from || !to || from > to)) {
            setError("Choose a valid date range. The end date must be on or after the start date.");
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            const created = await createArtifactRequest({
                repositoryId: selectedRepositoryId,
                artifactTypes,
                scope: scopePayload(scope, from, to),
                instructions: instructions.trim() || undefined,
            });
            router.push(`/dashboard/requests/${encodeURIComponent(created.id)}`);
        } catch (reason) {
            if (reason instanceof AuthenticationRequiredError) {
                router.replace("/");
                return;
            }
            setError(reason instanceof Error ? reason.message : "The request could not be created.");
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-primary)]">
            {user && <WorkspaceHeader githubName={user.githubName} />}
            <main className="mx-auto max-w-7xl px-5 pb-20 pt-12 md:px-9 md:pt-16">
                {state === "loading" && <p className="py-24 font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Opening your workspace…</p>}
                {state === "error" && (
                    <section className="max-w-2xl border-y border-[var(--line)] py-12" role="alert">
                        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--amber)]">Workspace unavailable</p>
                        <h1 className="font-serif text-4xl">We couldn’t reach your workspace.</h1>
                        <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{error}</p>
                        <button onClick={() => void loadWorkspace()} className="mt-7 border border-[var(--line)] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors hover:border-[var(--amber)]">Try again</button>
                    </section>
                )}

                {state === "ready" && user && (
                    <>
                        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[var(--line)] pb-8">
                            <div>
                                <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.19em] text-[var(--amber)]">Workspace / New artifact request</p>
                                <h1 className="max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.055em] md:text-7xl">Make the work<br className="hidden sm:block" /> easier to share.</h1>
                                <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">Choose a repository and a time scope. Creatifact gathers the engineering context; you review every draft before anything becomes final.</p>
                            </div>
                            <p className="pb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">Signed in as <span className="text-[var(--paper)]">@{user.githubName}</span></p>
                        </div>

                        {repositories.length === 0 ? (
                            <section className="grid gap-8 py-14 md:grid-cols-[1fr_0.8fr] md:py-20">
                                <div>
                                    <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--amber)]">01 / Repository access</p>
                                    <h2 className="font-serif text-4xl leading-tight md:text-5xl">Connect the history you want to work from.</h2>
                                </div>
                                <div className="border-l border-[var(--line)] py-1 pl-6 md:pl-8">
                                    <p className="text-sm leading-6 text-[var(--text-secondary)]">Install the Creatifact GitHub App on an account or organization. Repositories you authorize will appear here.</p>
                                    <form className="mt-7" action={apiUrl("/api/auth/github/install")} method="post">
                                        <button type="submit" className="min-h-12 bg-[var(--amber)] px-5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--paper)]">Install GitHub App <span aria-hidden="true">↗</span></button>
                                    </form>
                                </div>
                            </section>
                        ) : (
                            <div className="grid gap-12 pt-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 lg:pt-14">
                                <section aria-labelledby="repository-heading">
                                    <div className="mb-6 flex items-end justify-between border-b border-[var(--line)] pb-3">
                                        <div>
                                            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--amber)]">01 / Source</p>
                                            <h2 id="repository-heading" className="font-serif text-3xl">Repository</h2>
                                        </div>
                                        <span className="font-mono text-[9px] text-[var(--muted)]">{String(repositories.length).padStart(2, "0")} AVAILABLE</span>
                                    </div>
                                    <ul className="divide-y divide-[var(--line)]">
                                        {repositories.map((repository, index) => {
                                            const selected = repository.id === selectedRepositoryId;
                                            return (
                                                <li key={repository.id}>
                                                    <button type="button" aria-pressed={selected} onClick={() => setSelectedRepositoryId(repository.id)} className={`group flex min-h-[70px] w-full items-center justify-between gap-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--amber)] ${selected ? "text-[var(--paper)]" : "text-[var(--muted)] hover:text-[var(--paper-dim)]"}`}>
                                                        <span className="flex min-w-0 items-center gap-4">
                                                            <span className={`font-mono text-[9px] ${selected ? "text-[var(--amber)]" : "text-[var(--muted)]"}`}>{String(index + 1).padStart(2, "0")}</span>
                                                            <span className="truncate text-sm"><span className="text-[var(--muted)]">{repository.owner}</span><span className="px-1.5 text-[var(--line)]">/</span>{repository.name}</span>
                                                        </span>
                                                        <span aria-hidden="true" className={`grid size-4 shrink-0 place-items-center rounded-full border text-[9px] ${selected ? "border-[var(--amber)] text-[var(--amber)]" : "border-[var(--line)]"}`}>{selected ? "✓" : ""}</span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    <p className="mt-4 font-mono text-[9px] leading-5 text-[var(--muted)]">Repository access is checked by Creatifact on every request.</p>
                                </section>

                                <section id="new-request" aria-labelledby="request-heading" className="scroll-mt-28">
                                    <div className="mb-6 border-b border-[var(--line)] pb-3">
                                        <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--amber)]">02 / Intent</p>
                                        <h2 id="request-heading" className="font-serif text-3xl">What should we make?</h2>
                                    </div>
                                    <form onSubmit={submitRequest} className="space-y-8">
                                        <fieldset>
                                            <legend className="mb-3 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Artifact type <span className="text-[var(--amber)]">· choose one or both</span></legend>
                                            <div className="grid gap-2 sm:grid-cols-2">
                                                {artifactOptions.map(option => {
                                                    const checked = artifactTypes.includes(option.type);
                                                    return (
                                                        <label key={option.type} className={`flex min-h-[68px] cursor-pointer items-center justify-between border px-4 transition-colors ${checked ? "border-[var(--amber)] bg-[var(--amber)]/5" : "border-[var(--line)] hover:border-[var(--paper-dim)]"}`}>
                                                            <span><span className="block text-sm text-[var(--paper)]">{option.name}</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">{option.detail}</span></span>
                                                            <input type="checkbox" value={option.type} checked={checked} onChange={() => toggleArtifactType(option.type)} className="size-4 accent-[var(--amber)]" />
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </fieldset>

                                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                                            <label className="block">
                                                <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Engineering scope</span>
                                                <select value={scope} onChange={event => setScope(event.target.value as ScopeChoice)} className="min-h-12 w-full border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--paper)] outline-none transition-colors focus:border-[var(--amber)]">
                                                    <option value="LATEST">Latest ChangeSet</option>
                                                    <option value="TODAY">Today</option>
                                                    <option value="YESTERDAY">Yesterday</option>
                                                    <option value="THIS_WEEK">This week</option>
                                                    <option value="LAST_WEEK">Last week</option>
                                                    <option value="DATE_RANGE">Date range</option>
                                                </select>
                                            </label>
                                            {scope === "DATE_RANGE" && (
                                                <div className="grid grid-cols-2 gap-3">
                                                    <label className="block"><span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">From</span><input required type="date" value={from} onChange={event => setFrom(event.target.value)} className="min-h-12 w-full border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--paper)] outline-none focus:border-[var(--amber)]" /></label>
                                                    <label className="block"><span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">To</span><input required type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} className="min-h-12 w-full border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--paper)] outline-none focus:border-[var(--amber)]" /></label>
                                                </div>
                                            )}
                                        </div>

                                        <label className="block">
                                            <span className="mb-2 block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Instructions <span className="normal-case tracking-normal">· optional</span></span>
                                            <textarea value={instructions} onChange={event => setInstructions(event.target.value)} rows={4} placeholder="What should the draft emphasize? For example: focus on the authentication work and explain the technical trade-off." className="w-full resize-y border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--paper)] outline-none placeholder:text-[var(--muted)]/80 focus:border-[var(--amber)]" />
                                        </label>

                                        {error && <p role="alert" className="border-l border-red-400 pl-3 text-sm leading-6 text-red-200">{error}</p>}

                                        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-5">
                                            <p className="max-w-sm font-mono text-[9px] leading-5 text-[var(--muted)]">{selectedRepository ? `Context from ${selectedRepository.owner}/${selectedRepository.name}. You approve every final artifact.` : "Select a repository to continue."}</p>
                                            <button type="submit" disabled={submitting || !selectedRepositoryId || artifactTypes.length === 0} className="inline-flex min-h-12 items-center gap-8 bg-[var(--amber)] px-5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-45">
                                                {submitting ? "Creating request…" : "Create request"}<span aria-hidden="true">↗</span>
                                            </button>
                                        </div>
                                    </form>
                                </section>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
