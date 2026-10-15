CREATE TABLE "core"."settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"value" jsonb NOT NULL
);
