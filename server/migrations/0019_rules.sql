CREATE TABLE "finance"."rule_actions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"rule_id" varchar(50) NOT NULL,
	"position" integer NOT NULL,
	"type" varchar(30) NOT NULL,
	"category_id" varchar(50),
	"text_value" varchar(255),
	CONSTRAINT "rule_actions_rule_id_type_unique" UNIQUE("rule_id","type"),
	CONSTRAINT "rule_actions_type_check" CHECK ("finance"."rule_actions"."type" IN ('set_category', 'rename_merchant'))
);
--> statement-breakpoint
CREATE TABLE "finance"."rule_conditions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"rule_id" varchar(50) NOT NULL,
	"position" integer NOT NULL,
	"field" varchar(30) NOT NULL,
	"operator" varchar(30) NOT NULL,
	"text_value" varchar(255),
	"amount_value" numeric(12, 2),
	"direction" varchar(10),
	"account_id" varchar(50),
	CONSTRAINT "rule_conditions_rule_id_field_unique" UNIQUE("rule_id","field"),
	CONSTRAINT "rule_conditions_field_check" CHECK ("finance"."rule_conditions"."field" IN ('original_statement', 'merchant', 'amount', 'account')),
	CONSTRAINT "rule_conditions_operator_check" CHECK ("finance"."rule_conditions"."operator" IN ('contains', 'equals', 'greater_than', 'less_than')),
	CONSTRAINT "rule_conditions_direction_check" CHECK ("finance"."rule_conditions"."direction" IN ('out', 'in'))
);
--> statement-breakpoint
CREATE TABLE "finance"."rules" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" varchar(100) NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD COLUMN "category_source" varchar(20);--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD COLUMN "category_rule_id" varchar(50);--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD COLUMN "merchant_rule_id" varchar(50);--> statement-breakpoint
ALTER TABLE "finance"."rule_actions" ADD CONSTRAINT "rule_actions_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "finance"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."rule_actions" ADD CONSTRAINT "rule_actions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "finance"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."rule_conditions" ADD CONSTRAINT "rule_conditions_rule_id_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "finance"."rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."rule_conditions" ADD CONSTRAINT "rule_conditions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "finance"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rule_actions_category_id_idx" ON "finance"."rule_actions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "rule_conditions_account_id_idx" ON "finance"."rule_conditions" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rules_name_unique_idx" ON "finance"."rules" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_category_rule_id_rules_id_fk" FOREIGN KEY ("category_rule_id") REFERENCES "finance"."rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_merchant_rule_id_rules_id_fk" FOREIGN KEY ("merchant_rule_id") REFERENCES "finance"."rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_category_source_check" CHECK ("finance"."transactions"."category_source" IN ('user', 'rule', 'learning'));--> statement-breakpoint
-- Existing categories were chosen by the user or given by an import file (CAT-8.6).
UPDATE "finance"."transactions" SET "category_source" = 'user' WHERE "category_id" IS NOT NULL;
