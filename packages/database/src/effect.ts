import { Context, Layer } from "effect";
import { client, db, dbSchema } from "./index";

export type Db = typeof db;
export type DbClient = typeof client;
export type DbSchema = typeof dbSchema;

export class Database extends Context.Service<
  Database,
  {
    readonly db: Db;
    readonly client: DbClient;
    readonly dbSchema: DbSchema;
  }
>()("@blackwall/database/Database") {
  static readonly layer = Layer.succeed(Database, Database.of({ client, db, dbSchema }));
}

export type DatabaseService = Database["Service"];
