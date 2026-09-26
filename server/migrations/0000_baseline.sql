CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "finance";
--> statement-breakpoint
CREATE TABLE "core"."users" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"username" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "core"."logs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"level" varchar(50) NOT NULL,
	"context" varchar(255) NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."accounts" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"institution_id" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"account_category" varchar(50) NOT NULL,
	"account_group" varchar(50) NOT NULL,
	"account_type" varchar(50),
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"is_retirement" boolean DEFAULT false NOT NULL,
	"hide_from_cashflow" boolean DEFAULT false NOT NULL,
	CONSTRAINT "accounts_account_category_check" CHECK ("finance"."accounts"."account_category" IN ('Asset', 'Liability')),
	CONSTRAINT "accounts_account_group_check" CHECK ("finance"."accounts"."account_group" IN ('Cash', 'Credit Card', 'Investment', 'Real Estate', 'Loan')),
	CONSTRAINT "accounts_account_type_check" CHECK ("finance"."accounts"."account_type" IN ('Brokerage', 'Checking', 'HSA', 'Primary Residence', '401k', 'IRA', 'Savings', 'Home Mortgage'))
);
--> statement-breakpoint
CREATE TABLE "finance"."balance_history" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"date" date NOT NULL,
	"balance" numeric(12, 2) NOT NULL,
	CONSTRAINT "balance_history_account_id_date_unique" UNIQUE("account_id","date")
);
--> statement-breakpoint
CREATE TABLE "finance"."budget_streams" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" varchar(100) NOT NULL,
	"category_id" varchar(50),
	"type" varchar(50) NOT NULL,
	"recurrence" varchar(50) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	CONSTRAINT "budget_streams_type_check" CHECK ("finance"."budget_streams"."type" IN ('income', 'expense')),
	CONSTRAINT "budget_streams_recurrence_check" CHECK ("finance"."budget_streams"."recurrence" IN ('Monthly', 'Quarterly', 'Yearly'))
);
--> statement-breakpoint
CREATE TABLE "finance"."category_groups" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category_class" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	CONSTRAINT "category_groups_category_class_check" CHECK ("finance"."category_groups"."category_class" IN ('income', 'expense', 'transfer'))
);
--> statement-breakpoint
CREATE TABLE "finance"."categories" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"group_id" varchar(50) NOT NULL,
	"icon" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."institutions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance"."transactions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" varchar(50) NOT NULL,
	"category_id" varchar(50),
	"date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"merchant" varchar(255) NOT NULL,
	"original_statement" text,
	"notes" text,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_split" boolean DEFAULT false NOT NULL,
	"split_parent_id" varchar(50)
);
--> statement-breakpoint
ALTER TABLE "finance"."accounts" ADD CONSTRAINT "accounts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "finance"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."balance_history" ADD CONSTRAINT "balance_history_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "finance"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."budget_streams" ADD CONSTRAINT "budget_streams_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "finance"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."categories" ADD CONSTRAINT "categories_group_id_category_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "finance"."category_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "finance"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "finance"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_split_parent_id_transactions_id_fk" FOREIGN KEY ("split_parent_id") REFERENCES "finance"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_institution_id_idx" ON "finance"."accounts" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "balance_history_date_idx" ON "finance"."balance_history" USING btree ("date");--> statement-breakpoint
CREATE INDEX "budget_streams_category_id_idx" ON "finance"."budget_streams" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "category_groups_name_unique_idx" ON "finance"."category_groups" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "categories_name_unique_idx" ON "finance"."categories" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "categories_group_id_idx" ON "finance"."categories" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institutions_name_unique_idx" ON "finance"."institutions" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "finance"."transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transactions_account_id_date_idx" ON "finance"."transactions" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "transactions_category_id_idx" ON "finance"."transactions" USING btree ("category_id");