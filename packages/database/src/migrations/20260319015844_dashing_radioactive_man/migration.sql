CREATE INDEX `issue_sprint_team_archived_created_idx` ON `issue_sprint` (`team_id`,`archived_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `label_on_issue_issue_id_idx` ON `label_on_issue` (`issue_id`);--> statement-breakpoint
CREATE INDEX `time_entry_issue_deleted_created_idx` ON `time_entry` (`issue_id`,`deleted_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `issue_comment_issue_deleted_idx` ON `issue_comment` (`issue_id`,`deleted_at`);