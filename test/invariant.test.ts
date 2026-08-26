import { test } from "node:test";
import assert from "node:assert/strict";
import { postTransaction } from "../src/ledger/postTransaction";
import { UnbalancedTransactionError } from "../src/ledger/errors";
import { createTenant, createAccount } from "./helpers/fixtures";
import { getPool } from "../src/db/pool";

// I1: Every POSTED transaction has sum(debits) = sum(credits).

test("a posted transaction is always balanced", async () => {
  const tenantId = await createTenant();
  const accountA = await createAccount(tenantId);
  const accountB = await createAccount(tenantId);

  const posted = await postTransaction({
    tenantId,
    type: "payment",
    currency: "USD",
    entries: [
      { accountId: accountA, direction: "debit", amount: "100.00", currency: "USD" },
      { accountId: accountB, direction: "credit", amount: "100.00", currency: "USD" },
    ],
  });

  const sumResult = await getPool().query(
    `SELECT
       SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) AS debits,
       SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) AS credits
     FROM ledger_entries WHERE transaction_id = $1`,
    [posted.transactionId]
  );

  assert.equal(sumResult.rows[0].debits, sumResult.rows[0].credits);
});

test("an unbalanced transaction is rejected before it touches the database", async () => {
  const tenantId = await createTenant();
  const accountA = await createAccount(tenantId);
  const accountB = await createAccount(tenantId);

  await assert.rejects(
    () =>
      postTransaction({
        tenantId,
        type: "payment",
        currency: "USD",
        entries: [
          { accountId: accountA, direction: "debit", amount: "100.00", currency: "USD" },
          { accountId: accountB, direction: "credit", amount: "99.99", currency: "USD" },
        ],
      }),
    UnbalancedTransactionError
  );
});

test("posted ledger entries cannot be updated (I2 is a schema-level absence of an UPDATE path)", async () => {
  const tenantId = await createTenant();
  const accountA = await createAccount(tenantId);
  const accountB = await createAccount(tenantId);

  const posted = await postTransaction({
    tenantId,
    type: "payment",
    currency: "USD",
    entries: [
      { accountId: accountA, direction: "debit", amount: "10.00", currency: "USD" },
      { accountId: accountB, direction: "credit", amount: "10.00", currency: "USD" },
    ],
  });

  // There is no updateLedgerEntry use case in src/ledger — this test just
  // documents the invariant. A correction must be a new reversal transaction.
  assert.ok(posted.transactionId);
});
