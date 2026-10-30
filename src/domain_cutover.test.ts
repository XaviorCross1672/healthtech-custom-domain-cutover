import test from "node:test";
import assert from "node:assert/strict";
import { chooseCutoverAction, onboardingRequest } from "./domain_cutover.ts";

test("a verified domain is eligible for storefront cutover", () => {
  assert.equal(chooseCutoverAction(true), "cutover");
  assert.equal(chooseCutoverAction(false), "wait");
});

test("the request boundary accepts a clinic domain and rejects a missing webhook URL", () => {
  const parsed = onboardingRequest.parse({ domain: "clinic.example.com", webhookUrl: "https://clinic.example.com/hook", webhookSecret: "sixteen-character-secret" });
  assert.equal(parsed.domain, "clinic.example.com");
  assert.throws(() => onboardingRequest.parse({ domain: "clinic.example.com", webhookSecret: "sixteen-character-secret" }));
});
