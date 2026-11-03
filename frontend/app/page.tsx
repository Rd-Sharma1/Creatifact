"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl, getCurrentUser } from "@/lib/api";

function EvidenceTrace() {
    return (
        <figure className="evidence-trace" aria-labelledby="trace-caption">
            <div className="trace-topline">
                <span>ACTIVITY / EVIDENCE / DRAFT</span>
                <span>ILLUSTRATIVE STUDY · 01</span>
            </div>

            <div className="trace-diagram">
                <svg className="trace-visual trace-visual-wide" viewBox="0 0 760 300" fill="none" aria-hidden="true">
                    <text className="svg-kicker" x="12" y="43">01 / SOURCE ACTIVITY</text>
                    <text className="svg-kicker svg-result-kicker" x="452" y="62">02 / CONTEXT, MADE VISIBLE</text>

                    <path className="trace-path trace-path-one" d="M190 99 C270 99 282 142 360 142" />
                    <path className="trace-path trace-path-two" d="M190 150 H360" />
                    <path className="trace-path trace-path-three" d="M190 201 C270 201 282 158 360 158" />
                    <path className="trace-path trace-merge-one" d="M360 142 C380 142 382 150 402 150" />
                    <path className="trace-path trace-merge-two" d="M360 150 H402" />
                    <path className="trace-path trace-merge-three" d="M360 158 C380 158 382 150 402 150" />
                    <path className="trace-path trace-output" d="M402 150 H452" />
                    <circle className="trace-junction" cx="402" cy="150" r="3.5" />

                    <g className="trace-source-row trace-row-one">
                        <circle className="trace-dot" cx="190" cy="99" r="3.5" />
                        <text className="svg-hash" x="18" y="103">a81f2c7</text>
                        <text className="svg-word" x="112" y="103">commit</text>
                    </g>
                    <line className="svg-row-rule" x1="18" y1="124" x2="190" y2="124" />
                    <g className="trace-source-row trace-row-two">
                        <circle className="trace-dot" cx="190" cy="150" r="3.5" />
                        <text className="svg-hash" x="18" y="154">b4e091d</text>
                        <text className="svg-word" x="112" y="154">code change</text>
                    </g>
                    <line className="svg-row-rule" x1="18" y1="175" x2="190" y2="175" />
                    <g className="trace-source-row trace-row-three">
                        <circle className="trace-dot trace-dot-muted" cx="190" cy="201" r="3.5" />
                        <text className="svg-hash svg-hash-muted" x="18" y="205">+ related files</text>
                    </g>

                    <rect className="trace-slip" x="452" y="83" width="280" height="135" />
                    <line className="trace-slip-rule" x1="452" y1="84" x2="732" y2="84" />
                    <text className="trace-slip-mark" x="476" y="137">↳</text>
                    <text className="trace-slip-copy" x="500" y="132">Context first.</text>
                    <text className="trace-slip-emphasis" x="500" y="158">Your voice stays yours.</text>
                    <text className="trace-slip-meta" x="476" y="197">DRAFT  —  EVIDENCE LINKED  —  YOUR CALL</text>
                </svg>

                <svg className="trace-visual trace-visual-mobile" viewBox="0 0 360 350" fill="none" aria-hidden="true">
                    <text className="svg-kicker" x="12" y="29">01 / SOURCE ACTIVITY</text>
                    <path className="trace-path trace-path-one" d="M336 78 C336 201 238 201 180 225" />
                    <path className="trace-path trace-path-two" d="M336 133 C294 202 238 211 180 225" />
                    <path className="trace-path trace-path-three" d="M336 188 C310 213 238 218 180 225" />
                    <path className="trace-path trace-output" d="M180 225 V250" />
                    <circle className="trace-junction" cx="180" cy="225" r="3.5" />

                    <text className="svg-hash" x="28" y="82">a81f2c7</text>
                    <text className="svg-word" x="155" y="82">commit</text>
                    <text className="svg-hash" x="28" y="137">b4e091d</text>
                    <text className="svg-word" x="155" y="137">code change</text>
                    <text className="svg-hash svg-hash-muted" x="28" y="192">+ related files</text>
                    <circle className="trace-dot" cx="336" cy="78" r="3.5" />
                    <circle className="trace-dot" cx="336" cy="133" r="3.5" />
                    <circle className="trace-dot trace-dot-muted" cx="336" cy="188" r="3.5" />
                    <line className="svg-row-rule" x1="12" y1="101" x2="324" y2="101" />
                    <line className="svg-row-rule" x1="12" y1="156" x2="324" y2="156" />

                    <rect className="trace-slip" x="12" y="250" width="336" height="100" />
                    <line className="trace-slip-rule" x1="12" y1="251" x2="348" y2="251" />
                    <text className="svg-kicker trace-slip-kicker" x="28" y="276">02 / CONTEXT, MADE VISIBLE</text>
                    <text className="trace-slip-copy" x="28" y="310">Context first.</text>
                    <text className="trace-slip-emphasis" x="28" y="335">Your voice stays yours.</text>
                </svg>
            </div>

            <figcaption id="trace-caption">
                A trail from source work to a draft you can inspect, shape and approve.
            </figcaption>
        </figure>
    );
}

function PositioningSection() {
    return (
        <section className="positioning-section" aria-labelledby="positioning-title" id="why-creatifact">
            <div className="section-rail">
                <span>02 / THE GAP</span>
                <span>WORK HAPPENS IN MANY PLACES</span>
            </div>

            <div className="positioning-heading">
                <h2 id="positioning-title">The work is already happening.<br /><em>Telling its story shouldn’t become another job.</em></h2>
                <p>
                    Commits, code changes and review threads capture what happened. You carry the decisions and context in your head. Turning that into a clear update takes time away from the work itself.
                </p>
            </div>

            <div className="activity-bridge">
                <div className="bridge-topline">
                    <span>ILLUSTRATIVE ACTIVITY</span>
                    <span>FRAGMENTS → CONTEXT</span>
                </div>
                <div className="bridge-content">
                    <ul className="activity-shards" aria-label="Illustrative GitHub activity fragments">
                        <li className="activity-shard shard-commit"><span>a81f2c7 / COMMIT</span><b>session renewal</b></li>
                        <li className="activity-shard shard-file"><span>src/auth/session.ts</span><b>cookie boundary</b></li>
                        <li className="activity-shard shard-review"><span>PR #42 / REVIEW</span><b>sign-in flow</b></li>
                        <li className="activity-shard shard-repo"><span>WEB APP · API</span><b>related changes</b></li>
                    </ul>
                    <svg className="bridge-trace" viewBox="0 0 160 180" fill="none" aria-hidden="true">
                        <path d="M4 26 C63 26 65 90 150 90" />
                        <path d="M4 72 C60 72 75 90 150 90" />
                        <path d="M4 119 C63 119 65 90 150 90" />
                        <path d="M4 158 C63 158 80 90 150 90" />
                        <circle cx="150" cy="90" r="3" />
                    </svg>
                    <div className="bridge-outcome">
                        <span>WHAT’S WORTH SHARING</span>
                        <p>Changes become a clear account, with the supporting work still in view.</p>
                        <small>You decide what the work means—and what to share.</small>
                    </div>
                </div>
            </div>
        </section>
    );
}

const workflowStages = [
    {
        id: "activity",
        number: "01",
        label: "ACTIVITY",
        title: "Start with what changed.",
        description: "Commits and code changes arrive from GitHub with their files, messages and history intact.",
        detail: "COMMITS · FILES · CHANGESETS",
    },
    {
        id: "context",
        number: "02",
        label: "CONTEXT",
        title: "Connect related work.",
        description: "Related changes are gathered into engineering context, so a draft can draw on more than one commit title.",
        detail: "TARGET WORK + SUPPORTING HISTORY",
    },
    {
        id: "creation",
        number: "03",
        label: "CREATION",
        title: "Shape possible narratives.",
        description: "Drafts are grounded in that context, with supporting evidence kept close so you can inspect what each claim refers to.",
        detail: "POSSIBLE ANGLES · EVIDENCE ATTACHED",
    },
    {
        id: "review",
        number: "04",
        label: "REVIEW",
        title: "You decide what stands.",
        description: "Edit, discard or approve a draft. Unsupported accomplishments should not be invented, and nothing is final without your review.",
        detail: "YOUR WORDS · YOUR APPROVAL",
    },
] as const;

function WorkflowDiagram({ activeStage }: { activeStage: number | null }) {
    return (
        <div className={`workflow-canvas-sticky${activeStage !== null ? " has-started" : ""}`}>
            <svg
                className="workflow-canvas"
                data-active-stage={activeStage ?? "all"}
                viewBox="0 0 1000 420"
                role="img"
                aria-labelledby="workflow-diagram-title workflow-diagram-description"
            >
                <title id="workflow-diagram-title">From GitHub activity to a human-approved draft</title>
                <desc id="workflow-diagram-description">Commit and file fragments connect into context, form an evidence-linked draft, and arrive at a person who reviews and approves it.</desc>
                <defs>
                    <pattern id="workflow-dot-grid" width="18" height="18" patternUnits="userSpaceOnUse">
                        <circle cx="1" cy="1" r="0.8" className="workflow-grid-dot" />
                    </pattern>
                </defs>
                <rect x="0" y="0" width="1000" height="420" fill="url(#workflow-dot-grid)" />

                <text className="workflow-svg-kicker" x="24" y="54">01 / ACTIVITY</text>
                <text className="workflow-svg-kicker" x="307" y="54">02 / CONTEXT</text>
                <text className="workflow-svg-kicker" x="568" y="54">03 / CREATION</text>
                <text className="workflow-svg-kicker" x="805" y="54">04 / REVIEW</text>

                <g className="workflow-unit workflow-unit-activity">
                    <path className="workflow-row-rule" d="M24 126H243 M24 181H243 M24 236H243" />
                    <circle className="workflow-source-node" cx="243" cy="105" r="4" />
                    <circle className="workflow-source-node" cx="243" cy="160" r="4" />
                    <circle className="workflow-source-node workflow-source-muted" cx="243" cy="215" r="4" />
                    <text className="workflow-code" x="30" y="109">a81f2c7</text>
                    <text className="workflow-dim" x="123" y="109">commit / session renewal</text>
                    <text className="workflow-code" x="30" y="164">src/auth/session.ts</text>
                    <text className="workflow-dim" x="30" y="219">PR #42 / cookie boundary</text>
                    <text className="workflow-micro" x="30" y="266">ILLUSTRATIVE INPUT</text>
                </g>

                <path className="workflow-link workflow-link-activity" d="M243 105 C278 105 274 160 306 160 M243 160H306 M243 215 C278 215 274 160 306 160" />
                <circle className="workflow-junction" cx="306" cy="160" r="4" />
                <path className="workflow-link workflow-link-context" d="M306 160H329" />

                <g className="workflow-unit workflow-unit-context">
                    <path className="workflow-context-mark" d="M329 96V224 M329 96H476 M329 224H476" />
                    <text className="workflow-code" x="350" y="128">session.ts</text>
                    <text className="workflow-code" x="350" y="162">renewal commit</text>
                    <text className="workflow-code" x="350" y="196">review notes</text>
                    <path className="workflow-context-rule" d="M350 139H455 M350 173H455 M350 207H455" />
                    <circle className="workflow-context-node" cx="463" cy="124" r="2.5" />
                    <circle className="workflow-context-node" cx="463" cy="158" r="2.5" />
                    <circle className="workflow-context-node" cx="463" cy="192" r="2.5" />
                    <text className="workflow-micro" x="350" y="250">RELATED HISTORY</text>
                </g>

                <path className="workflow-link workflow-link-creation" d="M476 160H548" />
                <path className="workflow-link workflow-link-review" d="M750 160H792" />

                <g className="workflow-unit workflow-unit-creation">
                    <rect className="workflow-draft" x="550" y="91" width="200" height="138" />
                    <path className="workflow-draft-rule" d="M550 92H750" />
                    <text className="workflow-draft-label" x="570" y="120">DRAFT / X</text>
                    <text className="workflow-draft-copy" x="570" y="157">Context first.</text>
                    <text className="workflow-draft-copy workflow-draft-copy-muted" x="570" y="182">Claims linked to work.</text>
                    <text className="workflow-draft-micro" x="570" y="210">EVIDENCE ATTACHED</text>
                    <circle className="workflow-evidence-pin" cx="738" cy="210" r="3" />
                </g>

                <g className="workflow-unit workflow-unit-review">
                    <circle className="workflow-review-ring" cx="858" cy="148" r="39" />
                    <path className="workflow-review-check" d="M842 148L853 159L875 135" />
                    <text className="workflow-review-word" x="808" y="218">YOUR CALL</text>
                    <text className="workflow-micro" x="808" y="244">EDIT · DISCARD · APPROVE</text>
                </g>
            </svg>

            <svg className="workflow-canvas-mobile" viewBox="0 0 360 720" fill="none" aria-hidden="true">
                <text className="workflow-svg-kicker" x="20" y="28">01 / ACTIVITY</text>
                <g className="workflow-unit workflow-unit-activity">
                    <path className="workflow-row-rule" d="M20 87H320 M20 132H320 M20 177H320" />
                    <text className="workflow-code" x="24" y="70">a81f2c7</text>
                    <text className="workflow-dim" x="125" y="70">commit / session renewal</text>
                    <text className="workflow-code" x="24" y="115">src/auth/session.ts</text>
                    <text className="workflow-dim" x="24" y="160">PR #42 / cookie boundary</text>
                    <circle className="workflow-source-node" cx="320" cy="65" r="3.5" />
                    <circle className="workflow-source-node" cx="320" cy="110" r="3.5" />
                    <circle className="workflow-source-node workflow-source-muted" cx="320" cy="155" r="3.5" />
                </g>

                <path className="workflow-link workflow-link-activity" d="M320 65 C320 190 180 190 180 220 M320 110 C290 190 180 190 180 220 M320 155 C270 195 180 195 180 220" />
                <circle className="workflow-junction" cx="180" cy="220" r="4" />
                <text className="workflow-svg-kicker" x="20" y="251">02 / CONTEXT</text>
                <path className="workflow-context-mark" d="M30 270V356 M30 270H330 M30 356H330" />
                <g className="workflow-unit workflow-unit-context">
                    <text className="workflow-code" x="50" y="296">session.ts</text>
                    <text className="workflow-code" x="50" y="322">renewal commit</text>
                    <text className="workflow-code" x="50" y="348">review notes</text>
                    <path className="workflow-context-rule" d="M50 303H300 M50 329H300 M50 355H300" />
                    <circle className="workflow-context-node" cx="310" cy="291" r="2.5" />
                    <circle className="workflow-context-node" cx="310" cy="317" r="2.5" />
                    <circle className="workflow-context-node" cx="310" cy="343" r="2.5" />
                </g>

                <path className="workflow-link workflow-link-creation" d="M180 356V382" />
                <text className="workflow-svg-kicker" x="20" y="405">03 / CREATION</text>
                <g className="workflow-unit workflow-unit-creation">
                    <rect className="workflow-draft" x="20" y="422" width="320" height="112" />
                    <path className="workflow-draft-rule" d="M20 423H340" />
                    <text className="workflow-draft-label" x="40" y="450">DRAFT / X</text>
                    <text className="workflow-draft-copy" x="40" y="481">Context first.</text>
                    <text className="workflow-draft-copy workflow-draft-copy-muted" x="40" y="505">Claims linked to work.</text>
                    <text className="workflow-draft-micro" x="40" y="524">EVIDENCE ATTACHED</text>
                    <circle className="workflow-evidence-pin" cx="328" cy="524" r="3" />
                </g>

                <path className="workflow-link workflow-link-review" d="M180 534V571" />
                <text className="workflow-svg-kicker" x="20" y="595">04 / REVIEW</text>
                <g className="workflow-unit workflow-unit-review">
                    <circle className="workflow-review-ring" cx="180" cy="631" r="22" />
                    <path className="workflow-review-check" d="M171 631L177 637L190 623" />
                    <text className="workflow-review-word" x="180" y="678" textAnchor="middle">YOUR CALL</text>
                    <text className="workflow-micro" x="180" y="700" textAnchor="middle">EDIT · DISCARD · APPROVE</text>
                </g>
            </svg>

            <p className="workflow-canvas-caption"><span>GITHUB → CONTEXT → DRAFT → YOU</span><span>NOTHING PUBLISHED FOR YOU</span></p>
        </div>
    );
}

function WorkflowSection() {
    const sectionRef = useRef<HTMLElement | null>(null);
    const [activeStage, setActiveStage] = useState<number | null>(null);

    useEffect(() => {
        const section = sectionRef.current;
        if (!section || typeof IntersectionObserver === "undefined") return;

        const stages = Array.from(section.querySelectorAll<HTMLElement>("[data-workflow-step]"));
        const observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter((entry) => entry.isIntersecting)
                .map((entry) => ({
                    index: Number((entry.target as HTMLElement).dataset.workflowStep),
                    distance: Math.abs(entry.boundingClientRect.top + entry.boundingClientRect.height / 2 - window.innerHeight / 2),
                }))
                .sort((a, b) => a.distance - b.distance);

            if (visible[0]) setActiveStage(visible[0].index);
        }, { rootMargin: "-38% 0px -38% 0px", threshold: 0 });

        stages.forEach((stage) => observer.observe(stage));
        return () => observer.disconnect();
    }, []);

    return (
        <section className="workflow-section" id="how-it-works" aria-labelledby="workflow-title" ref={sectionRef}>
            <div className="section-rail workflow-section-rail">
                <span>03 / THE TRANSFORMATION</span>
                <span>FOUR STEPS · ONE CONTINUOUS THREAD</span>
            </div>
            <div className="workflow-heading">
                <h2 id="workflow-title">A clearer story, built from the work.</h2>
                <p>Creatifact keeps the source activity connected to the draft—then leaves the final decision with you.</p>
            </div>

            <div className="workflow-layout">
                <div className="workflow-visual-column">
                    <WorkflowDiagram activeStage={activeStage} />
                </div>
                <div className="workflow-stages" aria-label="Creatifact workflow stages">
                    {workflowStages.map((stage, index) => (
                        <article
                            className={`workflow-stage${activeStage === index ? " is-active" : ""}`}
                            data-workflow-step={index}
                            key={stage.id}
                        >
                            <span className="workflow-stage-number" aria-hidden="true">{stage.number}</span>
                            <div className="workflow-stage-copy">
                                <p className="workflow-stage-label">{stage.label}</p>
                                <h3>{stage.title}</h3>
                                <p className="workflow-stage-description">{stage.description}</p>
                                <p className="workflow-stage-detail">{stage.detail}</p>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default function LandingPage() {
    const router = useRouter();
    const [authStarting, setAuthStarting] = useState(false);
    const [showHow, setShowHow] = useState(false);

    useEffect(() => {
        let active = true;
        getCurrentUser().then(() => {
            if (active) router.replace("/dashboard");
        }).catch(() => {
            // The public landing page remains available when the API is offline.
        });
        return () => { active = false; };
    }, [router]);

    function toggleHow() {
        setShowHow((current) => !current);
    }

    function beginGitHubSignIn() {
        setAuthStarting(true);
    }

    return (
        <main className="landing-shell">
            <header className="site-header">
                <a href="/" className="wordmark" aria-label="Creatifact home">
                    <span className="wordmark-symbol" aria-hidden="true">c</span>
                    <span>creatifact<span className="wordmark-period">.</span></span>
                </a>
                <p className="header-note">Engineering work, made legible.</p>
                <div className="header-action">
                    <a className="text-link" href={apiUrl("/api/auth/github")} onClick={beginGitHubSignIn}>
                        {authStarting ? "Opening GitHub…" : "Sign in"} <span aria-hidden="true">↗</span>
                    </a>
                </div>
            </header>

            <section className="hero" aria-labelledby="hero-title">
                <div className="hero-copy">
                    <p className="eyebrow"><span className="eyebrow-mark" /> GITHUB ACTIVITY / HUMAN-APPROVED CONTENT</p>
                    <h1 id="hero-title"><span className="hero-heading-line">Make your work</span><span className="hero-heading-line">easier to <em>share.</em></span></h1>
                    <p className="hero-description">
                        Creatifact turns your GitHub activity into evidence-backed drafts for X and LinkedIn. Review every line, make it yours, and approve only what feels right.
                    </p>

                    <div className="hero-actions">
                        <div className="primary-action-wrap">
                            <a className="primary-action" href={apiUrl("/api/auth/github")} onClick={beginGitHubSignIn}>
                                {authStarting ? "Opening GitHub authorization" : "Continue with GitHub"}
                                <span className="action-arrow" aria-hidden="true">{authStarting ? "…" : "↗"}</span>
                            </a>
                        </div>
                        <button className="secondary-action" type="button" onClick={toggleHow} aria-expanded={showHow} aria-controls="how-summary">
                            {showHow ? "Close the short version" : "How it works"}
                            <span aria-hidden="true">{showHow ? "−" : "↓"}</span>
                        </button>
                    </div>

                    {authStarting && <p className="auth-feedback" role="status">Taking you to GitHub to sign in.</p>}

                    <div className={`how-summary${showHow ? " is-open" : ""}`} id="how-summary" hidden={!showHow}>
                        <p><span>01</span> Relevant GitHub changes are gathered into context.</p>
                        <p><span>02</span> Drafts connect their claims to that evidence.</p>
                        <p><span>03</span> You review, edit and approve what to keep.</p>
                    </div>

                    <p className="hero-assurance"><span aria-hidden="true">✳</span> No invented accomplishments. You stay in control.</p>
                </div>

                <div className="hero-art" aria-label="Illustration of engineering activity becoming a reviewable draft">
                    <div className="art-index"><span>FIG. 01</span><span>ACTIVITY → CONTEXT → DRAFT</span></div>
                    <EvidenceTrace />
                    <div className="art-caption"><span>THE WORK IS ALREADY THERE.</span><span>THE STORY, MADE CLEARER.</span></div>
                </div>
            </section>

            <PositioningSection />
            <WorkflowSection />

            <footer className="landing-footer">
                <span>CREATIFACT <b>·</b> V1</span>
                <span>Built from your work. Finished by you.</span>
                <span>GITHUB → HUMAN REVIEW</span>
            </footer>
        </main>
    );
}
