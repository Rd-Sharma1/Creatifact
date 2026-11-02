"use client";

import { useEffect, useState } from "react";
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
                        <button className="secondary-action" type="button" onClick={toggleHow} aria-expanded={showHow} aria-controls="how-it-works">
                            {showHow ? "Close the short version" : "How it works"}
                            <span aria-hidden="true">{showHow ? "−" : "↓"}</span>
                        </button>
                    </div>

                    {authStarting && <p className="auth-feedback" role="status">Taking you to GitHub to sign in.</p>}

                    <div className={`how-summary${showHow ? " is-open" : ""}`} id="how-it-works" hidden={!showHow}>
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

            <footer className="landing-footer">
                <span>CREATIFACT <b>·</b> V1</span>
                <span>Built from your work. Finished by you.</span>
                <span>GITHUB → HUMAN REVIEW</span>
            </footer>
        </main>
    );
}
