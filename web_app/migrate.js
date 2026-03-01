import Database from 'better-sqlite3';

const db = new Database('./data/asset_manager.db', { verbose: console.log });
db.pragma('journal_mode = WAL');

try {
  // Disable foreign keys so we can drop the referenced assets table
  db.pragma('foreign_keys=OFF');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS new_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('stock', 'pension', 'cash', 'real_estate')),
        region TEXT DEFAULT 'KR',
        symbol TEXT,
        name TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 0,
        avgPrice REAL NOT NULL DEFAULT 0,
        principal REAL NOT NULL DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(type, region, symbol, name)
      );
      INSERT INTO new_assets SELECT * FROM assets;
      DROP TABLE assets;
      ALTER TABLE new_assets RENAME TO assets;
    `);
  })();
  // Re-enable foreign keys
  db.pragma('foreign_keys=ON');
  console.log("Migration successful");
} catch (e) {
  console.error("Migration failed:", e);
}
