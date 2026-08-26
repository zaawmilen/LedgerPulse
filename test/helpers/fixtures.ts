import { getPool } from "../../src/db/pool";

export async function createTenant(): Promise<string> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO tenants (name) VALUES ($1) RETURNING tenant_id`,
    [`test-tenant-${Date.now()}-${Math.random().toString(36).slice(2)}`]
  );
  return result.rows[0].tenant_id;
}

export async function createAccount(
  tenantId: string,
  currency = "USD"
): Promise<string> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO accounts (tenant_id, currency) VALUES ($1, $2) RETURNING account_id`,
    [tenantId, currency]
  );
  return result.rows[0].account_id;
}

/** Funds an account by posting a balanced transaction against a throwaway
 * external-funding account, so tests never insert unbalanced ledger rows. */
export async function fundAccount(
  tenantId: string,
  accountId: string,
  amount: string,
  currency = "USD"
): Promise<void> {
  const { postTransaction } = await import("../../src/ledger/postTransaction");
  const fundingAccountId = await createAccount(tenantId, currency);
  await postTransaction({
    tenantId,
    type: "payment",
    currency,
    entries: [
      { accountId: fundingAccountId, direction: "debit", amount, currency },
      { accountId, direction: "credit", amount, currency },
    ],
  });
}
