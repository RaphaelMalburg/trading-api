import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import dotenv from "dotenv";

dotenv.config();

const runMigrations = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in environment variables");
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  console.log("Running migrations...");

  try {
    // Create backtests table
    await sql`
      CREATE TABLE IF NOT EXISTS backtests (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        initial_balance REAL NOT NULL,
        final_balance REAL NOT NULL,
        total_trades INTEGER NOT NULL,
        winning_trades INTEGER NOT NULL,
        losing_trades INTEGER NOT NULL,
        win_rate REAL NOT NULL,
        average_win REAL NOT NULL,
        average_loss REAL NOT NULL,
        profit_factor REAL NOT NULL,
        max_drawdown REAL NOT NULL,
        max_drawdown_percentage REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create backtest_trades table
    await sql`
      CREATE TABLE IF NOT EXISTS backtest_trades (
        id SERIAL PRIMARY KEY,
        backtest_id INTEGER NOT NULL REFERENCES backtests(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        entry_price REAL NOT NULL,
        stop_loss REAL NOT NULL,
        take_profit REAL NOT NULL,
        size INTEGER NOT NULL,
        entry_time TIMESTAMP NOT NULL,
        exit_time TIMESTAMP,
        exit_price REAL,
        pnl REAL,
        pnl_percentage REAL,
        reason TEXT
      )
    `;

    // Create backtest_analysis table
    await sql`
      CREATE TABLE IF NOT EXISTS backtest_analysis (
        id SERIAL PRIMARY KEY,
        backtest_id INTEGER NOT NULL REFERENCES backtests(id) ON DELETE CASCADE,
        timestamp TIMESTAMP NOT NULL,
        chart_image TEXT NOT NULL,
        trend TEXT,
        confidence REAL,
        action TEXT,
        entry_price REAL,
        stop_loss REAL,
        take_profit REAL,
        reasoning TEXT,
        risk_percentage REAL,
        support_levels TEXT,
        resistance_levels TEXT,
        patterns TEXT,
        signals TEXT
      )
    `;

    // Create backtest_equity_curve table
    await sql`
      CREATE TABLE IF NOT EXISTS backtest_equity_curve (
        id SERIAL PRIMARY KEY,
        backtest_id INTEGER NOT NULL REFERENCES backtests(id) ON DELETE CASCADE,
        timestamp TIMESTAMP NOT NULL,
        balance REAL NOT NULL
      )
    `;

    console.log("Migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
};

runMigrations().catch((err) => {
  console.error("Migration failed!", err);
  process.exit(1);
});
