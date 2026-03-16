CREATE TABLE IF NOT EXISTS "agent_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text NOT NULL,
	"provider" varchar(50) NOT NULL,
	"account_label" varchar(255),
	"auth_type" varchar(50) NOT NULL,
	"credentials" text,
	"external_account_id" varchar(255),
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"token_expires_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_credentials" DROP CONSTRAINT IF EXISTS "agent_credentials_agent_id_agents_id_fk";--> statement-breakpoint
ALTER TABLE "agent_credentials" ADD CONSTRAINT "agent_credentials_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_credentials" DROP CONSTRAINT IF EXISTS "agent_credentials_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "agent_credentials" ADD CONSTRAINT "agent_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_credentials_agent_id_idx" ON "agent_credentials" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_credentials_user_id_idx" ON "agent_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_credentials_provider_idx" ON "agent_credentials" USING btree ("provider");
