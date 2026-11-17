CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`ai_enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
