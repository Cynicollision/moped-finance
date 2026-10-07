ALTER TABLE "finance"."accounts" DROP CONSTRAINT "accounts_account_category_check";--> statement-breakpoint
ALTER TABLE "finance"."accounts" DROP CONSTRAINT "accounts_account_group_check";--> statement-breakpoint
ALTER TABLE "finance"."accounts" DROP CONSTRAINT "accounts_account_type_check";--> statement-breakpoint
-- The type alone now decides the group and Asset/Liability (ACCT-1.2), so it's required and the other two columns go.
-- The stored group wins: a type that isn't one of its group's (including none, as credit cards had) becomes the group's
-- Other type. Retirement is a group now rather than a flag, so a flagged investment that isn't a 401(k) or IRA becomes
-- Other Retirement.
UPDATE "finance"."accounts" SET "account_type" = CASE
  WHEN "account_group" = 'Cash' AND "account_type" IN ('Checking', 'Savings') THEN "account_type"
  WHEN "account_group" = 'Cash' THEN 'Other Cash'
  WHEN "account_group" = 'Investment' AND "account_type" = '401k' THEN '401(k)'
  WHEN "account_group" = 'Investment' AND "account_type" = 'IRA' THEN 'IRA'
  WHEN "account_group" = 'Investment' AND "is_retirement" THEN 'Other Retirement'
  WHEN "account_group" = 'Investment' AND "account_type" IN ('Brokerage', 'HSA') THEN "account_type"
  WHEN "account_group" = 'Investment' THEN 'Other Investment'
  WHEN "account_group" = 'Real Estate' AND "account_type" = 'Primary Residence' THEN 'Primary Residence'
  WHEN "account_group" = 'Real Estate' THEN 'Other Property'
  WHEN "account_group" = 'Credit Card' THEN 'Credit Card'
  WHEN "account_type" = 'Home Mortgage' THEN 'Mortgage'
  ELSE 'Other Loan'
END;
--> statement-breakpoint
ALTER TABLE "finance"."accounts" ALTER COLUMN "account_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."accounts" DROP COLUMN "account_category";--> statement-breakpoint
ALTER TABLE "finance"."accounts" DROP COLUMN "account_group";--> statement-breakpoint
ALTER TABLE "finance"."accounts" DROP COLUMN "is_retirement";--> statement-breakpoint
ALTER TABLE "finance"."accounts" ADD CONSTRAINT "accounts_account_type_check" CHECK ("finance"."accounts"."account_type" IN ('Checking', 'Savings', 'Money Market', 'CD', 'Other Cash', 'Brokerage', 'HSA', '529', 'Other Investment', '401(k)', 'IRA', 'Roth IRA', 'Other Retirement', 'Primary Residence', 'Rental Property', 'Other Property', 'Vehicle', 'Other Asset', 'Credit Card', 'Mortgage', 'HELOC', 'Auto Loan', 'Student Loan', 'Personal Loan', 'Other Loan'));