-- ============================================================================
--  WhatsApp checkout payment method + competitor price comparison platforms
--  Written 2026-09-08. NOT APPLIED — the owner runs this.
--
--  Apply with either:
--     psql "$DATABASE_URL" -f docs/migrations/2026-09-08-whatsapp-checkout-and-comparisons.sql
--  or by pasting it into the Supabase SQL editor.
--
--  Use the POOLER connection string, not the direct one — the direct host is
--  IPv6-only and is not reachable from Lambda or from a Windows dev machine.
--  See AGENTS.md for the current pooler URL.
--
--  This script is idempotent: every statement is IF NOT EXISTS / guarded, so
--  running it twice is harmless.
--
--  AFTER APPLYING: run `npx prisma generate` in backend/ so the client knows
--  about the new enum value, column and model, then redeploy the Lambda.
--  Deploying the code that USES these before applying this migration will 500
--  on checkout and on any comparisons read/write.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. WhatsApp as a payment method
--
-- Razorpay has been removed from the app entirely (see the PR that shipped
-- alongside this migration). Checkout now offers Cash on Delivery and a
-- WhatsApp handoff — the buyer's order is created and reserved exactly like
-- COD, but payment is arranged over WhatsApp instead of collected on
-- delivery. `online`/`card`/`upi`/`bank_transfer` are left in the enum
-- because historical orders still carry those values; nothing new will be
-- created with them going forward.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a multi-statement transaction
-- alongside code that uses the new value, but this script never references
-- 'whatsapp' in a later statement, so running it standalone (as psql -f does,
-- one statement at a time) is safe.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'whatsapp';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Competitor price comparison
--
-- ComparisonPlatform is an admin-managed reference list (eBay, Chrono24, ...,
-- extensible from the admin dashboard). Product.comparisons is a small Json
-- array of {platformId, url, price} set by the seller (optional) or
-- overwritten by an admin — same treatment as the existing Product.specs
-- column, not a relational join table, since a product never has more than a
-- handful of these and nothing needs to query across them.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "comparisons" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS "ComparisonPlatform" (
  "id"        TEXT    NOT NULL,
  "name"      TEXT    NOT NULL,
  "logoUrl"   TEXT,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ComparisonPlatform_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComparisonPlatform_name_key'
  ) THEN
    ALTER TABLE "ComparisonPlatform" ADD CONSTRAINT "ComparisonPlatform_name_key" UNIQUE ("name");
  END IF;
END
$$;

-- Seed the three platforms named when this was requested. "HC" is exactly
-- what was asked for verbally and its real name/URL were not confirmed —
-- rename it (and add its logo) from the new admin "Comparison Platforms"
-- page once known, rather than guessing here.
INSERT INTO "ComparisonPlatform" ("id", "name", "sortOrder", "updatedAt")
SELECT 'cmp_ebay', 'eBay', 0, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ComparisonPlatform" WHERE "name" = 'eBay');

INSERT INTO "ComparisonPlatform" ("id", "name", "sortOrder", "updatedAt")
SELECT 'cmp_chrono24', 'Chrono24', 1, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ComparisonPlatform" WHERE "name" = 'Chrono24');

INSERT INTO "ComparisonPlatform" ("id", "name", "sortOrder", "updatedAt")
SELECT 'cmp_hc', 'HC', 2, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ComparisonPlatform" WHERE "name" = 'HC');


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Row Level Security
--
-- Every other table in this schema is reached only through the Fastify
-- backend using a direct Postgres connection, which bypasses RLS. But the
-- Supabase anon key is public (it ships in the JS bundle), so PostgREST
-- exposes each table by default. RLS with no permissive policy is what keeps
-- that shut — see the same treatment already applied to OutboundMessage.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "ComparisonPlatform" ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- Verification — run these after applying.
-- ─────────────────────────────────────────────────────────────────────────────

-- Expect 'whatsapp' in the list:
-- SELECT unnest(enum_range(NULL::"PaymentMethod"));

-- Expect one row, data_type = jsonb:
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'Product' AND column_name = 'comparisons';

-- Expect three rows (eBay, Chrono24, HC):
-- SELECT id, name, active, "sortOrder" FROM "ComparisonPlatform" ORDER BY "sortOrder";

-- Expect rowsecurity = true:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'ComparisonPlatform';

-- Expect 0 — no policy should exist for this table:
-- SELECT count(*) FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'ComparisonPlatform';
