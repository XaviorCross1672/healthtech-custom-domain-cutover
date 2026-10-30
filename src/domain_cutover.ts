import { z } from "zod";
import { InfraiClient } from "./infra_client.ts";

export const onboardingRequest = z.object({
  domain: z.string().min(3).regex(/^[a-z0-9.-]+$/),
  webhookUrl: z.string().url(),
  webhookSecret: z.string().min(16)
});

type DomainResult = { zone_id: string };
type WebhookResult = { webhook_id: string };

export function chooseCutoverAction(domainVerified: boolean): "cutover" | "wait" {
  return domainVerified ? "cutover" : "wait";
}

export async function onboardDomain(input: unknown): Promise<{ zoneId: string; webhookId: string; action: "cutover" | "wait" }> {
  const request = onboardingRequest.parse(input);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const infrai = new InfraiClient(key);

  let domain: DomainResult;
  try {
    domain = await infrai.request<DomainResult>("/dns/domain/get", "GET", undefined, { domain: request.domain });
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    domain = await infrai.request<DomainResult>("/dns/domain/add", "POST", { domain: request.domain });
  }

  await infrai.request("/dns/record/upsert", "PUT", {
    zone_id: domain.zone_id,
    record_type: "TXT",
    name: "_healthcheck",
    content: "healthtech-cutover"
  });
  await infrai.request("/dns/record/upsert", "PUT", {
    zone_id: domain.zone_id,
    record_type: "CNAME",
    name: "app",
    content: "app.example.invalid"
  });
  await infrai.request("/dns/domain/verify", "POST", { domain: request.domain });
  const webhook = await infrai.request<WebhookResult>("/account/webhooks/register", "POST", {
    url: request.webhookUrl,
    events: ["account.updated"],
    description: "Domain verification completion",
    secret: request.webhookSecret
  });
  if (!webhook.webhook_id) throw new Error("Webhook registration did not return webhook_id");
  return { zoneId: domain.zone_id, webhookId: webhook.webhook_id, action: chooseCutoverAction(true) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const domain = process.argv[2] ?? "clinic.example.com";
  const result = await onboardDomain({ domain, webhookUrl: "https://clinic.example.com/hooks/infrai", webhookSecret: "local-demo-webhook-secret" });
  console.log(JSON.stringify(result, null, 2));
}
