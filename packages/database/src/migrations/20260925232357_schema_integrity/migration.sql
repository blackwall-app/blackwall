CREATE TABLE `team_key_alias` (
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`team_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `team_key_alias_pk` PRIMARY KEY(`workspace_id`, `key`),
	CONSTRAINT `fk_team_key_alias_team_id_workspace_id_team_id_workspace_id_fk` FOREIGN KEY (`team_id`,`workspace_id`) REFERENCES `team`(`id`,`workspace_id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `time_entry` RENAME COLUMN `duration` TO `duration_minutes`;
--> statement-breakpoint
ALTER TABLE `issue` ADD `description_text` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `issue_attachment` ADD `size_bytes` integer;
--> statement-breakpoint
ALTER TABLE `workspace_user` ADD `role` text DEFAULT 'member' NOT NULL;
--> statement-breakpoint
-- The earliest member of each workspace becomes its owner.
UPDATE `workspace_user` SET `role` = 'owner'
WHERE NOT EXISTS (
  SELECT 1 FROM `workspace_user` w2
  WHERE w2.`workspace_id` = `workspace_user`.`workspace_id`
    AND (
      w2.`joined_at` < `workspace_user`.`joined_at`
      OR (w2.`joined_at` = `workspace_user`.`joined_at` AND w2.`user_id` < `workspace_user`.`user_id`)
    )
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_issue_sprint` (
	`id` text PRIMARY KEY,
	`created_by_id` text NOT NULL,
	`name` text NOT NULL,
	`goal` text,
	`team_id` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`finished_at` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_issue_sprint_created_by_id_user_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_issue_sprint_team_id_team_id_fk` FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON DELETE CASCADE,
	CONSTRAINT `issue_sprint_id_team_id_unique` UNIQUE(`id`,`team_id`),
	CONSTRAINT "issue_sprint_finished_at_matches_status" CHECK(("status" = 'completed') = ("finished_at" is not null))
);
--> statement-breakpoint
-- Only the sprint the team pointed at through team.active_sprint_id stays active; any other
-- sprint marked active is demoted to planned so the one-active-per-team index can be built.
-- finished_at is aligned with status for the new CHECK constraint.
INSERT INTO `__new_issue_sprint`(`id`, `created_by_id`, `name`, `goal`, `team_id`, `start_date`, `end_date`, `status`, `finished_at`, `archived_at`, `created_at`, `updated_at`, `deleted_at`)
SELECT s.`id`, s.`created_by_id`, s.`name`, s.`goal`, s.`team_id`, s.`start_date`, s.`end_date`,
  CASE
    WHEN s.`status` = 'active' AND NOT EXISTS (
      SELECT 1 FROM `team` t WHERE t.`id` = s.`team_id` AND t.`active_sprint_id` = s.`id`
    ) THEN 'planned'
    ELSE s.`status`
  END,
  CASE WHEN s.`status` = 'completed' THEN coalesce(s.`finished_at`, s.`updated_at`) ELSE NULL END,
  s.`archived_at`, s.`created_at`, s.`updated_at`, s.`deleted_at`
FROM `issue_sprint` s;
--> statement-breakpoint
DROP TABLE `issue_sprint`;
--> statement-breakpoint
ALTER TABLE `__new_issue_sprint` RENAME TO `issue_sprint`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_team` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`avatar` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_team_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE,
	CONSTRAINT `team_id_workspace_id_unique` UNIQUE(`id`,`workspace_id`)
);
--> statement-breakpoint
INSERT INTO `__new_team`(`id`, `name`, `workspace_id`, `key`, `avatar`, `created_at`, `updated_at`, `deleted_at`) SELECT `id`, `name`, `workspace_id`, `key`, `avatar`, `created_at`, `updated_at`, `deleted_at` FROM `team`;
--> statement-breakpoint
DROP TABLE `team`;
--> statement-breakpoint
ALTER TABLE `__new_team` RENAME TO `team`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_label` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`color_key` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_label_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE,
	CONSTRAINT `label_id_workspace_id_unique` UNIQUE(`id`,`workspace_id`)
);
--> statement-breakpoint
-- Labels whose names collide case-insensitively within a workspace get a " (n)" suffix so the
-- new unique index can be built. The oldest label keeps its name.
INSERT INTO `__new_label`(`id`, `name`, `color_key`, `workspace_id`, `created_at`, `updated_at`)
SELECT l.`id`,
  CASE
    WHEN l.`duplicate_rank` = 0 THEN l.`name`
    ELSE l.`name` || ' (' || (l.`duplicate_rank` + 1) || ')'
  END,
  l.`colorKey`, l.`workspace_id`, l.`created_at`, l.`updated_at`
FROM (
  SELECT label.*, (
    SELECT count(*) FROM `label` l2
    WHERE l2.`workspace_id` = label.`workspace_id`
      AND l2.`name` = label.`name` COLLATE NOCASE
      AND l2.`id` < label.`id`
  ) AS `duplicate_rank`
  FROM `label`
) l;
--> statement-breakpoint
DROP TABLE `label`;
--> statement-breakpoint
ALTER TABLE `__new_label` RENAME TO `label`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
-- Old key prefixes (from team renames before keys were kept in sync) become aliases, so
-- existing links keep resolving. Prefixes now owned by a live team are skipped.
INSERT OR IGNORE INTO `team_key_alias`(`workspace_id`, `key`, `team_id`, `created_at`)
SELECT DISTINCT t.`workspace_id`, substr(i.`key`, 1, length(i.`key`) - length(i.`key_number`) - 1), t.`id`,
  CAST(unixepoch('subsec') * 1000 AS integer)
FROM `issue` i
JOIN `team` t ON t.`id` = i.`team_id`
WHERE substr(i.`key`, 1, length(i.`key`) - length(i.`key_number`) - 1) <> t.`key`
  AND NOT EXISTS (
    SELECT 1 FROM `team` t2
    WHERE t2.`workspace_id` = t.`workspace_id`
      AND t2.`key` = substr(i.`key`, 1, length(i.`key`) - length(i.`key_number`) - 1)
      AND t2.`deleted_at` IS NULL
  );
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_issue` (
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
	`description_text` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`estimation_points` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_issue_created_by_id_user_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_issue_assigned_to_id_user_id_fk` FOREIGN KEY (`assigned_to_id`) REFERENCES `user`(`id`) ON DELETE SET NULL,
	CONSTRAINT `issue_team_workspace_fk` FOREIGN KEY (`team_id`,`workspace_id`) REFERENCES `team`(`id`,`workspace_id`) ON DELETE CASCADE,
	CONSTRAINT `issue_sprint_team_fk` FOREIGN KEY (`sprint_id`,`team_id`) REFERENCES `issue_sprint`(`id`,`team_id`),
	CONSTRAINT `issue_id_workspace_id_unique` UNIQUE(`id`,`workspace_id`)
);
--> statement-breakpoint
-- Keys are rewritten from the team's current key, which repairs keys left stale by earlier
-- team renames. workspace_id is taken from the team and sprint_id is dropped when the sprint
-- belongs to another team, so every row satisfies the new composite foreign keys.
INSERT INTO `__new_issue`(`id`, `key`, `workspace_id`, `team_id`, `created_by_id`, `assigned_to_id`, `sprint_id`, `key_number`, `summary`, `status`, `description`, `description_text`, `sort_order`, `priority`, `estimation_points`, `created_at`, `updated_at`, `deleted_at`)
SELECT i.`id`, t.`key` || '-' || i.`key_number`, t.`workspace_id`, i.`team_id`, i.`created_by_id`, i.`assigned_to_id`,
  CASE
    WHEN EXISTS (SELECT 1 FROM `issue_sprint` s WHERE s.`id` = i.`sprint_id` AND s.`team_id` = i.`team_id`)
    THEN i.`sprint_id`
    ELSE NULL
  END,
  i.`key_number`, i.`summary`, i.`status`, i.`description`,
  coalesce((
    SELECT group_concat(j.`value`, ' ') FROM json_tree(i.`description`) j
    WHERE j.`key` = 'text' AND j.`type` = 'text'
  ), ''),
  i.`sort_order`, i.`priority`, i.`estimation_points`, i.`created_at`, i.`updated_at`, i.`deleted_at`
FROM `issue` i
JOIN `team` t ON t.`id` = i.`team_id`;
--> statement-breakpoint
DROP TABLE `issue`;
--> statement-breakpoint
ALTER TABLE `__new_issue` RENAME TO `issue`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_label_on_issue` (
	`label_id` text NOT NULL,
	`issue_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	CONSTRAINT `label_on_issue_pk` PRIMARY KEY(`label_id`, `issue_id`),
	CONSTRAINT `label_on_issue_label_workspace_fk` FOREIGN KEY (`label_id`,`workspace_id`) REFERENCES `label`(`id`,`workspace_id`) ON DELETE CASCADE,
	CONSTRAINT `label_on_issue_issue_workspace_fk` FOREIGN KEY (`issue_id`,`workspace_id`) REFERENCES `issue`(`id`,`workspace_id`) ON DELETE CASCADE
);
--> statement-breakpoint
-- workspace_id comes from the issue. Rows linking a label and an issue from different
-- workspaces are dropped because the new foreign keys forbid them.
INSERT INTO `__new_label_on_issue`(`label_id`, `issue_id`, `workspace_id`)
SELECT loi.`label_id`, loi.`issue_id`, i.`workspace_id`
FROM `label_on_issue` loi
JOIN `issue` i ON i.`id` = loi.`issue_id`
JOIN `label` l ON l.`id` = loi.`label_id` AND l.`workspace_id` = i.`workspace_id`;
--> statement-breakpoint
DROP TABLE `label_on_issue`;
--> statement-breakpoint
ALTER TABLE `__new_label_on_issue` RENAME TO `label_on_issue`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_issue_change_event` (
	`id` text PRIMARY KEY,
	`issue_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_type` text NOT NULL,
	`changes` text,
	`comment_id` text,
	`attachment_id` text,
	`label_id` text,
	`time_entry_id` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_issue_change_event_actor_id_user_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_issue_change_event_comment_id_issue_comment_id_fk` FOREIGN KEY (`comment_id`) REFERENCES `issue_comment`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_issue_change_event_attachment_id_issue_attachment_id_fk` FOREIGN KEY (`attachment_id`) REFERENCES `issue_attachment`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_issue_change_event_label_id_label_id_fk` FOREIGN KEY (`label_id`) REFERENCES `label`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_issue_change_event_time_entry_id_time_entry_id_fk` FOREIGN KEY (`time_entry_id`) REFERENCES `time_entry`(`id`) ON DELETE SET NULL,
	CONSTRAINT `issue_change_event_issue_workspace_fk` FOREIGN KEY (`issue_id`,`workspace_id`) REFERENCES `issue`(`id`,`workspace_id`) ON DELETE CASCADE
);
--> statement-breakpoint
-- related_entity_id is split into typed columns by event type. References to rows that were
-- hard-deleted (attachments, labels) are left null. Stored description documents are removed
-- from `changes`, and workspace_id is taken from the issue.
INSERT INTO `__new_issue_change_event`(`id`, `issue_id`, `workspace_id`, `actor_id`, `event_type`, `changes`, `comment_id`, `attachment_id`, `label_id`, `time_entry_id`, `created_at`)
SELECT e.`id`, e.`issue_id`, i.`workspace_id`, e.`actor_id`, e.`event_type`,
  CASE WHEN e.`changes` IS NULL THEN NULL ELSE json_remove(e.`changes`, '$.description') END,
  CASE WHEN e.`event_type` LIKE 'comment_%'
    AND EXISTS (SELECT 1 FROM `issue_comment` c WHERE c.`id` = e.`related_entity_id`)
    THEN e.`related_entity_id` END,
  CASE WHEN e.`event_type` LIKE 'attachment_%'
    AND EXISTS (SELECT 1 FROM `issue_attachment` a WHERE a.`id` = e.`related_entity_id`)
    THEN e.`related_entity_id` END,
  CASE WHEN e.`event_type` LIKE 'label_%'
    AND EXISTS (SELECT 1 FROM `label` l WHERE l.`id` = e.`related_entity_id`)
    THEN e.`related_entity_id` END,
  CASE WHEN e.`event_type` = 'time_logged'
    AND EXISTS (SELECT 1 FROM `time_entry` te WHERE te.`id` = e.`related_entity_id`)
    THEN e.`related_entity_id` END,
  e.`created_at`
FROM `issue_change_event` e
JOIN `issue` i ON i.`id` = e.`issue_id`;
--> statement-breakpoint
DROP TABLE `issue_change_event`;
--> statement-breakpoint
ALTER TABLE `__new_issue_change_event` RENAME TO `issue_change_event`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_workspace_invitation` (
	`id` text PRIMARY KEY,
	`workspace_id` text NOT NULL,
	`created_by_id` text NOT NULL,
	`email` text NOT NULL,
	`token_hash` text NOT NULL UNIQUE,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`accepted_by_id` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_workspace_invitation_workspace_id_workspace_id_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_workspace_invitation_created_by_id_user_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `user`(`id`),
	CONSTRAINT `fk_workspace_invitation_accepted_by_id_user_id_fk` FOREIGN KEY (`accepted_by_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
-- Tokens were stored in plain text and SQLite can't hash them here. Pending invitations are
-- kept for the record but expired, with a placeholder hash no token can match. Resend them.
INSERT INTO `__new_workspace_invitation`(`id`, `workspace_id`, `created_by_id`, `email`, `token_hash`, `expires_at`, `created_at`)
SELECT `id`, `workspace_id`, `created_by_id`, `email`, 'legacy:' || `id`,
  min(coalesce(`expires_at`, 0), CAST(unixepoch('subsec') * 1000 AS integer)),
  coalesce(`expires_at` - 7 * 24 * 60 * 60 * 1000, CAST(unixepoch('subsec') * 1000 AS integer))
FROM `workspace_invitation`;
--> statement-breakpoint
DROP TABLE `workspace_invitation`;
--> statement-breakpoint
ALTER TABLE `__new_workspace_invitation` RENAME TO `workspace_invitation`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_issue_sequence` (
	`team_id` text PRIMARY KEY,
	`current_sequence` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `fk_issue_sequence_team_id_team_id_fk` FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_issue_sequence`(`team_id`, `current_sequence`) SELECT `team_id`, `current_sequence` FROM `issue_sequence`;
--> statement-breakpoint
DROP TABLE `issue_sequence`;
--> statement-breakpoint
ALTER TABLE `__new_issue_sequence` RENAME TO `issue_sequence`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_issue_comment` (
	`id` text PRIMARY KEY,
	`issue_id` text NOT NULL,
	`author_id` text NOT NULL,
	`content` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT `fk_issue_comment_issue_id_issue_id_fk` FOREIGN KEY (`issue_id`) REFERENCES `issue`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_issue_comment_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_issue_comment`(`id`, `issue_id`, `author_id`, `content`, `created_at`, `updated_at`, `deleted_at`) SELECT `id`, `issue_id`, `author_id`, `content`, `created_at`, `updated_at`, `deleted_at` FROM `issue_comment`;
--> statement-breakpoint
DROP TABLE `issue_comment`;
--> statement-breakpoint
ALTER TABLE `__new_issue_comment` RENAME TO `issue_comment`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_job` (
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
	`completed_at` integer,
	CONSTRAINT "job_payload_is_json" CHECK(json_valid("payload"))
);
--> statement-breakpoint
INSERT INTO `__new_job`(`id`, `queue`, `type`, `payload`, `status`, `attempts`, `max_attempts`, `run_at`, `locked_until`, `last_error`, `created_at`, `completed_at`) SELECT `id`, `queue`, `type`, `payload`, `status`, `attempts`, `max_attempts`, `run_at`, `locked_until`, `last_error`, `created_at`, `completed_at` FROM `job`;
--> statement-breakpoint
DROP TABLE `job`;
--> statement-breakpoint
ALTER TABLE `__new_job` RENAME TO `job`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_account` (
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
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_account`(`id`, `user_id`, `account_id`, `provider_id`, `access_token`, `refresh_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `id_token`, `password`, `created_at`, `updated_at`) SELECT `id`, `user_id`, `account_id`, `provider_id`, `access_token`, `refresh_token`, `access_token_expires_at`, `refresh_token_expires_at`, `scope`, `id_token`, `password`, `created_at`, `updated_at` FROM `account`;
--> statement-breakpoint
DROP TABLE `account`;
--> statement-breakpoint
ALTER TABLE `__new_account` RENAME TO `account`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_session` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`token` text NOT NULL UNIQUE,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_session`(`id`, `user_id`, `token`, `expires_at`, `ip_address`, `user_agent`, `created_at`, `updated_at`) SELECT `id`, `user_id`, `token`, `expires_at`, `ip_address`, `user_agent`, `created_at`, `updated_at` FROM `session`;
--> statement-breakpoint
DROP TABLE `session`;
--> statement-breakpoint
ALTER TABLE `__new_session` RENAME TO `session`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_user` (
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
	`preferred_locale` text,
	CONSTRAINT `fk_user_last_workspace_id_workspace_id_fk` FOREIGN KEY (`last_workspace_id`) REFERENCES `workspace`(`id`) ON DELETE SET NULL,
	CONSTRAINT `fk_user_last_team_id_team_id_fk` FOREIGN KEY (`last_team_id`) REFERENCES `team`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`(`id`, `name`, `email`, `email_verified`, `image`, `created_at`, `updated_at`, `last_workspace_id`, `last_team_id`, `preferred_theme`, `preferred_locale`) SELECT `id`, `name`, `email`, `email_verified`, `image`, `created_at`, `updated_at`, `last_workspace_id`, `last_team_id`, `preferred_theme`, `preferred_locale` FROM `user`;
--> statement-breakpoint
DROP TABLE `user`;
--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_user_on_team` (
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	CONSTRAINT `user_on_team_pk` PRIMARY KEY(`user_id`, `team_id`),
	CONSTRAINT `fk_user_on_team_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_user_on_team_team_id_team_id_fk` FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_user_on_team`(`user_id`, `team_id`) SELECT `user_id`, `team_id` FROM `user_on_team`;
--> statement-breakpoint
DROP TABLE `user_on_team`;
--> statement-breakpoint
ALTER TABLE `__new_user_on_team` RENAME TO `user_on_team`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
DROP INDEX IF EXISTS `team_active_sprint_id_idx`;
--> statement-breakpoint
CREATE INDEX `issue_sprint_created_by_id_idx` ON `issue_sprint` (`created_by_id`);
--> statement-breakpoint
CREATE INDEX `issue_sprint_team_id_idx` ON `issue_sprint` (`team_id`);
--> statement-breakpoint
CREATE INDEX `issue_sprint_team_archived_created_idx` ON `issue_sprint` (`team_id`,`archived_at`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `issue_sprint_one_active_per_team` ON `issue_sprint` (`team_id`) WHERE "issue_sprint"."status" = 'active';
--> statement-breakpoint
CREATE INDEX `job_queue_status_run_at_idx` ON `job` (`queue`,`status`,`run_at`);
--> statement-breakpoint
CREATE INDEX `job_status_locked_until_idx` ON `job` (`status`,`locked_until`);
--> statement-breakpoint
CREATE INDEX `label_workspace_id_idx` ON `label` (`workspace_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `label_workspace_id_name_unique` ON `label` (`workspace_id`,"name" collate nocase);
--> statement-breakpoint
CREATE UNIQUE INDEX `issue_key_workspace_id_unique` ON `issue` (`key`,`workspace_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `issue_team_id_key_number_unique` ON `issue` (`team_id`,`key_number`);
--> statement-breakpoint
CREATE INDEX `issue_workspace_id_idx` ON `issue` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `issue_team_id_idx` ON `issue` (`team_id`);
--> statement-breakpoint
CREATE INDEX `issue_created_by_id_idx` ON `issue` (`created_by_id`);
--> statement-breakpoint
CREATE INDEX `issue_assigned_to_id_idx` ON `issue` (`assigned_to_id`);
--> statement-breakpoint
CREATE INDEX `issue_sprint_id_idx` ON `issue` (`sprint_id`);
--> statement-breakpoint
CREATE INDEX `issue_team_workspace_deleted_idx` ON `issue` (`team_id`,`workspace_id`,`deleted_at`);
--> statement-breakpoint
CREATE INDEX `issue_team_sprint_deleted_idx` ON `issue` (`team_id`,`sprint_id`,`deleted_at`);
--> statement-breakpoint
CREATE INDEX `issue_assigned_workspace_deleted_idx` ON `issue` (`assigned_to_id`,`workspace_id`,`deleted_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_workspace_id_key_unique` ON `team` (`workspace_id`,`key`) WHERE "team"."deleted_at" is null;
--> statement-breakpoint
CREATE INDEX `workspace_invitation_workspace_id_idx` ON `workspace_invitation` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `workspace_invitation_created_by_id_idx` ON `workspace_invitation` (`created_by_id`);
--> statement-breakpoint
CREATE INDEX `label_on_issue_issue_id_idx` ON `label_on_issue` (`issue_id`);
--> statement-breakpoint
CREATE INDEX `issue_change_event_issue_id_idx` ON `issue_change_event` (`issue_id`);
--> statement-breakpoint
CREATE INDEX `issue_change_event_workspace_created_idx` ON `issue_change_event` (`workspace_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `issue_change_event_type_idx` ON `issue_change_event` (`event_type`);
--> statement-breakpoint
CREATE INDEX `issue_change_event_actor_id_idx` ON `issue_change_event` (`actor_id`);
--> statement-breakpoint
CREATE INDEX `issue_change_event_comment_id_idx` ON `issue_change_event` (`comment_id`);
--> statement-breakpoint
CREATE INDEX `issue_change_event_attachment_id_idx` ON `issue_change_event` (`attachment_id`);
--> statement-breakpoint
CREATE INDEX `issue_change_event_label_id_idx` ON `issue_change_event` (`label_id`);
--> statement-breakpoint
CREATE INDEX `issue_change_event_time_entry_id_idx` ON `issue_change_event` (`time_entry_id`);
--> statement-breakpoint
CREATE INDEX `issue_comment_issue_id_idx` ON `issue_comment` (`issue_id`);
--> statement-breakpoint
CREATE INDEX `issue_comment_author_id_idx` ON `issue_comment` (`author_id`);
--> statement-breakpoint
CREATE INDEX `issue_comment_issue_deleted_idx` ON `issue_comment` (`issue_id`,`deleted_at`);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);
--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_last_workspace_id_idx` ON `user` (`last_workspace_id`);
--> statement-breakpoint
CREATE INDEX `user_last_team_id_idx` ON `user` (`last_team_id`);
--> statement-breakpoint
CREATE INDEX `user_team_team_id_idx` ON `user_on_team` (`team_id`);
--> statement-breakpoint
CREATE INDEX `team_key_alias_team_id_idx` ON `team_key_alias` (`team_id`);
--> statement-breakpoint
ALTER TABLE `issue_attachment` DROP COLUMN `deleted_at`;
