import { Context, Effect, Layer, Predicate, Schema } from "effect";
import { client, db, dbSchema, type DbTransaction } from "./index";

export type Db = typeof db;
export type DbClient = typeof client;
export type DbSchema = typeof dbSchema;

const sqliteErrorCode = (error: unknown): unknown => {
  if (Predicate.hasProperty(error, "code")) return error.code;
  if (Predicate.hasProperty(error, "cause")) return sqliteErrorCode(error.cause);
  return undefined;
};

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  cause: Schema.Defect(),
}) {
  /** A write hit a unique constraint or unique index. */
  get isUniqueViolation() {
    return sqliteErrorCode(this.cause) === "SQLITE_CONSTRAINT_UNIQUE";
  }

  /** A write referenced a row that doesn't exist. */
  get isForeignKeyViolation() {
    return sqliteErrorCode(this.cause) === "SQLITE_CONSTRAINT_FOREIGNKEY";
  }
}

const use = <A>(f: (db: Db) => A | PromiseLike<A>): Effect.Effect<A, DatabaseError> =>
  Effect.tryPromise({
    try: async () => f(db),
    catch: (cause) => new DatabaseError({ cause }),
  });

const transaction = <A>(f: (tx: DbTransaction) => A): Effect.Effect<A, DatabaseError> =>
  Effect.try({
    // drizzle's types reject callbacks that might return a promise. `f` is synchronous by contract.
    try: () => db.transaction<A>(f as (tx: DbTransaction) => never),
    catch: (cause) => new DatabaseError({ cause }),
  });

/**
 * The drizzle database as a service.
 *
 * `use` runs a query and `transaction` runs a synchronous drizzle transaction.
 * bun:sqlite is synchronous, so a transaction callback can't await; build the
 * whole write inside it and return the result. Both fail with `DatabaseError`.
 * Services map the failures they expect (like `isUniqueViolation`) to domain
 * errors and turn the rest into defects:
 *
 * ```ts
 * const create = Effect.fn("LabelService.create")(function* (input) {
 *   return yield* database.use((db) => labelData.insertLabel(db, input)).pipe(
 *     Effect.catchTag("DatabaseError", (error) =>
 *       error.isUniqueViolation ? Effect.fail(new LabelNameTaken()) : Effect.die(error),
 *     ),
 *   );
 * });
 * ```
 */
export class Database extends Context.Service<
  Database,
  {
    readonly db: Db;
    readonly client: DbClient;
    readonly dbSchema: DbSchema;
    readonly use: <A>(f: (db: Db) => A | PromiseLike<A>) => Effect.Effect<A, DatabaseError>;
    readonly transaction: <A>(f: (tx: DbTransaction) => A) => Effect.Effect<A, DatabaseError>;
  }
>()("@blackwall/database/Database") {
  static readonly layer = Layer.succeed(
    Database,
    Database.of({ client, db, dbSchema, use, transaction }),
  );
}

export type DatabaseService = Database["Service"];
