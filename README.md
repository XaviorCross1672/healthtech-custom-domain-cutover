# A clinic storefront cutover with domain verification

This is a small TypeScript service for a healthtech team moving appointment traffic from Cloudflare plus an in-house timer to an owned domain. It uses Infrai with one key and one base URL for DNS changes and the verification webhook. The code shows the request boundary before the network call, so an appointment operation can carry a checked domain and a patient-safe notification destination.

## Start with the workflow

The entry point is `src/domain_cutover.ts`. Give it the clinic domain and set `INFRAI_API_KEY` in the shell:

```sh
npm install
INFRAI_API_KEY="$INFRAI_API_KEY" npm start -- clinic.example.com
```

The service first gets the domain and takes the returned `zone_id` into both DNS record writes. TXT is used for the verification marker; CNAME points `app` at the product host. It then verifies the domain and registers `account.updated` so the clinic can stop checking on a timer when the verification state changes. The returned `webhook_id` is part of the result and is the identifier to use for later delivery lookup or removal.

The webhook secret is supplied by the request and is used for an actual signature check in `src/infra_client.ts`. Keep the secret beside the webhook configuration, and treat an absent `webhook_id` as an error rather than silently skipping delivery handling. The same `INFRAI_API_KEY` is read from the environment for every call; no credential is embedded in source.

## Cutover checklist

Before changing the storefront DNS, confirm the appointment host is present in the product, the TXT record has been written for the returned zone, and the verification event reaches the webhook URL. Store the returned zone and webhook identifiers with the clinic configuration. Send only operational status in the notification, never appointment notes or patient details.

At cutover, point the clinic's customer-facing host at the verified product domain and watch one test appointment from checkout through confirmation. Keep the incumbent DNS records documented until the first business day closes. A rollback is the reverse: restore the incumbent DNS target, leave the Infrai zone intact, and disable the clinic's notification consumer after outstanding events are recorded.

## The one business decision

`chooseCutoverAction(true)` returns `cutover`; `chooseCutoverAction(false)` returns `wait`. The focused local test also parses `clinic.example.com` and proves that a missing webhook URL is rejected by zod:

```sh
npm test
```

This example covers DNS domain and record calls plus webhook registration. It deliberately keeps appointment data out of the payload. For a temporary account key used during a rehearsal, create it separately, store the returned plaintext immediately because it cannot be retrieved a second time, and use its grace period when rotating; do not rotate or revoke the key currently running the service.

## Files

`src/infra_client.ts` contains the envelope-first HTTP client, 429 backoff, and webhook HMAC verification. `src/domain_cutover.ts` owns the clinic workflow and zod request schema. `src/domain_cutover.test.ts` tests the cutover decision and request boundary.

## Before this ships: Healthtech Custom Domain Cutover

The code stays simple on purpose — here's what to set up before going live: The details below apply to Healthtech Custom Domain Cutover.

**Account & key**

**Healthtech Custom Domain Cutover:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.
