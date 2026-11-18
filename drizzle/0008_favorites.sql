CREATE TABLE `favorites` (
	`user_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `recipe_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `favorites_recipe_idx` ON `favorites` (`recipe_id`);
--> statement-breakpoint
INSERT INTO `favorites` (`user_id`, `recipe_id`)
SELECT `owner_id`, `id` FROM `recipes`
WHERE `favorite` = 1 AND `owner_id` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `recipes` DROP COLUMN `favorite`;
