// Base SQLite du téléphone : seule source de données des écrans (voir lib/offline/README.md).
//
// Trois tables génériques, indépendantes des données de l'app :
//   - local_records : un enregistrement par élément, quelle que soit l'entité (données en JSON) ;
//   - sync_queue    : opérations locales à envoyer au serveur (CREATE / UPDATE / DELETE) ;
//   - sync_meta     : petites valeurs clé → texte (synchronisation initiale faite, propriétaire…).
//
// Une entité qui a besoin de vraies colonnes (index, tri SQL) peut ajouter ses propres
// tables avec `registerMigration` avant `initializeDatabase()`.

import * as SQLite from "expo-sqlite"

const DATABASE_NAME = "offline.db"

export interface Migration {
  /** Numéro strictement croissant (PRAGMA user_version). Les numéros 1 à 99 sont réservés au socle. */
  version: number
  up: (db: SQLite.SQLiteDatabase) => void
}

const CORE_MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS local_records (
          entity            TEXT    NOT NULL,
          local_id          TEXT    NOT NULL,
          server_id         TEXT,
          data              TEXT    NOT NULL,
          sync_status       TEXT    NOT NULL DEFAULT 'synced',
          created_at        INTEGER NOT NULL,
          updated_at        INTEGER NOT NULL,
          server_updated_at INTEGER,
          last_pushed_at    INTEGER,
          deleted_at        INTEGER,
          PRIMARY KEY (entity, local_id)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_local_records_server
          ON local_records (entity, server_id) WHERE server_id IS NOT NULL;

        CREATE TABLE IF NOT EXISTS sync_queue (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          entity          TEXT    NOT NULL,
          operation       TEXT    NOT NULL,
          entity_local_id TEXT    NOT NULL,
          payload         TEXT,
          status          TEXT    NOT NULL DEFAULT 'pending',
          attempts        INTEGER NOT NULL DEFAULT 0,
          last_error      TEXT,
          priority        INTEGER NOT NULL,
          created_at      INTEGER NOT NULL,
          updated_at      INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue (status, priority, id);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_record ON sync_queue (entity, entity_local_id);

        CREATE TABLE IF NOT EXISTS sync_meta (
          key   TEXT PRIMARY KEY,
          value TEXT
        );
      `)
    },
  },
]

const extraMigrations: Migration[] = []

/** Ajoute une migration propre à une entité (version ≥ 100). À appeler avant initializeDatabase(). */
export function registerMigration(migration: Migration) {
  if (migration.version < 100) throw new Error("Les versions 1 à 99 sont réservées aux migrations du socle hors ligne.")
  if (db) throw new Error("registerMigration doit être appelé avant initializeDatabase().")
  extraMigrations.push(migration)
}

let db: SQLite.SQLiteDatabase | null = null

/** Ouvre la base et applique les migrations manquantes. Sans effet si elle est déjà ouverte. */
export async function initializeDatabase(): Promise<void> {
  if (db) return
  const opened = SQLite.openDatabaseSync(DATABASE_NAME)
  opened.execSync("PRAGMA journal_mode = WAL;")

  const current = opened.getFirstSync<{ user_version: number }>("PRAGMA user_version")?.user_version ?? 0
  const pending = [...CORE_MIGRATIONS, ...extraMigrations].filter((m) => m.version > current).sort((a, b) => a.version - b.version)
  for (const migration of pending) {
    opened.withTransactionSync(() => {
      migration.up(opened)
      opened.execSync(`PRAGMA user_version = ${migration.version}`)
    })
  }
  db = opened
}

export function isDatabaseReady() {
  return db !== null
}

/** Base ouverte. Lève une erreur si initializeDatabase() n'a pas encore réussi. */
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error("Base hors ligne non initialisée : appelez initializeDatabase() au démarrage.")
  return db
}

/* ------------------------------------ sync_meta ------------------------------------ */

export function getMeta(key: string): string | null {
  return getDb().getFirstSync<{ value: string | null }>("SELECT value FROM sync_meta WHERE key = ?", key)?.value ?? null
}

export function setMeta(key: string, value: string | null) {
  if (value === null) getDb().runSync("DELETE FROM sync_meta WHERE key = ?", key)
  else getDb().runSync("INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, value)
}

/** Efface toutes les données locales (changement d'utilisateur). Les tables restent en place. */
export function wipeLocalData() {
  const database = getDb()
  database.withTransactionSync(() => {
    database.execSync("DELETE FROM local_records; DELETE FROM sync_queue; DELETE FROM sync_meta;")
  })
}
