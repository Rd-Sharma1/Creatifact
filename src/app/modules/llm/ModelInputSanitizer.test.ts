import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeModelText } from "./ModelInputSanitizer.js";

describe("sanitizeModelText", () => {
    it("redacts recognizable credentials, private keys, and email addresses", () => {
        const source = [
            "OPENROUTER_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz123456",
            "Authorization: Bearer eyJabcdefghijk.abcdefghijk.abcdefghijk",
            "GitHub token ghp_abcdefghijklmnopqrstuvwxyz1234567890",
            "-----BEGIN PRIVATE KEY-----\nsynthetic-private-key-material\n-----END PRIVATE KEY-----",
            "Contact dev@example.com",
        ].join("\n");
        const result = sanitizeModelText(source);

        assert.ok(result.redactionCount >= 5);
        assert.equal(result.unsafe, false);
        assert.ok(!result.text.includes("sk-proj-abcdefghijklmnopqrstuvwxyz123456"));
        assert.ok(!result.text.includes("eyJabcdefghijk.abcdefghijk.abcdefghijk"));
        assert.ok(!result.text.includes("ghp_abcdefghijklmnopqrstuvwxyz1234567890"));
        assert.ok(!result.text.includes("synthetic-private-key-material"));
        assert.ok(!result.text.includes("dev@example.com"));
    });

    it("preserves ordinary implementation code and redacts credential assignments", () => {
        const result = sanitizeModelText([
            "const token = validateToken(input);",
            "const isValid = verifyBearerToken(token);",
            "const apiKey = process.env.API_KEY;",
            "const apiKey = 'synthetic-secret-value';",
        ].join("\n"));

        assert.ok(result.text.includes("const token = validateToken(input);"));
        assert.ok(result.text.includes("verifyBearerToken(token)"));
        assert.ok(result.text.includes("const apiKey = process.env.API_KEY;"));
        assert.ok(!result.text.includes("synthetic-secret-value"));
    });

    it("replaces unterminated private-key material and marks it unsafe", () => {
        const result = sanitizeModelText("prefix\n-----BEGIN RSA PRIVATE KEY-----\nsynthetic-secret-tail");

        assert.equal(result.unsafe, true);
        assert.ok(result.text.startsWith("prefix\n"));
        assert.ok(!result.text.includes("synthetic-secret-tail"));
        assert.ok(result.text.includes("PRIVATE KEY MATERIAL"));
    });
});
