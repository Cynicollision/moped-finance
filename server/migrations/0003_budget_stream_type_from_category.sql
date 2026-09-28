ALTER TABLE "finance"."budget_streams" DROP CONSTRAINT "budget_streams_type_check";--> statement-breakpoint
ALTER TABLE "finance"."budget_streams" DROP CONSTRAINT "budget_streams_category_id_categories_id_fk";
--> statement-breakpoint
-- A stream whose category was deleted has no type (BUD-1.1) and can't be shown, so it goes.
DELETE FROM "finance"."budget_streams" WHERE "category_id" IS NULL;--> statement-breakpoint
ALTER TABLE "finance"."budget_streams" ALTER COLUMN "category_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "finance"."budget_streams" ADD CONSTRAINT "budget_streams_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "finance"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."budget_streams" DROP COLUMN "type";