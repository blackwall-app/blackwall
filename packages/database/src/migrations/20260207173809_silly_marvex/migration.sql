CREATE TABLE `issue_sprint` (
	`id` text PRIMARY KEY,
	`created_by_id` text NOT NULL,
	`name` text NOT NULL,
	`goal` text,
	`team_id` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_issue_sprint_created_by_id_user_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_issue_sprint_team_id_team_id_fk` FOREIGN KEY (`team_id`) REFERENCES `team`(`id`)
);
--> statement-breakpoint
CREATE TABLE `job` (
	`id` text PRIMARY KEY,
	`queue` text DEFAULT 'default' NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`run_at` integer,
	`locked_until` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `label` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`colorKey` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_label_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`)
);
--> statement-breakpoint
CREATE TABLE `label_on_issue` (
	`label_id` text NOT NULL,
	`issue_id` text NOT NULL,
	CONSTRAINT `label_on_issue_pk` PRIMARY KEY(`label_id`, `issue_id`),
	CONSTRAINT `fk_label_on_issue_label_id_label_id_fk` FOREIGN KEY (`label_id`) REFERENCES `label`(`id`),
	CONSTRAINT `fk_label_on_issue_issue_id_issue_id_fk` FOREIGN KEY (`issue_id`) REFERENCES `issue`(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_entry` (
	`id` text PRIMARY KEY,
	`issue_id` text NOT NULL,
	`user_id` text NOT NULL,
	`duration` integer NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_time_entry_issue_id_issue_id_fk` FOREIGN KEY (`issue_id`) REFERENCES `issue`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_time_entry_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `issue` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL,
	`workspace_id` text NOT NULL,
	`team_id` text NOT NULL,
	`created_by_id` text NOT NULL,
	`assigned_to_id` text,
	`sprint_id` text,
	`key_number` integer NOT NULL,
	`summary` text NOT NULL,
	`status` text DEFAULT 'to_do' NOT NULL,
	`description` text NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`estimation_points` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_issue_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`),
	CONSTRAINT `fk_issue_team_id_team_id_fk` FOREIGN KEY (`team_id`) REFERENCES `team`(`id`),
	CONSTRAINT `fk_issue_created_by_id_user_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_issue_assigned_to_id_user_id_fk` FOREIGN KEY (`assigned_to_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_issue_sprint_id_issue_sprint_id_fk` FOREIGN KEY (`sprint_id`) REFERENCES `issue_sprint`(`id`)
);
--> statement-breakpoint
CREATE TABLE `issue_attachment` (
	`id` text PRIMARY KEY,
	`issue_id` text,
	`created_by_id` text NOT NULL,
	`file_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`original_file_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_issue_attachment_issue_id_issue_id_fk` FOREIGN KEY (`issue_id`) REFERENCES `issue`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_issue_attachment_created_by_id_user_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `issue_change_event` (
	`id` text PRIMARY KEY,
	`issue_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_type` text DEFAULT 'issue_updated' NOT NULL,
	`changes` text,
	`related_entity_id` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_issue_change_event_issue_id_issue_id_fk` FOREIGN KEY (`issue_id`) REFERENCES `issue`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_issue_change_event_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`),
	CONSTRAINT `fk_issue_change_event_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `issue_comment` (
	`id` text PRIMARY KEY,
	`issue_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_issue_comment_issue_id_issue_id_fk` FOREIGN KEY (`issue_id`) REFERENCES `issue`(`id`),
	CONSTRAINT `fk_issue_comment_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `issue_sequence` (
	`workspace_id` text NOT NULL,
	`team_id` text NOT NULL,
	`current_sequence` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `issue_sequence_pk` PRIMARY KEY(`workspace_id`, `team_id`),
	CONSTRAINT `fk_issue_sequence_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`),
	CONSTRAINT `fk_issue_sequence_team_id_team_id_fk` FOREIGN KEY (`team_id`) REFERENCES `team`(`id`)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`token` text NOT NULL UNIQUE,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `team` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`active_sprint_id` text,
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`avatar` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_team_active_sprint_id_issue_sprint_id_fk` FOREIGN KEY (`active_sprint_id`) REFERENCES `issue_sprint`(`id`),
	CONSTRAINT `fk_team_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_workspace_id` text,
	`last_team_id` text,
	`preferred_theme` text DEFAULT 'system',
	CONSTRAINT `fk_user_last_workspace_id_workspace_id_fk` FOREIGN KEY (`last_workspace_id`) REFERENCES `workspace`(`id`),
	CONSTRAINT `fk_user_last_team_id_team_id_fk` FOREIGN KEY (`last_team_id`) REFERENCES `team`(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_on_team` (
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	CONSTRAINT `user_on_team_pk` PRIMARY KEY(`user_id`, `team_id`),
	CONSTRAINT `fk_user_on_team_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_user_on_team_team_id_team_id_fk` FOREIGN KEY (`team_id`) REFERENCES `team`(`id`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL UNIQUE,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY,
	`slug` text NOT NULL,
	`display_name` text NOT NULL,
	`logo_url` text
);
--> statement-breakpoint
CREATE TABLE `workspace_invitation` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`created_by_id` text NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL UNIQUE,
	`expires_at` integer,
	CONSTRAINT `fk_workspace_invitation_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`),
	CONSTRAINT `fk_workspace_invitation_created_by_id_user_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspace_user` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	CONSTRAINT `workspace_user_pk` PRIMARY KEY(`workspace_id`, `user_id`),
	CONSTRAINT `fk_workspace_user_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_workspace_user_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `issue_sprint_created_by_id_idx` ON `issue_sprint` (`created_by_id`);--> statement-breakpoint
CREATE INDEX `issue_sprint_team_id_idx` ON `issue_sprint` (`team_id`);--> statement-breakpoint
CREATE INDEX `job_queue_status_run_at_idx` ON `job` (`queue`,`status`,`run_at`);--> statement-breakpoint
CREATE INDEX `job_status_locked_until_idx` ON `job` (`status`,`locked_until`);--> statement-breakpoint
CREATE INDEX `label_workspace_id_idx` ON `label` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `time_entry_issue_id_idx` ON `time_entry` (`issue_id`);--> statement-breakpoint
CREATE INDEX `time_entry_user_id_idx` ON `time_entry` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `issue_key_workspace_id_unique` ON `issue` (`key`,`workspace_id`);--> statement-breakpoint
CREATE INDEX `issue_workspace_id_idx` ON `issue` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `issue_team_id_idx` ON `issue` (`team_id`);--> statement-breakpoint
CREATE INDEX `issue_created_by_id_idx` ON `issue` (`created_by_id`);--> statement-breakpoint
CREATE INDEX `issue_assigned_to_id_idx` ON `issue` (`assigned_to_id`);--> statement-breakpoint
CREATE INDEX `issue_sprint_id_idx` ON `issue` (`sprint_id`);--> statement-breakpoint
CREATE INDEX `issue_attachment_issue_id_idx` ON `issue_attachment` (`issue_id`);--> statement-breakpoint
CREATE INDEX `issue_attachment_created_by_id_idx` ON `issue_attachment` (`created_by_id`);--> statement-breakpoint
CREATE INDEX `issue_change_event_issue_id_idx` ON `issue_change_event` (`issue_id`);--> statement-breakpoint
CREATE INDEX `issue_change_event_workspace_created_idx` ON `issue_change_event` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `issue_change_event_type_idx` ON `issue_change_event` (`event_type`);--> statement-breakpoint
CREATE INDEX `issue_change_event_actor_id_idx` ON `issue_change_event` (`actor_id`);--> statement-breakpoint
CREATE INDEX `issue_comment_issue_id_idx` ON `issue_comment` (`issue_id`);--> statement-breakpoint
CREATE INDEX `issue_comment_author_id_idx` ON `issue_comment` (`author_id`);--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_workspace_id_key_unique` ON `team` (`workspace_id`,`key`);--> statement-breakpoint
CREATE INDEX `team_active_sprint_id_idx` ON `team` (`active_sprint_id`);--> statement-breakpoint
CREATE INDEX `user_last_workspace_id_idx` ON `user` (`last_workspace_id`);--> statement-breakpoint
CREATE INDEX `user_last_team_id_idx` ON `user` (`last_team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_slug_unique` ON `workspace` (`slug`);--> statement-breakpoint
CREATE INDEX `workspace_invitation_workspace_id_idx` ON `workspace_invitation` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_invitation_created_by_id_idx` ON `workspace_invitation` (`created_by_id`);