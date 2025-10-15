CREATE TYPE IF NOT EXISTS "public"."story_status" AS ENUM('draft', 'published', 'archived');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"order" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scenes" (
	"id" text PRIMARY KEY NOT NULL,
	"story_id" text NOT NULL,
	"chapter_id" text,
	"title" text NOT NULL,
	"content" text,
	"order" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_image" text,
	"status" "story_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT IF NOT EXISTS "chapters_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT IF NOT EXISTS "scenes_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scenes" ADD CONSTRAINT IF NOT EXISTS "scenes_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chapters_story_id_idx" ON "chapters" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chapters_order_idx" ON "chapters" USING btree ("story_id","order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scenes_story_id_idx" ON "scenes" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scenes_chapter_id_idx" ON "scenes" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scenes_order_idx" ON "scenes" USING btree ("story_id","chapter_id","order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stories_user_id_idx" ON "stories" USING btree ("user_id");