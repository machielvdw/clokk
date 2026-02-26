CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`description` text DEFAULT '' NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`billable` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_entries_start` ON `entries` (`start_time`);--> statement-breakpoint
CREATE INDEX `idx_entries_project` ON `entries` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_entries_end` ON `entries` (`end_time`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`client` text,
	`color` text,
	`rate` real,
	`currency` text DEFAULT 'USD' NOT NULL,
	`archived` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_name_unique` ON `projects` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_projects_name` ON `projects` (`name`);