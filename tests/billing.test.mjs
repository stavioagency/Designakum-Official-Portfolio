import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Checkout once sent PayPal's return straight to the billing page, so the route
 * that actually records the subscription never ran: the customer paid, saw
 * "success", and stayed on the free plan until a webhook rescued them — or
 * forever, if no webhook was configured. This pins the wiring.
 */
describe("checkout returns through the route that records it", () => {
  const source = (relative) =>
    fs.readFileSync(path.join(import.meta.dirname, "..", relative), "utf8");

  test("the success URL is the provider's return route, not the billing page", () => {
    const action = source("src/app/actions/billing.ts");
    const successUrl = action.match(/successUrl:\s*`([^`]+)`/)?.[1];

    assert.ok(successUrl, "startCheckoutAction should set a successUrl");
    assert.ok(
      successUrl.includes("/api/billing/paypal/return"),
      `success URL must hit the return route, got: ${successUrl}`,
    );
    assert.ok(
      !successUrl.includes("/dashboard/billing"),
      "returning straight to the billing page skips recording the subscription",
    );
  });

  test("the return route verifies ownership before recording anything", () => {
    const route = source("src/app/api/billing/paypal/return/route.ts");

    assert.match(
      route,
      /custom_id\s*!==\s*user\.id/,
      "the route must check the subscription belongs to the signed-in user",
    );
    // Compare against the call, not the import list at the top of the file.
    assert.ok(
      route.indexOf("custom_id") < route.indexOf("await recordSubscription("),
      "the ownership check has to come before the write",
    );
    assert.match(
      route,
      /getSubscription\(subscriptionId\)/,
      "status must be re-read from PayPal, never trusted from the query string",
    );
  });

  test("the webhook is still the authoritative path", () => {
    const webhook = source("src/app/api/billing/paypal/webhook/route.ts");
    assert.match(webhook, /verifyWebhook/, "every event must be signature-verified");
    for (const event of [
      "BILLING.SUBSCRIPTION.ACTIVATED",
      "BILLING.SUBSCRIPTION.CANCELLED",
      "BILLING.SUBSCRIPTION.EXPIRED",
      "BILLING.SUBSCRIPTION.SUSPENDED",
    ]) {
      assert.ok(webhook.includes(event), `webhook does not handle ${event}`);
    }
  });
});
