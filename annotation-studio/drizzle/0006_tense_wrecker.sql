CREATE TABLE `guidelines` (
	`domain` text PRIMARY KEY NOT NULL,
	`bytes` blob NOT NULL,
	`sha256` text NOT NULL,
	`updated_at` text NOT NULL
);
