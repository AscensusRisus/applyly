CREATE TABLE IF NOT EXISTS `application_status_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `application_id` integer NOT NULL,
  `status` text NOT NULL,
  `changed_at` integer NOT NULL,
  `note` text
);
CREATE INDEX IF NOT EXISTS `application_status_history_application_id_idx` ON `application_status_history` (`application_id`);
