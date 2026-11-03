"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ApiClientError,
    AuthenticationRequiredError,
    discardCandidate,
    editCandidate,
    getArtifactRequest,
    getCurrentUser,
    selectCandidate,
    type ArtifactCandidate,
    type ArtifactRequestDetail,
    type ArtifactType,
    type CurrentUser,
} from "@/lib/api";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";

const typeName: Record<ArtifactType, string> = { X_POST: "X post", LINKEDIN_POST: "LinkedIn post" };
const typeLimit: Record<ArtifactType, number> = { X_POST: 280, LINKEDIN_POST: 3000 };
const terminalStatuses = new Set(["COMPLETED", "FAILED"]);

function shortId(value: string): string {
    return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function statusTone(status: string): string {
    if (status === "COMPLETED" || status === "SELECTED") return "border-emerald-700/70 text-emerald-300";
    if (status === "FAILED" || status === "DISCARDED") return "border-red-900/80 text-red-300";
    if (status === "GENERATING" || status === "PENDING") return "border-[var(--amber)]/60 text-[var(--amber)]";
    return "border-[var(--line)] text-[var(--muted)]";
}

function StatusLabel({ status }: { status: string }) {
    return <span className={`inline-flex min-h-7 items-center border px-2.5 font-mono text-[9px] uppercase tracking-[0.12em] ${statusTone(status)}`}>{status.replaceAll("_", " ")}</span>;
}

export default function ArtifactRequestPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const requestId = params.id;
    const [user, setUser] = useState<CurrentUser | null>(null);
    const [request, setRequest] = useState<ArtifactRequestDetail | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyCandidateId, setBusyCandidateId] = useState<string | null>(null);
    const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
    const [editedContent, setEditedContent] = useState("");

    const load = useCallback(async (showError = true) => {
        try {
            const [currentUser, detail] = await Promise.all([getCurrentUser(), getArtifactRequest(requestId)]);
            setUser(currentUser);
            setRequest(detail);
            if (showError) setError(null);
            return detail;
        } catch (reason) {
            if (reason instanceof AuthenticationRequiredError || (reason instanceof ApiClientError && reason.status === 401)) {
                router.replace("/");
                return null;
            }
            if (showError) setError(reason instanceof Error ? reason.message : "The request could not be loaded.");
            return null;
        } finally {
            setInitialLoading(false);
        }
    }, [requestId, router]);

    useEffect(() => {
        let active = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const poll = async () => {
            const detail = await load();
            if (active && (!detail || !terminalStatuses.has(detail.status))) {
                timer = setTimeout(() => { void poll(); }, 4000);
            }
        };
        void poll();
        return () => { active = false; if (timer) clearTimeout(timer); };
    }, [load]);

    const candidatesByType = useMemo(() => {
        const groups = new Map<ArtifactType, ArtifactCandidate[]>();
        for (const candidate of request?.candidates ?? []) {
            const list = groups.get(candidate.type) ?? [];
            list.push(candidate);
            groups.set(candidate.type, list);
        }
        return groups;
    }, [request?.candidates]);

    const artifactByType = useMemo(() => new Map((request?.artifacts ?? []).map(artifact => [artifact.type, artifact])), [request?.artifacts]);

    async function act(candidateId: string, operation: () => Promise<unknown>) {
        setBusyCandidateId(candidateId);
        setError(null);
        try {
            await operation();
            setEditingCandidateId(null);
            await load();
        } catch (reason) {
            if (reason instanceof AuthenticationRequiredError) router.replace("/");
            else setError(reason instanceof Error ? reason.message : "That action could not be completed.");
        } finally {
            setBusyCandidateId(null);
        }
    }

    function beginEdit(candidate: ArtifactCandidate) {
        setEditingCandidateId(candidate.id);
        setEditedContent(candidate.content);
    }

    if (initialLoading) {
        return <main className="min-h-screen bg-[var(--page-bg)] px-5 py-20 font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Loading request…</main>;
    }

    return (
        <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-primary)]">
            {user && <WorkspaceHeader githubName={user.githubName} />}
            <main className="mx-auto max-w-7xl px-5 pb-24 pt-10 md:px-9 md:pt-14">
                <a href="/dashboard" className="font-mono text-[9px] uppercase tracking-[0.13em] text-[var(--muted)] transition-colors hover:text-[var(--amber)]">← Workspace</a>
                {!request ? (
                    <section className="mt-10 max-w-2xl border-y border-[var(--line)] py-10" role="alert">
                        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--amber)]">Request unavailable</p>
                        <h1 className="font-serif text-4xl">We couldn’t load this request.</h1>
                        <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{error ?? "The request may have been removed or you may not have access to it."}</p>
                        <button onClick={() => void load()} className="mt-6 border border-[var(--line)] px-4 py-3 font-mono text-[9px] uppercase tracking-[0.12em] hover:border-[var(--amber)]">Try again</button>
                    </section>
                ) : (
                    <>
                        <section className="mt-8 grid gap-8 border-b border-[var(--line)] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
                            <div>
                                <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--amber)]">Artifact request / {shortId(request.id)}</p>
                                <h1 className="font-serif text-5xl leading-none tracking-[-0.05em] md:text-7xl">Your drafts, <span className="italic text-[var(--muted)]">in progress.</span></h1>
                                <p className="mt-5 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Review the evidence behind each candidate. Select a draft when it is ready to become a final artifact.</p>
                            </div>
                            <div className="flex items-center gap-3 lg:pb-1"><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[var(--muted)]">Request status</span><StatusLabel status={request.status} /></div>
                        </section>

                        <section className="grid gap-8 border-b border-[var(--line)] py-6 md:grid-cols-[1fr_1.2fr]">
                            <div>
                                <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Requested formats</p>
                                <div className="flex flex-wrap gap-2">{request.artifactTypes.map(type => <span key={type} className="border border-[var(--line)] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.1em]">{typeName[type]}</span>)}</div>
                            </div>
                            <div>
                                <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--muted)]">Engineering context</p>
                                <div className="flex flex-wrap gap-2">{request.changeSets.map(item => <span key={item.id} title={item.id} className="border border-[var(--line)] px-3 py-2 font-mono text-[9px] text-[var(--paper-dim)]">{item.role} · {shortId(item.id)}</span>)}</div>
                            </div>
                        </section>

                        {!terminalStatuses.has(request.status) && (
                            <section className="flex flex-wrap items-center gap-4 border-b border-[var(--line)] py-6" aria-live="polite">
                                <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--amber)] opacity-40 motion-reduce:animate-none" /><span className="relative inline-flex size-2 rounded-full bg-[var(--amber)]" /></span>
                                <p className="text-sm text-[var(--paper-dim)]">{request.status === "PENDING" ? "Your request is queued." : "Drafts are being prepared from the selected engineering history."}</p>
                                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">Updates automatically</span>
                            </section>
                        )}

                        {request.status === "FAILED" && request.candidates.length === 0 && (
                            <section className="border-b border-[var(--line)] py-7" role="status">
                                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-red-300">Generation did not complete</p>
                                <p className="mt-2 text-sm text-[var(--text-secondary)]">No candidates were produced. You can create another request after checking provider availability.</p>
                            </section>
                        )}

                        {error && <p role="alert" className="my-6 border-l border-red-400 pl-3 text-sm leading-6 text-red-200">{error}</p>}

                        <section className="pt-9" aria-labelledby="candidate-heading">
                            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                                <div><p className="mb-2 font-mono text-[9px] uppercase tracking-[0.17em] text-[var(--amber)]">Review / Select</p><h2 id="candidate-heading" className="font-serif text-4xl md:text-5xl">Candidate drafts</h2></div>
                                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">Evidence stays attached</span>
                            </div>

                            <div className="space-y-12">
                                {request.artifactTypes.map(type => {
                                    const candidates = candidatesByType.get(type) ?? [];
                                    const artifact = artifactByType.get(type);
                                    return (
                                        <section key={type} className="border-t border-[var(--line)]">
                                            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                                                <h3 className="font-serif text-2xl">{typeName[type]}</h3>
                                                <div className="flex items-center gap-3"><span className="font-mono text-[9px] text-[var(--muted)]">{candidates.length} {candidates.length === 1 ? "candidate" : "candidates"}</span>{artifact && <StatusLabel status="SELECTED" />}</div>
                                            </div>
                                            {artifact && (
                                                <article className="mb-5 border border-emerald-900/70 bg-emerald-950/15 p-5 md:p-7">
                                                    <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-300">Final artifact · approved</p>
                                                    <p className="whitespace-pre-wrap text-[15px] leading-7 text-[var(--paper)]">{artifact.content}</p>
                                                </article>
                                            )}
                                            {candidates.length === 0 && !artifact && <p className="border-b border-[var(--line)] py-6 text-sm text-[var(--muted)]">{terminalStatuses.has(request.status) ? "No candidate was returned for this format." : "Waiting for this format…"}</p>}
                                            <div className="grid gap-4 xl:grid-cols-2">
                                                {candidates.map((candidate, index) => {
                                                    const editing = editingCandidateId === candidate.id;
                                                    const actionsEnabled = terminalStatuses.has(request.status) && candidate.status === "READY" && !artifact;
                                                    const characters = Array.from(editing ? editedContent : candidate.content).length;
                                                    return (
                                                        <article key={candidate.id} className="flex min-w-0 flex-col border border-[var(--line)] bg-[var(--surface)]">
                                                            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
                                                                <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[var(--muted)]">Draft {String(index + 1).padStart(2, "0")} · {candidate.angle}</span>
                                                                <StatusLabel status={candidate.status} />
                                                            </div>
                                                            <div className="flex-1 p-5">
                                                                {editing ? (
                                                                    <label className="block"><span className="sr-only">Edit {typeName[type]} content</span><textarea autoFocus rows={7} maxLength={typeLimit[type]} value={editedContent} onChange={event => setEditedContent(event.target.value)} className="min-h-40 w-full resize-y border border-[var(--line)] bg-[var(--page-bg)] p-3 text-sm leading-6 text-[var(--paper)] outline-none focus:border-[var(--amber)]" /></label>
                                                                ) : <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--paper)]">{candidate.content}</p>}
                                                                <p className={`mt-3 text-right font-mono text-[9px] ${characters > typeLimit[type] ? "text-red-300" : "text-[var(--muted)]"}`}>{characters} / {typeLimit[type]} characters</p>
                                                                <details className="group mt-5 border-t border-[var(--line)] pt-4">
                                                                    <summary className="cursor-pointer list-none font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--amber)] marker:hidden focus-visible:outline-2 focus-visible:outline-[var(--amber)]">Evidence / {candidate.evidence.length} references <span className="ml-1 inline-block transition-transform group-open:rotate-90">›</span></summary>
                                                                    <ul className="mt-4 space-y-4">
                                                                        {candidate.evidence.map((reference, evidenceIndex) => (
                                                                            <li key={`${reference.changeSetId}-${evidenceIndex}`} className="border-l border-[var(--line)] pl-3">
                                                                                <p className="text-xs leading-5 text-[var(--paper-dim)]">{reference.claim}</p>
                                                                                <blockquote className="mt-2 text-xs italic leading-5 text-[var(--muted)]">“{reference.quote}”</blockquote>
                                                                                <p className="mt-2 font-mono text-[8px] text-[var(--muted)]">CHANGESET {shortId(reference.changeSetId)}</p>
                                                                            </li>
                                                                        ))}
                                                                        {candidate.evidence.length === 0 && <li className="text-xs text-[var(--muted)]">No evidence references were returned.</li>}
                                                                    </ul>
                                                                </details>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-4 py-3">
                                                                {editing ? (
                                                                    <>
                                                                        <button type="button" disabled={busyCandidateId === candidate.id || !editedContent.trim() || characters > typeLimit[type]} onClick={() => void act(candidate.id, () => editCandidate(request.id, candidate.id, editedContent))} className="min-h-10 bg-[var(--amber)] px-4 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-45">{busyCandidateId === candidate.id ? "Checking…" : "Save edit"}</button>
                                                                        <button type="button" onClick={() => setEditingCandidateId(null)} className="min-h-10 px-3 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] hover:text-[var(--paper)]">Cancel</button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button type="button" disabled={!actionsEnabled || busyCandidateId === candidate.id} onClick={() => beginEdit(candidate)} className="min-h-10 border border-[var(--line)] px-3 font-mono text-[9px] uppercase tracking-[0.1em] hover:border-[var(--paper-dim)] disabled:cursor-not-allowed disabled:opacity-40">Edit</button>
                                                                        <button type="button" disabled={!actionsEnabled || busyCandidateId === candidate.id} onClick={() => { if (window.confirm("Discard this candidate? It cannot be selected afterward.")) void act(candidate.id, () => discardCandidate(request.id, candidate.id)); }} className="min-h-10 border border-[var(--line)] px-3 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] hover:border-red-800 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40">Discard</button>
                                                                        <button type="button" disabled={!actionsEnabled || busyCandidateId === candidate.id} onClick={() => void act(candidate.id, () => selectCandidate(request.id, candidate.id))} className="ml-auto min-h-10 bg-[var(--amber)] px-3 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40">{busyCandidateId === candidate.id ? "Saving…" : "Approve & save"}</button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </article>
                                                    );
                                                })}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}
