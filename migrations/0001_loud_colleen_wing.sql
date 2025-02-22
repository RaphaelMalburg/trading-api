ALTER TABLE "backtest_analysis" DROP CONSTRAINT "backtest_analysis_backtest_id_backtests_id_fk";
--> statement-breakpoint
ALTER TABLE "backtest_analysis" ALTER COLUMN "backtest_id" DROP NOT NULL;