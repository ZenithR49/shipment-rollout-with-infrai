import assert from "node:assert/strict";
import { decideShipment } from "./shipment_service.ts";

const delivered = { shipmentId: "sh-100", event: "delivered" as const, proofOfDelivery: { name: "signed-receipt.pdf", contentType: "application/pdf" } };
assert.equal(decideShipment(delivered, true).accepted, true);
assert.equal(decideShipment({ shipmentId: "sh-100", event: "delivered" }, true).reason, "proof of delivery is required");
assert.equal(decideShipment(delivered, false).accepted, false);
console.log("shipment decision test passed");
