CREATE SCHEMA "simplefin";
--> statement-breakpoint
CREATE TABLE "simplefin"."access" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"access_url" text NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	"schedule_minute" integer NOT NULL,
	"paused_reason" varchar(20),
	CONSTRAINT "access_schedule_minute_check" CHECK ("simplefin"."access"."schedule_minute" BETWEEN 0 AND 359),
	CONSTRAINT "access_paused_reason_check" CHECK ("simplefin"."access"."paused_reason" IN ('refused', 'payment', 'undecryptable'))
);
--> statement-breakpoint
CREATE TABLE "simplefin"."accounts" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"connection_id" varchar(50) NOT NULL,
	"simplefin_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"currency" varchar(500) NOT NULL,
	"balance" numeric(12, 2) NOT NULL,
	"available_balance" numeric(12, 2),
	"balance_date" timestamp with time zone NOT NULL,
	"missing_since" timestamp with time zone,
	"is_ignored" boolean DEFAULT false NOT NULL,
	"linked_account_id" varchar(50),
	"sync_from" date,
	CONSTRAINT "accounts_connection_id_simplefin_id_unique" UNIQUE("connection_id","simplefin_id"),
	CONSTRAINT "accounts_linked_account_id_unique" UNIQUE("linked_account_id")
);
--> statement-breakpoint
CREATE TABLE "simplefin"."connections" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"simplefin_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"org_id" varchar(255),
	"org_url" varchar(500),
	CONSTRAINT "connections_simplefin_id_unique" UNIQUE("simplefin_id")
);
--> statement-breakpoint
CREATE TABLE "simplefin"."sync_runs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"trigger" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"requested_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"accounts_updated" integer DEFAULT 0 NOT NULL,
	"transactions_added" integer DEFAULT 0 NOT NULL,
	"transactions_updated" integer DEFAULT 0 NOT NULL,
	"failure" text,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"response" jsonb,
	CONSTRAINT "sync_runs_trigger_check" CHECK ("simplefin"."sync_runs"."trigger" IN ('scheduled', 'manual', 'connect')),
	CONSTRAINT "sync_runs_status_check" CHECK ("simplefin"."sync_runs"."status" IN ('running', 'succeeded', 'failed', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "simplefin"."accounts" ADD CONSTRAINT "accounts_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "simplefin"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simplefin"."accounts" ADD CONSTRAINT "accounts_linked_account_id_accounts_id_fk" FOREIGN KEY ("linked_account_id") REFERENCES "finance"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_single_row_idx" ON "simplefin"."access" USING btree ((true));--> statement-breakpoint
CREATE UNIQUE INDEX "sync_runs_one_running_idx" ON "simplefin"."sync_runs" USING btree ("status") WHERE "simplefin"."sync_runs"."status" = 'running';--> statement-breakpoint
CREATE INDEX "sync_runs_started_at_idx" ON "simplefin"."sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "sync_runs_requested_at_idx" ON "simplefin"."sync_runs" USING btree ("requested_at");