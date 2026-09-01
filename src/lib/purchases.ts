import "server-only";

import { periodFor, priceFor, wouldShorten } from "@/lib/billing";
import { PLANS, type Plan } from "@/lib/plans";
import { vietQrPayload } from "@/lib/vietqr";

import type { PrismaClient } from "@prisma/client";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Creating a purchase, and applying one once the money has arrived.
 *
 * The two halves are deliberately far apart. Creating one is cheap and
 * anonymous — a row saying what a host intends to pay, which changes nothing —
 * and applying one moves their plan. Between them sits a human reading a bank
 * statement, and everything here is arranged so that the human can be wrong,
 * or double-click, or come back tomorrow and do it again, without anybody
 * getting two months for one transfer.
 */

/** Where the money goes. Ours, not a host's — see src/lib/payments.ts for those. */
export type BankAccount = {
  bin: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  /** Tag 60. Optional — a QR without one is better than one with a guess. */
  city: string | null;
};

/**
 * Read from the environment rather than the database.
 *
 * This is the account the product itself is paid into. It is not per-tenant,
 * it changes when a company changes banks and not otherwise, and putting it in
 * a table would invite a settings screen that lets somebody point our revenue
 * somewhere else.
 */
export function bankAccount(): BankAccount | null {
  const bin = process.env.TLSHOST_BANK_BIN;
  const accountNumber = process.env.TLSHOST_BANK_ACCOUNT;
  const accountName = process.env.TLSHOST_BANK_ACCOUNT_NAME;
  const bankName = process.env.TLSHOST_BANK_NAME;
  // All four or none. A QR built from three of them is a QR that scans into a
  // transfer nobody receives.
  if (!bin || !accountNumber || !accountName || !bankName) return null;
  return {
    bin,
    accountNumber,
    accountName,
    bankName,
    city: process.env.TLSHOST_BANK_CITY || null,
  };
}

const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * A memo a person can copy off a screen into a banking app.
 *
 * Random, not derived from the row's id. A derived reference needs a hash good
 * enough that two ids never collide, and a hash that is nearly good enough
 * looks exactly like one that is — the first attempt at this collided on 41%
 * of twenty thousand ids because the multiplier was smaller than the id's
 * alphabet. Random plus a unique column plus a retry has no such failure mode:
 * either the insert succeeds and the reference is unique, or it does not.
 *
 * O/0 and I/1 are left out. This string's whole job is to survive being typed
 * by someone glancing between two phones.
 */
function randomReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  let out = "TLS";
  for (const byte of bytes) out += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  return out;
}

export type CreatedPurchase = {
  id: string;
  reference: string;
  amount: number;
  plan: Plan;
};

/**
 * Open a purchase for one month of `plan`.
 *
 * Returns null when the organization already has that plan with no end date —
 * see wouldShorten(). Selling somebody a month that replaces their unlimited
 * grant is not a sale, it is a downgrade they paid for.
 */
export async function createPurchase(
  tx: Tx,
  orgId: string,
  plan: Exclude<Plan, "FREE">,
  current: { plan: Plan; planUntil: Date | null },
): Promise<CreatedPurchase | null> {
  if (wouldShorten(current.plan, current.planUntil)) return null;

  const amount = priceFor(PLANS[plan].price);

  // Retry on the unique constraint rather than checking first: a check and an
  // insert are two statements, and two tabs can pass the check together.
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = randomReference();
    try {
      const row = await tx.planPurchase.create({
        data: { orgId, plan, amount, months: 1, reference },
        select: { id: true, reference: true, amount: true, plan: true },
      });
      return row;
    } catch (error) {
      const code = (error as { code?: string }).code;
      // P2002 is Prisma's unique-constraint violation. Anything else is a real
      // failure and must not be retried into a loop.
      if (code !== "P2002") throw error;
    }
  }
  throw new Error("Could not allocate a unique payment reference after five tries.");
}

export type ApplyOutcome =
  | { ok: true; periodEnd: Date }
  | { ok: false; reason: "NOT_FOUND" | "ALREADY_SETTLED" };

/**
 * Confirm the money arrived, and extend the plan.
 *
 * Idempotent by construction rather than by remembering. Confirming twice, a
 * retried job and a double-clicked button all land in the same place.
 *
 * The period is computed from the organization's planUntil *inside* the
 * transaction, because the whole point of extending is that it depends on a
 * value this function is about to change.
 */
export async function applyPurchase(
  tx: Tx,
  purchaseId: string,
  now: Date = new Date(),
): Promise<ApplyOutcome> {
  // Claim the row first, before reading anything else.
  //
  // The order is the whole guard. Reading the status and then deciding is
  // check-then-act: two callers both read PENDING, both decide to go ahead,
  // and one transfer buys two months. A conditional update cannot be raced,
  // because Postgres locks the row — the second caller's UPDATE waits for the
  // first to commit and then matches nothing.
  //
  // The first draft of this read the status first and used the conditional
  // update as a second line of defence. Removing the condition then changed
  // nothing that any test could see, which is the same as not having it: the
  // read was doing the work, and the read is the part that does not hold under
  // load. So the claim comes first and everything else depends on having won
  // it.
  const claimed = await tx.planPurchase.updateMany({
    where: { id: purchaseId, status: "PENDING" },
    data: { status: "PAID", paidAt: now },
  });
  if (claimed.count === 0) {
    const exists = await tx.planPurchase.findUnique({
      where: { id: purchaseId },
      select: { id: true },
    });
    return { ok: false, reason: exists ? "ALREADY_SETTLED" : "NOT_FOUND" };
  }

  const purchase = await tx.planPurchase.findUniqueOrThrow({
    where: { id: purchaseId },
    select: { id: true, orgId: true, plan: true, months: true },
  });
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: purchase.orgId },
    select: { plan: true, planUntil: true },
  });

  // A plan change resets rather than extends: a month of PRO bought while a
  // week of CHANNELS remains is a month of PRO, not a week of one plus a month
  // of the other. Carrying the old end date forward would silently sell PRO at
  // the CHANNELS end date.
  const from = org.plan === purchase.plan ? org.planUntil : null;
  const period = periodFor(from, now, purchase.months);

  await tx.planPurchase.update({
    where: { id: purchase.id },
    data: { periodStart: period.start, periodEnd: period.end },
  });
  await tx.organization.update({
    where: { id: purchase.orgId },
    data: { plan: purchase.plan, planUntil: period.end },
  });

  return { ok: true, periodEnd: period.end };
}

/** The VietQR payload for a purchase, or null when no account is configured. */
export function qrPayloadFor(
  purchase: { reference: string; amount: number },
): string | null {
  const account = bankAccount();
  if (account === null) return null;
  return vietQrPayload({
    bankBin: account.bin,
    accountNumber: account.accountNumber,
    amount: purchase.amount,
    memo: purchase.reference,
    merchantName: account.accountName,
    merchantCity: account.city ?? undefined,
  });
}
