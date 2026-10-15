ALTER TABLE "finance"."transactions" DROP CONSTRAINT "transactions_split_parent_id_transactions_id_fk";
--> statement-breakpoint
ALTER TABLE "finance"."transactions" DROP COLUMN "is_split";--> statement-breakpoint
ALTER TABLE "finance"."transactions" DROP COLUMN "split_parent_id";--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD COLUMN "split_id" varchar(50);--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD COLUMN "split_position" integer;--> statement-breakpoint
CREATE INDEX "transactions_split_id_idx" ON "finance"."transactions" USING btree ("split_id");