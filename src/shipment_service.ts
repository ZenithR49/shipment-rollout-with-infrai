import { z } from "zod";
import { InfraiClient } from "./infrai_client.ts";

export const shipmentRequest = z.object({
  shipmentId: z.string().min(1),
  event: z.enum(["picked_up", "in_transit", "delivered", "exception"]),
  proofOfDelivery: z.object({ name: z.string().min(1), contentType: z.string().min(1) }).optional(),
  exception: z.object({ code: z.string().min(1), note: z.string().min(1) }).optional()
});
export type ShipmentRequest = z.infer<typeof shipmentRequest>;

export type ShipmentDecision = { accepted: boolean; reason: string; shipmentId: string; event: ShipmentRequest["event"] };

export function decideShipment(input: ShipmentRequest, enabled: boolean): ShipmentDecision {
  if (!enabled) return { accepted: false, reason: "logistics rollout is paused", shipmentId: input.shipmentId, event: input.event };
  if (input.event === "delivered" && !input.proofOfDelivery) return { accepted: false, reason: "proof of delivery is required", shipmentId: input.shipmentId, event: input.event };
  if (input.event === "exception" && !input.exception) return { accepted: false, reason: "an exception record is required", shipmentId: input.shipmentId, event: input.event };
  return { accepted: true, reason: "shipment event recorded", shipmentId: input.shipmentId, event: input.event };
}

export async function runShipment(input: unknown, client: InfraiClient, flagKey: string, userId: string): Promise<ShipmentDecision> {
  const parsed = shipmentRequest.parse(input);
  const enabled = await client.getFlagValue(flagKey, userId);
  return decideShipment(parsed, enabled);
}

if (import.meta.main) {
  const flagKey = process.env.LOGISTICS_FLAG_KEY;
  const userId = process.env.ROLLOUT_USER_ID;
  const raw = process.env.SHIPMENT_JSON;
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey || !flagKey || !userId || !raw) throw new Error("Set INFRAI_API_KEY, LOGISTICS_FLAG_KEY, ROLLOUT_USER_ID, and SHIPMENT_JSON");
  const client = new InfraiClient(apiKey);
  const result = await runShipment(JSON.parse(raw), client, flagKey, userId);
  console.log(JSON.stringify(result));
  if (result.accepted) {
    const job = await client.scheduleStep("*/15 * * * *", "https://example.com/internal/logistics/advance");
    console.log(JSON.stringify({ scheduledJob: job.job_id, sharedCredential: "INFRAI_API_KEY" }));
  }
}
