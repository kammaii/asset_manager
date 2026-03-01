import Database from 'better-sqlite3';

const db = new Database('./data/asset_manager.db', { verbose: console.log });
db.pragma('journal_mode = WAL');

// Initialize database tables
const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
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

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER,
      action TEXT NOT NULL CHECK (action IN ('buy', 'sell')),
      date TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(asset_id) REFERENCES assets(id)
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,
      totalValue REAL NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

initDb();

export default db;
