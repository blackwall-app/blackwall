import { client } from "@blackwall/database";

const TABLES = [
  "label_on_issue",
  "time_entry",
  "issue_comment",
  "issue_change_event",
  "issue_attachment",
  "issue",
  "issue_sequence",
  "issue_sprint",
  "user_on_team",
  "workspace_invitation",
  "workspace_user",
  "team",
  "label",
  "account",
  "session",
  "verification",
  "workspace",
  "user",
  "job",
] as const;

export async function resetAllTables() {
  client.run("PRAGMA foreign_keys = OFF;");
  for (const table of TABLES) {
    client.run(`DELETE FROM "${table}";`);
  }
  client.run("PRAGMA foreign_keys = ON;");
}
