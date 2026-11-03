import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authCookieNames, findVerifiedInstallation, frontendDashboardUrl, isSameGithubUser, oauthStateCookie, oauthStateMatches, readCookie, sessionCookie } from "./githubAuth.js";
import { isAllowedOrigin } from "../../middleware/cors.js";

describe("GitHub auth boundary helpers", () => {
    it("reads the exact cookie name and preserves opaque token characters", () => {
        assert.equal(readCookie("other=value; creatifact_session=opaque.token==", authCookieNames.session), "opaque.token==");
        assert.equal(readCookie("creatifact_session_old=wrong", authCookieNames.session), undefined);
        assert.equal(readCookie(undefined, authCookieNames.session), undefined);
    });

    it("creates an HTTP-only same-site session cookie", () => {
        const previous = process.env.AUTH_COOKIE_SECURE;
        process.env.AUTH_COOKIE_SECURE = "true";
        const cookie = sessionCookie("opaque-session-token");
        if (previous === undefined) delete process.env.AUTH_COOKIE_SECURE;
        else process.env.AUTH_COOKIE_SECURE = previous;
        assert.match(cookie, /^creatifact_session=opaque-session-token;/);
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /SameSite=Lax/);
        assert.match(cookie, /Secure/);
        assert.match(cookie, /Path=\//);
    });

    it("keeps the OAuth state cookie secure, host-only, and consistent with the callback host", () => {
        const previous = process.env.AUTH_COOKIE_SECURE;
        process.env.AUTH_COOKIE_SECURE = "true";
        try {
            const cookie = oauthStateCookie("opaque-state");
            assert.match(cookie, /^creatifact_oauth_state=opaque-state;/);
            assert.match(cookie, /HttpOnly/);
            assert.match(cookie, /SameSite=Lax/);
            assert.match(cookie, /Secure/);
            assert.match(cookie, /Path=\//);
            assert.doesNotMatch(cookie, /Domain=/i);
        } finally {
            if (previous === undefined) delete process.env.AUTH_COOKIE_SECURE;
            else process.env.AUTH_COOKIE_SECURE = previous;
        }
    });

    it("accepts only the configured application origin for unsafe requests", () => {
        assert.equal(isAllowedOrigin("https://app.example.test", "https://app.example.test"), true);
        assert.equal(isAllowedOrigin("http://localhost:3000", "http://localhost:3000"), true);
        assert.equal(isAllowedOrigin("https://evil.example.test", "https://app.example.test"), false);
        assert.equal(isAllowedOrigin("https://gentile-oblivion-otter.ngrok-free.dev", "http://localhost:3000"), false);
        assert.equal(isAllowedOrigin(undefined, "https://app.example.test"), false);
        assert.equal(isAllowedOrigin("not an origin", "https://app.example.test"), false);
        assert.equal(isAllowedOrigin("https://app.example.test", undefined), false);
    });

    it("binds OAuth state to the initiating browser value", () => {
        assert.equal(oauthStateMatches("random-state", "random-state"), true);
        assert.equal(oauthStateMatches("attacker-state", "browser-state"), false);
        assert.equal(oauthStateMatches("state", undefined), false);
    });

    it("builds the fixed dashboard redirect from the configured frontend origin", () => {
        assert.equal(frontendDashboardUrl("https://creatifact.ridam.in"), "https://creatifact.ridam.in/dashboard");
        assert.equal(frontendDashboardUrl("https://creatifact.ridam.in/untrusted?next=https://evil.test"), "https://creatifact.ridam.in/dashboard");
        assert.throws(() => frontendDashboardUrl("javascript:alert(1)"));
    });

    it("accepts only the expected, active GitHub App installation", () => {
        const installations = [
            { id: 10, app_id: 77, account: { id: 2, login: "org", type: "Organization" } },
            { id: 11, app_id: 77, suspended_at: "2026-10-20T00:00:00Z", account: { id: 3, login: "suspended", type: "Organization" } },
            { id: 12, app_id: 88, account: { id: 4, login: "other-app", type: "Organization" } },
        ];
        assert.equal(findVerifiedInstallation(installations, 10, 77)?.id, 10);
        assert.equal(findVerifiedInstallation(installations, 11, 77), undefined);
        assert.equal(findVerifiedInstallation(installations, 12, 77), undefined);
        assert.equal(findVerifiedInstallation(installations, 999, 77), undefined);
    });

    it("requires installation OAuth to return the same GitHub identity as the session", () => {
        assert.equal(isSameGithubUser(500n, 500), true);
        assert.equal(isSameGithubUser(500n, 501), false);
        assert.equal(isSameGithubUser(null, 500), false);
    });
});
