-- Cashflow is now called Spending (ACCT-1.7).
ALTER TABLE "finance"."accounts" RENAME COLUMN "hide_from_cashflow" TO "hide_from_spending";
