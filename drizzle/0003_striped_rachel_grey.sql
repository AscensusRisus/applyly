CREATE TABLE IF NOT EXISTS `extension_pairings` (
	`id` integer PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `applications` ADD `company_key` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `company_domain` text;--> statement-breakpoint
ALTER TABLE `applications` ADD `company_aliases` text;
