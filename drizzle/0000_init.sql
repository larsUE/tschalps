CREATE TABLE `place` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`ele` real,
	`description` text,
	`access` text,
	`status` text DEFAULT 'aktiv' NOT NULL,
	`created_by` text,
	`updated_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `place_lat_lng_idx` ON `place` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `place_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`user_id` text,
	`visited_on` text,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `place_comment_place_idx` ON `place_comment` (`place_id`);--> statement-breakpoint
CREATE TABLE `place_photo` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`path` text NOT NULL,
	`caption` text,
	`taken_at` integer,
	`uploaded_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `place_photo_place_idx` ON `place_photo` (`place_id`);--> statement-breakpoint
CREATE TABLE `place_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`place_id`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `place_revision_place_idx` ON `place_revision` (`place_id`);--> statement-breakpoint
CREATE TABLE `stage` (
	`id` text PRIMARY KEY NOT NULL,
	`tour_id` text NOT NULL,
	`day_index` integer NOT NULL,
	`date` text,
	`title` text,
	`report_md` text,
	`gpx_path` text,
	`geojson` text,
	`min_lng` real,
	`min_lat` real,
	`max_lng` real,
	`max_lat` real,
	`distance_m` real,
	`ascent_m` real,
	`descent_m` real,
	`min_ele` real,
	`max_ele` real,
	`night_place_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`tour_id`) REFERENCES `tour`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`night_place_id`) REFERENCES `place`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `stage_tour_idx` ON `stage` (`tour_id`,`day_index`);--> statement-breakpoint
CREATE INDEX `stage_night_idx` ON `stage` (`night_place_id`);--> statement-breakpoint
CREATE TABLE `tour` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`year` integer NOT NULL,
	`season` text,
	`start_date` text,
	`end_date` text,
	`summary_md` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tour_slug_unique` ON `tour` (`slug`);--> statement-breakpoint
CREATE TABLE `tour_participant` (
	`tour_id` text NOT NULL,
	`user_id` text NOT NULL,
	`is_leader` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`tour_id`, `user_id`),
	FOREIGN KEY (`tour_id`) REFERENCES `tour`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tour_photo` (
	`id` text PRIMARY KEY NOT NULL,
	`tour_id` text NOT NULL,
	`stage_id` text,
	`path` text NOT NULL,
	`caption` text,
	`lat` real,
	`lng` real,
	`taken_at` integer,
	`uploaded_by` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`tour_id`) REFERENCES `tour`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`stage_id`) REFERENCES `stage`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `tour_photo_tour_idx` ON `tour_photo` (`tour_id`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);