-- Accounts are manual until they're linked to a bank connection (ACCT-4.3). None can be linked yet, so every account
-- is manual, including those the seed script and older versions saved as not.
ALTER TABLE "finance"."accounts" ALTER COLUMN "is_manual" SET DEFAULT true;--> statement-breakpoint
UPDATE "finance"."accounts" SET "is_manual" = true;--> statement-breakpoint
-- Every existing balance entry was entered or imported, so it's a set entry (ACCT-5.1).
ALTER TABLE "finance"."balance_history" ADD COLUMN "source" varchar(20) DEFAULT 'set' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."balance_history" ADD CONSTRAINT "balance_history_source_check" CHECK ("finance"."balance_history"."source" IN ('set', 'adjusted'));
