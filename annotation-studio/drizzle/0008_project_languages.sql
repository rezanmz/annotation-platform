CREATE TABLE `project_languages` (
	`project_id` text NOT NULL,
	`language` text NOT NULL,
	PRIMARY KEY(`project_id`, `language`),
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
WITH defaults(project_id, language) AS (VALUES
  ('eurlex','en'), ('eurlex','fr'), ('eurlex','de'), ('eurlex','es'),
  ('un','ar'), ('un','zh'), ('un','en'), ('un','fr'), ('un','ru'), ('un','es'),
  ('chemistry','zh'), ('chemistry','en'), ('chemistry','fr'), ('chemistry','de'),
  ('chemistry','ja'), ('chemistry','ru'), ('chemistry','es')
)
INSERT INTO project_languages (project_id, language)
SELECT defaults.project_id, defaults.language FROM defaults JOIN projects ON projects.id = defaults.project_id;
--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`project_id` text NOT NULL,
	`language` text,
	`id` text NOT NULL,
	`title` text NOT NULL,
	`source` text NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `id`),
	FOREIGN KEY (`project_id`,`language`) REFERENCES `project_languages`(`project_id`,`language`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_documents`("project_id", "id", "title", "source", "question", "answer", "content_hash", "created_at") SELECT "project_id", "id", "title", "source", "question", "answer", "content_hash", "created_at" FROM `documents`;--> statement-breakpoint
DROP TABLE `documents`;--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;--> statement-breakpoint
CREATE UNIQUE INDEX `unique_document_language_content` ON `documents` (`project_id`,`language`,`content_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_document_content` ON `documents` (`project_id`,`content_hash`) WHERE "documents"."language" IS NULL;--> statement-breakpoint
CREATE TABLE `__new_memberships` (
	`project_id` text NOT NULL,
	`language` text,
	`email` text NOT NULL,
	`user_id` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `email`),
	FOREIGN KEY (`project_id`,`language`) REFERENCES `project_languages`(`project_id`,`language`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_memberships`("project_id", "email", "user_id", "created_at") SELECT "project_id", "email", "user_id", "created_at" FROM `memberships`;--> statement-breakpoint
DROP TABLE `memberships`;--> statement-breakpoint
ALTER TABLE `__new_memberships` RENAME TO `memberships`;--> statement-breakpoint
CREATE UNIQUE INDEX `one_project_per_email` ON `memberships` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_project_per_user` ON `memberships` (`user_id`);
