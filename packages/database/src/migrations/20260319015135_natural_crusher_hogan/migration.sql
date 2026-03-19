CREATE INDEX `issue_team_workspace_deleted_idx` ON `issue` (`team_id`,`workspace_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `issue_team_sprint_deleted_idx` ON `issue` (`team_id`,`sprint_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `issue_assigned_workspace_deleted_idx` ON `issue` (`assigned_to_id`,`workspace_id`,`deleted_at`);