CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company` text NOT NULL,
	`role` text NOT NULL,
	`location` text DEFAULT 'Remote' NOT NULL,
	`status` text DEFAULT 'Applied' NOT NULL,
	`applied_date` text NOT NULL,
	`salary` text,
	`url` text,
	`notes` text,
	`created_at` integer NOT NULL
);
