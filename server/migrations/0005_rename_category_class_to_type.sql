-- A category group's class is now called its type (CAT-1.1).
ALTER TABLE "finance"."category_groups" RENAME COLUMN "category_class" TO "category_type";--> statement-breakpoint
ALTER TABLE "finance"."category_groups" RENAME CONSTRAINT "category_groups_category_class_check" TO "category_groups_category_type_check";
