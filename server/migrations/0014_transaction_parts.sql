CREATE TABLE "finance"."transaction_parts" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transaction_id" varchar(50) NOT NULL,
	"position" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"category_id" varchar(50),
	"merchant" varchar(255) NOT NULL,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "finance"."transactions" DROP CONSTRAINT "transactions_split_parent_id_transactions_id_fk";
--> statement-breakpoint
ALTER TABLE "finance"."transaction_parts" ADD CONSTRAINT "transaction_parts_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transaction_parts" ADD CONSTRAINT "transaction_parts_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "finance"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_parts_transaction_id_position_unique_idx" ON "finance"."transaction_parts" USING btree ("transaction_id","position");--> statement-breakpoint
CREATE INDEX "transaction_parts_category_id_idx" ON "finance"."transaction_parts" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "finance"."transactions" DROP COLUMN "is_split";--> statement-breakpoint
ALTER TABLE "finance"."transactions" DROP COLUMN "split_parent_id";