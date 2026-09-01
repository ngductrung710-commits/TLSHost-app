-- Row-level security for plan_purchase.
--
-- Prisma writes the table; it does not write the policy, so a new table
-- arrives readable by every organization until this runs. A purchase row
-- carries what an organization paid and when — not a secret exactly, but
-- nobody else's business, and the isolation has to be a property of the table
-- rather than of every query someone remembers to scope.
--
-- Same shape as every other tenant table: see 20260828001700_payments.

ALTER TABLE "plan_purchase" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_purchase_org_isolation" ON "plan_purchase"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));
