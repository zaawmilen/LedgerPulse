import { PoolClient } from "pg";
import { withTransaction } from "../db/pool";
import { sumScaled } from "../domain/money";
import { PostTransactionInput, PostedTransaction } from "../domain/types";
import { EmptyTransactionError, UnbalancedTransactionError } from "./errors";

/**
 * Atomically posts a balanced double-entry ledger transaction.
 *
 * Conceptual flow (docs/architecture/ledger-posting.md):
 *   1. Validate the entry set is non-empty and balanced (I1).
 *   2. Acquire row locks on every referenced account, in a deterministic
 *      (sorted) order, so two concurrent postings against overlapping
 *      accounts can never deadlock each other.
 *   3. Insert the transaction header, then each entry.
 *   4. (Week 5) Insert the outbox event in the same transaction.
 *   5. Commit. Posted entries are never updated (I2) — corrections are new
 *      reversal transactions.
 */
export async function postTransaction(
  input: PostTransactionInput
): Promise<PostedTransaction> {
  if (input.entries.length < 2) {
    throw new EmptyTransactionError();
  }

  const debits = input.entries
    .filter((e) => e.direction === "debit")
    .map((e) => e.amount);
  const credits = input.entries
    .filter((e) => e.direction === "credit")
    .map((e) => e.amount);

  const debitTotal = sumScaled(debits);
  const creditTotal = sumScaled(credits);

  if (debitTotal !== creditTotal || debitTotal === 0n) {
    throw new UnbalancedTransactionError(
      debitTotal.toString(),
      creditTotal.toString()
    );
  }

  return withTransaction(async (client) => {
    await lockAccountsInOrder(client, input.entries.map((e) => e.accountId));

    const txResult = await client.query(
      `INSERT INTO ledger_transactions
         (tenant_id, type, reference, reverses_transaction_id, currency)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING transaction_id, tenant_id, type, currency, posted_at`,
      [
        input.tenantId,
        input.type,
        input.reference ?? null,
        input.reversesTransactionId ?? null,
        input.currency,
      ]
    );
    const tx = txResult.rows[0];

    const entries = [];
    for (const entry of input.entries) {
      const entryResult = await client.query(
        `INSERT INTO ledger_entries
           (transaction_id, account_id, direction, amount, currency)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING entry_id`,
        [
          tx.transaction_id,
          entry.accountId,
          entry.direction,
          entry.amount,
          entry.currency,
        ]
      );
      entries.push({ ...entry, entryId: entryResult.rows[0].entry_id });
    }

    // TODO(Week 5): insert the matching outbox_events row here, in this same
    // transaction, so the ledger write and the event are atomic (ADR-006).

    return {
      transactionId: tx.transaction_id,
      tenantId: tx.tenant_id,
      type: tx.type,
      currency: tx.currency,
      postedAt: tx.posted_at,
      entries,
    };
  });
}

/**
 * Locks accounts in a stable, sorted order so that two transactions
 * touching the same set of accounts always request locks in the same
 * sequence — the standard way to make SELECT ... FOR UPDATE deadlock-free.
 */
async function lockAccountsInOrder(
  client: PoolClient,
  accountIds: string[]
): Promise<void> {
  const uniqueSorted = [...new Set(accountIds)].sort();
  await client.query(
    `SELECT account_id FROM accounts
     WHERE account_id = ANY($1::uuid[])
     ORDER BY account_id
     FOR UPDATE`,
    [uniqueSorted]
  );
}
