import { pgTable, serial, text, timestamp, real, integer } from "drizzle-orm/pg-core";

export const backtests = pgTable("backtests", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  initialBalance: real("initial_balance").notNull(),
  finalBalance: real("final_balance").notNull(),
  totalTrades: integer("total_trades").notNull(),
  winningTrades: integer("winning_trades").notNull(),
  losingTrades: integer("losing_trades").notNull(),
  winRate: real("win_rate").notNull(),
  averageWin: real("average_win").notNull(),
  averageLoss: real("average_loss").notNull(),
  profitFactor: real("profit_factor").notNull(),
  maxDrawdown: real("max_drawdown").notNull(),
  maxDrawdownPercentage: real("max_drawdown_percentage").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const backtestTrades = pgTable("backtest_trades", {
  id: serial("id").primaryKey(),
  backtestId: integer("backtest_id")
    .references(() => backtests.id, { onDelete: "cascade" })
    .notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  entryPrice: real("entry_price").notNull(),
  stopLoss: real("stop_loss").notNull(),
  takeProfit: real("take_profit").notNull(),
  size: integer("size").notNull(),
  entryTime: timestamp("entry_time").notNull(),
  exitTime: timestamp("exit_time"),
  exitPrice: real("exit_price"),
  pnl: real("pnl"),
  pnlPercentage: real("pnl_percentage"),
  reason: text("reason"),
});

export const backtestAnalysis = pgTable("backtest_analysis", {
  id: serial("id").primaryKey(),
  backtestId: integer("backtest_id")
    .references(() => backtests.id, { onDelete: "cascade" })
    .notNull(),
  timestamp: timestamp("timestamp").notNull(),
  chartImage: text("chart_image").notNull(),
  trend: text("trend"),
  confidence: real("confidence"),
  action: text("action"),
  entryPrice: real("entry_price"),
  stopLoss: real("stop_loss"),
  takeProfit: real("take_profit"),
  reasoning: text("reasoning"),
  riskPercentage: real("risk_percentage"),
  supportLevels: text("support_levels"), // Store as JSON string
  resistanceLevels: text("resistance_levels"), // Store as JSON string
  patterns: text("patterns"), // Store as JSON string
  signals: text("signals"), // Store as JSON string
});

export const backtestEquityCurve = pgTable("backtest_equity_curve", {
  id: serial("id").primaryKey(),
  backtestId: integer("backtest_id")
    .references(() => backtests.id, { onDelete: "cascade" })
    .notNull(),
  timestamp: timestamp("timestamp").notNull(),
  balance: real("balance").notNull(),
});
