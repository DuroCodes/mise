CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`amount` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ingredients_recipe_idx` ON `ingredients` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `instructions` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `instructions_recipe_idx` ON `instructions` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipe_tags` (
	`recipe_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `tag_id`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_tags_tag_idx` ON `recipe_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image` text,
	`prep_minutes` integer,
	`cook_minutes` integer,
	`servings` integer,
	`favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);