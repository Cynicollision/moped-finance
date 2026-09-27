CREATE TABLE "core"."api_tokens" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"access" varchar(20) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "api_tokens_access_check" CHECK ("core"."api_tokens"."access" IN ('ReadOnly', 'ReadWrite'))
);
--> statement-breakpoint
ALTER TABLE "core"."api_tokens" ADD CONSTRAINT "api_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "core"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_tokens_token_hash_unique_idx" ON "core"."api_tokens" USING btree ("token_hash");