import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

// 数据库连接
let db: Database | null = null;

// 初始化数据库
export async function initDatabase() {
  if (!db) {
    db = await open({
      filename: "./spy-game.db",
      driver: sqlite3.Database,
    });

    // 创建用户表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL
      );
    `);

    // 创建房间表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        host_id TEXT NOT NULL,
        status TEXT NOT NULL,
        good_word TEXT,
        bad_word TEXT,
        good_count INTEGER,
        bad_count INTEGER,
        blank_count INTEGER,
        max_players INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (host_id) REFERENCES users(id)
      );
    `);

    // 创建玩家表
    await db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        user_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        role TEXT,
        is_alive BOOLEAN DEFAULT 1,
        PRIMARY KEY (user_id, room_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      );
    `);

    console.log("Database initialized");
  }

  return db;
}

// 获取数据库实例
export function getDB() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}
