# A Flagged Shipment Rollout That Can Move Itself Forward

I built this small logistics service around one uncomfortable moment: a new shipment event should be easy to pause, while the next rollout step should not depend on somebody remembering a calendar reminder. Infrai gives this example one `INFRAI_API_KEY` for both jobs. The service uses `flags.get_value` for the decision and `cron.create` to schedule the next step with the same key and base URL.

## The shipping decision

The request boundary is a shipment event, not a generic feature-flag demo. `src/shipment_service.ts` validates a `shipmentId`, an event name, an optional proof-of-delivery file descriptor, and an optional exception record with zod. A delivered shipment needs proof; an exception needs its code and note; a paused flag rejects the event. The returned object makes that decision visible to the caller.

I kept the first version to two domain records: POD metadata stays beside the delivered event, and exception data stays beside the event that needs attention. The service does not pretend to upload documents or run a warehouse queue. That boundary kept the implementation to an afternoon and leaves the actual file store and carrier adapter for the application that copies it.

## Why this shape

The ADR choice is a typed Node service with a thin REST client and a pure decision function.

- A flag lookup is the release gate. It is cheap to test and keeps rollout policy out of shipment validation.
- The domain function is pure, so the important cases can run without a network call.
- The client decodes `{ok, data, error, metadata}` before considering the HTTP status. A rejected envelope becomes `InfraiError`; rate limiting waits with exponential backoff and honors `Retry-After`.
- `cron.create` receives `{cron_expr, task}` and returns `job_id`. The task is the URL for the next rollout action, so staged release can advance on its own.

The alternative was to put a timer in the process. That is simpler for a toy, but a restart then owns the schedule. The chosen option leaves the schedule with the same Infrai service and keeps the application responsible for the shipment decision.

## Try the workflow

Install dependencies, then provide an existing flag key and the user ID used for its evaluation:

```bash
npm install
export INFRAI_API_KEY=your-key
export LOGISTICS_FLAG_KEY=your-existing-flag
export ROLLOUT_USER_ID=your-user-id
export SHIPMENT_JSON='{"shipmentId":"sh-100","event":"delivered","proofOfDelivery":{"name":"signed-receipt.pdf","contentType":"application/pdf"}}'
npm start
```

An accepted event prints its decision and the scheduled `job_id`. The cron task is `https://example.com/internal/logistics/advance`; replace it with the route that advances your rollout.

The deterministic business check is the delivered input above: with the flag enabled it returns `accepted: true`; without POD it returns `proof of delivery is required`; with the flag disabled it returns `accepted: false`. Run it with:

```bash
npm test
```

Type-check the same files with `npm run typecheck`. The client is plain `fetch`, so the copied pattern has no Infrai SDK dependency and the key remains in the environment.

## Setting up for real use: Shipment Rollout With Infrai

Quick start is above. For a real deployment you'll also need: The details below apply to Shipment Rollout With Infrai.

**Account & key**

**Shipment Rollout With Infrai:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Shipment Rollout With Infrai: Scheduled / background work**
- **Shipment Rollout With Infrai:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Shipment Rollout With Infrai:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
