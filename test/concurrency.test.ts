import { test } from "node:test";
import assert from "node:assert/strict";
import { createHold } from "../src/ledger/createHold";
import { InsufficientFundsError } from "../src/ledger/errors";
import { getBalance } from "../src/ledger/getBalance";
import { createTenant, createAccount, fundAccount } from "./helpers/fixtures";

// I4: A hold cannot exceed the account's available funds — including when
// two holds race concurrently for the same funds.

test("two simultaneous holds cannot together overspend an account", async () => {
  const tenantId = await createTenant();
  const accountId = await createAccount(tenantId);
  await fundAccount(tenantId, accountId, "100.00");

  // Both requests ask for 70.00 against a 100.00 balance — together that's
  // 140.00, which must not both succeed.
  const results = await Promise.allSettled([
    createHold({ accountId, amount: "70.00", reference: "req-a" }),
    createHold({ accountId, amount: "70.00", reference: "req-b" }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");

  assert.equal(fulfilled.length, 1, "exactly one concurrent hold should succeed");
  assert.equal(rejected.length, 1, "exactly one concurrent hold should be rejected");
  assert.ok(
    (rejected[0] as PromiseRejectedResult).reason instanceof InsufficientFundsError
  );

  const balance = await getBalance(accountId);
  assert.equal(balance.available, "30.0000");
});

test("two simultaneous holds that both fit are both accepted", async () => {
  const tenantId = await createTenant();
  const accountId = await createAccount(tenantId);
  await fundAccount(tenantId, accountId, "100.00");

  const results = await Promise.allSettled([
    createHold({ accountId, amount: "40.00", reference: "req-a" }),
    createHold({ accountId, amount: "40.00", reference: "req-b" }),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  assert.equal(fulfilled.length, 2);

  const balance = await getBalance(accountId);
  assert.equal(balance.available, "20.0000");
});
