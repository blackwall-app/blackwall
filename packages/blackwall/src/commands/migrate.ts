import { migrateDatabase } from "@blackwall/database/migrate";

interface MigrateOptions {
  migrationsDir: string;
}

export async function migrate(options: MigrateOptions) {
  console.log(`Running migrations from ${options.migrationsDir}`);

  try {
    await migrateDatabase(options.migrationsDir);
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}
