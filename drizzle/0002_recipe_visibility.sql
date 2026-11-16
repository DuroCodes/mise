ALTER TABLE `recipes` ADD `visibility` text DEFAULT 'public' NOT NULL;
--> statement-breakpoint
ALTER TABLE `recipes` ADD `owner_id` text REFERENCES `user`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
DROP TABLE `meal_slots`;
