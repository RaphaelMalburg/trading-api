CREATE TABLE "backtest_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"backtest_id" integer DEFAULT 0 NOT NULL,
	"timestamp" timestamp NOT NULL,
	"chart_image" text NOT NULL,
	"trend" text,
	"confidence" real,
	"action" text,
	"entry_price" real,
	"stop_loss" real,
	"take_profit" real,
	"reasoning" text,
	"risk_percentage" real,
	"support_levels" text,
	"resistance_levels" text,
	"patterns" text,
	"signals" text
);
--> statement-breakpoint
CREATE TABLE "backtest_equity_curve" (
	"id" serial PRIMARY KEY NOT NULL,
	"backtest_id" integer NOT NULL,
	"timestamp" timestamp NOT NULL,
	"balance" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backtest_trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"backtest_id" integer NOT NULL,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"entry_price" real NOT NULL,
	"stop_loss" real NOT NULL,
	"take_profit" real NOT NULL,
	"size" integer NOT NULL,
	"entry_time" timestamp NOT NULL,
	"exit_time" timestamp,
	"exit_price" real,
	"pnl" real,
	"pnl_percentage" real,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "backtests" (
	"id" serial PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"timeframe" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"initial_balance" real NOT NULL,
	"final_balance" real NOT NULL,
	"total_trades" integer NOT NULL,
	"winning_trades" integer NOT NULL,
	"losing_trades" integer NOT NULL,
	"win_rate" real NOT NULL,
	"average_win" real NOT NULL,
	"average_loss" real NOT NULL,
	"profit_factor" real NOT NULL,
	"max_drawdown" real NOT NULL,
	"max_drawdown_percentage" real NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "backtest_analysis" ADD CONSTRAINT "backtest_analysis_backtest_id_backtests_id_fk" FOREIGN KEY ("backtest_id") REFERENCES "public"."backtests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_equity_curve" ADD CONSTRAINT "backtest_equity_curve_backtest_id_backtests_id_fk" FOREIGN KEY ("backtest_id") REFERENCES "public"."backtests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_trades" ADD CONSTRAINT "backtest_trades_backtest_id_backtests_id_fk" FOREIGN KEY ("backtest_id") REFERENCES "public"."backtests"("id") ON DELETE cascade ON UPDATE no action;