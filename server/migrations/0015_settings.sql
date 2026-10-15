CREATE TABLE "core"."settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"show_retirement_group" boolean DEFAULT true NOT NULL,
	CONSTRAINT "settings_single_row" CHECK ("core"."settings"."id" = 1)
);
