import { backtesting } from "../services/backtesting";
import { Bar } from "../types/trading";

describe("BacktestingService", () => {
  const mockBars: Bar[] = Array.from({ length: 100 }, (_, i) => ({
    timestamp: new Date(2024, 0, i + 1).toISOString(),
    open: 100 + i,
    high: 102 + i,
    low: 99 + i,
    close: 101 + i,
    volume: 1000000,
  }));

  const backTestOptions = {
    risk_per_trade: 1, // 1% risk per trade
    max_positions: 2, // Maximum 2 concurrent positions
    timeframe: "1d", // Daily timeframe
  };

  describe("EMA Pullback Strategy Backtest", () => {
    it("should run backtest and return valid results", async () => {
      const result = await backtesting.runBacktest("AAPL", mockBars, "ema_pullback", backTestOptions);

      // Verify backtest result structure
      expect(result).toHaveProperty("trades");
      expect(result).toHaveProperty("metrics");
      expect(result).toHaveProperty("equity_curve");

      // Verify metrics structure
      expect(result.metrics).toHaveProperty("total_trades");
      expect(result.metrics).toHaveProperty("winning_trades");
      expect(result.metrics).toHaveProperty("losing_trades");
      expect(result.metrics).toHaveProperty("win_rate");
      expect(result.metrics).toHaveProperty("average_win");
      expect(result.metrics).toHaveProperty("average_loss");
      expect(result.metrics).toHaveProperty("profit_factor");
      expect(result.metrics).toHaveProperty("max_drawdown");
      expect(result.metrics).toHaveProperty("sharpe_ratio");
      expect(result.metrics).toHaveProperty("total_return");

      // Verify trades have required properties
      if (result.trades.length > 0) {
        const trade = result.trades[0];
        expect(trade).toHaveProperty("symbol");
        expect(trade).toHaveProperty("entry_date");
        expect(trade).toHaveProperty("entry_price");
        expect(trade).toHaveProperty("size");
        expect(trade).toHaveProperty("side");
        expect(trade).toHaveProperty("stop_loss");
        expect(trade).toHaveProperty("take_profit");
        expect(trade).toHaveProperty("risk_percentage");
        expect(trade).toHaveProperty("status");
      }

      // Verify equity curve
      expect(result.equity_curve.length).toBeGreaterThan(0);
      expect(result.equity_curve[0]).toHaveProperty("date");
      expect(result.equity_curve[0]).toHaveProperty("equity");
    });
  });

  describe("Mean Reversion Strategy Backtest", () => {
    it("should run backtest and return valid results", async () => {
      const result = await backtesting.runBacktest("AAPL", mockBars, "mean_reversion", backTestOptions);

      // Verify backtest result structure
      expect(result).toHaveProperty("trades");
      expect(result).toHaveProperty("metrics");
      expect(result).toHaveProperty("equity_curve");

      // Verify metrics
      expect(result.metrics.total_trades).toBeGreaterThanOrEqual(0);
      expect(result.metrics.win_rate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.win_rate).toBeLessThanOrEqual(1);
      expect(result.metrics.max_drawdown).toBeGreaterThanOrEqual(0);
      expect(result.metrics.max_drawdown).toBeLessThanOrEqual(1);

      // Verify trades have correct side property for mean reversion
      result.trades.forEach((trade) => {
        expect(trade.side).toMatch(/^(buy|sell)$/);
      });
    });
  });

  describe("Risk Management in Backtesting", () => {
    it("should respect position limits", async () => {
      const result = await backtesting.runBacktest("AAPL", mockBars, "mean_reversion", {
        ...backTestOptions,
        max_positions: 1, // Limit to 1 position
      });

      // Check that we never have more than 1 open position at a time
      const openPositionsByBar = new Map<string, number>();

      result.trades.forEach((trade) => {
        const entryDate = trade.entry_date;
        const exitDate = trade.exit_date || result.equity_curve[result.equity_curve.length - 1].date;

        // Count open positions for each bar
        for (const point of result.equity_curve) {
          if (point.date >= entryDate && point.date <= exitDate) {
            const current = openPositionsByBar.get(point.date) || 0;
            openPositionsByBar.set(point.date, current + 1);
          }
        }
      });

      // Verify position limit
      Array.from(openPositionsByBar.values()).forEach((count) => {
        expect(count).toBeLessThanOrEqual(1);
      });
    });

    it("should respect risk per trade limit", async () => {
      const riskPerTrade = 0.5; // 0.5% risk per trade
      const result = await backtesting.runBacktest("AAPL", mockBars, "ema_pullback", {
        ...backTestOptions,
        risk_per_trade: riskPerTrade,
      });

      // Verify that no trade risks more than the specified percentage
      result.trades.forEach((trade) => {
        const riskAmount = Math.abs(trade.entry_price - trade.stop_loss) * trade.size;
        const accountValue = 100000; // Initial capital
        const riskPercentage = (riskAmount / accountValue) * 100;

        expect(riskPercentage).toBeLessThanOrEqual(riskPerTrade + 0.01); // Allow for small rounding differences
      });
    });
  });

  describe("Performance Metrics Calculation", () => {
    it("should calculate metrics correctly for a winning trade", async () => {
      // Create mock bars with a clear uptrend for a winning long trade
      const trendingBars: Bar[] = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(2024, 0, i + 1).toISOString(),
        open: 100 + i * 2,
        high: 102 + i * 2,
        low: 99 + i * 2,
        close: 101 + i * 2,
        volume: 1000000,
      }));

      const result = await backtesting.runBacktest(
        "AAPL",
        trendingBars,
        "ema_pullback", // EMA pullback should generate long trades in uptrend
        backTestOptions
      );

      if (result.trades.length > 0) {
        const profitableTrades = result.trades.filter((t) => t.profit_loss! > 0);
        expect(profitableTrades.length).toBeGreaterThan(0);

        if (profitableTrades.length > 0) {
          expect(result.metrics.average_win).toBeGreaterThan(0);
          expect(result.metrics.win_rate).toBeGreaterThan(0);
        }
      }
    });

    it("should calculate drawdown correctly", async () => {
      // Create mock bars with a drawdown period
      const drawdownBars: Bar[] = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(2024, 0, i + 1).toISOString(),
        open: 100 - (i < 50 ? i : 50 - (i - 50)), // Creates a V-shaped price movement
        high: 102 - (i < 50 ? i : 50 - (i - 50)),
        low: 99 - (i < 50 ? i : 50 - (i - 50)),
        close: 101 - (i < 50 ? i : 50 - (i - 50)),
        volume: 1000000,
      }));

      const result = await backtesting.runBacktest("AAPL", drawdownBars, "mean_reversion", backTestOptions);

      expect(result.metrics.max_drawdown).toBeGreaterThan(0);
      expect(result.metrics.max_drawdown).toBeLessThanOrEqual(1);
    });
  });
});
