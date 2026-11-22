CREATE TABLE "simplefin"."transactions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"simplefin_account_id" varchar(50) NOT NULL,
	"simplefin_id" varchar(255) NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"transaction_id" varchar(50),
	CONSTRAINT "transactions_simplefin_account_id_simplefin_id_unique" UNIQUE("simplefin_account_id","simplefin_id"),
	CONSTRAINT "transactions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
ALTER TABLE "simplefin"."transactions" ADD CONSTRAINT "transactions_simplefin_account_id_accounts_id_fk" FOREIGN KEY ("simplefin_account_id") REFERENCES "simplefin"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simplefin"."transactions" ADD CONSTRAINT "transactions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."accounts" DROP COLUMN "is_manual";