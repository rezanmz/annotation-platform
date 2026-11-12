CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`metadata` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_created_at` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `auth_rate_limits_window` ON `auth_rate_limits` (`window_started_at`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expires_at` ON `auth_sessions` (`expires_at`);