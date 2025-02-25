ALTER TABLE "backtest_analysis" DROP CONSTRAINT "backtest_analysis_backtest_id_backtests_id_fk";
--> statement-breakpoint
ALTER TABLE "backtest_equity_curve" DROP CONSTRAINT "backtest_equity_curve_backtest_id_backtests_id_fk";
--> statement-breakpoint
ALTER TABLE "backtest_trades" DROP CONSTRAINT "backtest_trades_backtest_id_backtests_id_fk";
--> statement-breakpoint
ALTER TABLE "backtest_analysis" ALTER COLUMN "backtest_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "backtest_equity_curve" ALTER COLUMN "balance" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtest_trades" ALTER COLUMN "entry_price" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtest_trades" ALTER COLUMN "stop_loss" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtest_trades" ALTER COLUMN "take_profit" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtest_trades" ALTER COLUMN "size" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtest_trades" ALTER COLUMN "exit_price" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtest_trades" ALTER COLUMN "pnl" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtest_trades" ALTER COLUMN "pnl_percentage" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtests" ALTER COLUMN "initial_balance" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtests" ALTER COLUMN "final_balance" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtests" ALTER COLUMN "win_rate" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtests" ALTER COLUMN "average_win" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtests" ALTER COLUMN "average_loss" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtests" ALTER COLUMN "profit_factor" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtests" ALTER COLUMN "max_drawdown" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtests" ALTER COLUMN "max_drawdown_percentage" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "backtest_analysis" ADD COLUMN "analysis_result" json NOT NULL;--> statement-breakpoint
ALTER TABLE "backtest_analysis" ADD COLUMN "technical_signals" json NOT NULL;--> statement-breakpoint
ALTER TABLE "backtest_analysis" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "backtest_equity_curve" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "backtest_trades" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "backtest_analysis" ADD CONSTRAINT "backtest_analysis_backtest_id_backtests_id_fk" FOREIGN KEY ("backtest_id") REFERENCES "public"."backtests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_equity_curve" ADD CONSTRAINT "backtest_equity_curve_backtest_id_backtests_id_fk" FOREIGN KEY ("backtest_id") REFERENCES "public"."backtests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_trades" ADD CONSTRAINT "backtest_trades_backtest_id_backtests_id_fk" FOREIGN KEY ("backtest_id") REFERENCES "public"."backtests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backtest_analysis" DROP COLUMN "trend";--> statement-breakpoint
ALTER TABLE "backtest_analysis" DROP COLUMN "confidence";--> statement-breakpoint
ALTER TABLE "backtest_analysis" DROP COLUMN "action";--> statement-breakpoint
ALTER TABLE "backtest_analysis" DROP COLUMN "entry_price";--> statement-breakpoint
ALTER TABLE "backtest_analysis" DROP COLUMN "stop_loss";--> statement-breakpoint
ALTER TABLE "backtest_analysis" DROP COLUMN "take_profit";--> statement-breakpoint
ALTER TABLE "backtest_analysis" DROP COLUMN "reasoning";--> statement-breakpoint
ALTER TABLE "backtest_analysis" DROP COLUMN "risk_percentage";--> statement-breakpoint
ALTER TABLE "backtest_analysis" DROP COLUMN "support_levels";--> statement-breakpoint
ALTER TABLE "backtest_analysis" DROP COLUMN "resistance_levels";--> statement-breakpoint
ALTER TABLE "backtest_analysis" DROP COLUMN "patterns";--> statement-breakpoint
ALTER TABLE "backtest_analysis" DROP COLUMN "signals";