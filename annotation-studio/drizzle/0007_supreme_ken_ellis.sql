CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `projects` (`id`, `name`, `domain`, `description`, `created_at`) VALUES
 ('eurlex', 'EUR-Lex', 'legal', 'European Union legal texts', '2026-01-01T00:00:00.000Z'),
 ('un', 'United Nations', 'legal', 'United Nations legal texts', '2026-01-01T00:00:01.000Z'),
 ('chemistry', 'Chemistry', 'chemistry', 'Chemistry research and technical texts', '2026-01-01T00:00:02.000Z');
