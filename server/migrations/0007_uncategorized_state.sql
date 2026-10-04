-- Uncategorized is now the state of a transaction with no category (CAT-5), so a category of that name is redundant:
-- its transactions become uncategorized and it's deleted. One that a budget stream uses is kept, since a stream needs a
-- category; the user can move the stream and delete it.
UPDATE "finance"."transactions" SET "category_id" = NULL
WHERE "category_id" IN (SELECT "id" FROM "finance"."categories" WHERE lower(trim("name")) = 'uncategorized');
--> statement-breakpoint
DELETE FROM "finance"."categories" AS "c"
WHERE lower(trim("c"."name")) = 'uncategorized'
  AND NOT EXISTS (SELECT 1 FROM "finance"."budget_streams" AS "b" WHERE "b"."category_id" = "c"."id");
