CREATE TABLE `stage_place` (
	`stage_id` text NOT NULL,
	`place_id` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`stage_id`, `place_id`),
	FOREIGN KEY (`stage_id`) REFERENCES `stage`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`place_id`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `stage_place_place_idx` ON `stage_place` (`place_id`);