import { aiAnalysis } from "./aiAnalysis.js";
import { getHistoricalBars } from "./alpaca.js";
import { generateAnalysisChart } from "./chartAnalysis.js";
import { database } from "./database.js";
import type { BacktestResult, Trade } from "../types/trading.js";
import { technicalAnalysis } from "./technicalAnalysis.js";

class BacktestingService {
  private static instance: BacktestingService;

  private constructor() {}

  public static getInstance(): BacktestingService {
    if (!BacktestingService.instance) {
      BacktestingService.instance = new BacktestingService();
    }
    return BacktestingService.instance;
  }

  public async runBacktest(
    symbol: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
    initialBalance: number = 100000,
    riskPerTrade: number = 0.01,
    quickDevelopmentMode: boolean = false
  ): Promise<BacktestResult> {
    try {
      // Enhanced date logging
      console.log("\n===========================================");
      console.log("           BACKTEST DATE INFO              ");
      console.log("===========================================");
      console.log(`TODAY'S DATE: ${new Date("2025-02-25").toISOString()}`);
      console.log(`TEST PERIOD: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      console.log("===========================================\n");

      // Validate dates
      if (startDate > endDate) {
        throw new Error("Start date must be before end date");
      }

      // Get historical bars
      const bars = await getHistoricalBars(symbol, timeframe, quickDevelopmentMode ? 20 : 200);

      // Filter bars to match date range
      const filteredBars = bars.filter((bar) => {
        const barDate = new Date(bar.timestamp);
        return barDate >= startDate && barDate <= endDate;
      });

      // Log filtered bars count
      console.log(`[Backtest] Processing ${filteredBars.length} bars for analysis`);

      // Ensure we have at least some data
      if (filteredBars.length === 0) {
        throw new Error("No data available for the specified date range. This could be due to market holidays or limited market hours.");
      }

      const positions: Trade[] = [];
      const equityCurve: { timestamp: string; balance: number }[] = [{ timestamp: filteredBars[0].timestamp, balance: initialBalance }];
      let balance = initialBalance;
      const analysisHistory: { timestamp: string; chart_image: string; analysis_result: any; technical_signals: any }[] = [];

      // Process each bar
      const startIndex = quickDevelopmentMode ? Math.min(10, filteredBars.length - 1) : Math.min(20, filteredBars.length - 1);
      const maxAnalyses = quickDevelopmentMode ? Math.min(10, filteredBars.length) : filteredBars.length;
      let analysisCount = 0;

      for (let i = startIndex; i < filteredBars.length && analysisCount < maxAnalyses; i++) {
        const currentBar = filteredBars[i];

        // Update open positions
        await this.updateOpenPositions(positions, currentBar, balance);

        try {
          // Get the last available bars for analysis
          const analysisWindow = filteredBars.slice(Math.max(0, i - (quickDevelopmentMode ? 10 : 20)), i + 1);
          const chartImage = await generateAnalysisChart(analysisWindow, symbol);

          // Calculate technical signals
          const technicalSignals = await technicalAnalysis.analyzeMarket(analysisWindow);

          const analysis = await aiAnalysis.analyzeChart(symbol, timeframe, balance, positions, technicalSignals);

          // Save analysis history
          analysisHistory.push({
            timestamp: currentBar.timestamp,
            chart_image: chartImage.toString("base64"),
            analysis_result: analysis,
            technical_signals: technicalSignals,
          });
          analysisCount++;

          // Execute trades based on analysis
          if (positions.length < 3 && analysis.recommendation.action !== "hold" && analysis.confidence >= 75) {
            const position = await this.executePosition(symbol, analysis, currentBar, balance, riskPerTrade);
            if (position) {
              positions.push(position);
            }
          }
        } catch (error) {
          console.error(`[Backtest] Analysis error at ${currentBar.timestamp}:`, error);
        }

        // Update equity curve
        balance = this.calculateCurrentBalance(balance, positions);
        equityCurve.push({ timestamp: currentBar.timestamp, balance });

        // Break early if in quick development mode and we've done enough analyses
        if (quickDevelopmentMode && analysisCount >= 10) {
          break;
        }
      }

      // Close any remaining positions
      this.closeAllPositions(positions, filteredBars[filteredBars.length - 1]);

      // Calculate final statistics
      const stats = this.calculateStatistics(positions, initialBalance, balance, equityCurve);

      const result: BacktestResult = {
        symbol,
        timeframe,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        initial_balance: Number(initialBalance),
        final_balance: Number(balance),
        total_trades: stats.total_trades,
        winning_trades: stats.winning_trades,
        losing_trades: stats.losing_trades,
        win_rate: Number(stats.win_rate),
        average_win: Number(stats.average_win),
        average_loss: Number(stats.average_loss),
        profit_factor: Number(stats.profit_factor),
        max_drawdown: Number(stats.max_drawdown),
        max_drawdown_percentage: Number(stats.max_drawdown_percentage),
        trades: positions,
        equity_curve: equityCurve,
        analysis_history: analysisHistory,
      };

      try {
        // Store results in database
        const backtest = await database.createBacktest(result);

        // Only try to add trades if there are any
        if (positions.length > 0) {
          await database.addBacktestTrades(backtest.id, result.trades);
        }

        // Add analysis and equity curve data
        await database.addBacktestAnalysis(backtest.id, result.analysis_history);
        await database.addBacktestEquityCurve(backtest.id, result.equity_curve);

        console.log(`[Backtest] ====== Completed Successfully ======`);
        console.log(`[Backtest] Summary for ${symbol}:`, {
          trades: positions.length,
          win_rate: (stats.win_rate * 100).toFixed(1) + "%",
          profit_factor: stats.profit_factor.toFixed(2),
          final_balance: "$" + balance.toFixed(2),
        });

        return result;
      } catch (error) {
        console.error("[Backtest] Database error:", error);
        throw new Error("Failed to save backtest results to database");
      }
    } catch (error) {
      console.error(`[Backtest] Error:`, error);
      throw error;
    }
  }

  private async updateOpenPositions(positions: Trade[], currentBar: any, balance: number): Promise<void> {
    for (const position of positions) {
      // Check stop loss
      if (position.side === "long" && currentBar.low <= position.stop_loss) {
        await this.closePosition(position, position.stop_loss, currentBar.timestamp, "stop_loss", balance);
      } else if (position.side === "short" && currentBar.high >= position.stop_loss) {
        await this.closePosition(position, position.stop_loss, currentBar.timestamp, "stop_loss", balance);
      }

      // Check take profit
      if (position.side === "long" && currentBar.high >= position.take_profit) {
        await this.closePosition(position, position.take_profit, currentBar.timestamp, "take_profit", balance);
      } else if (position.side === "short" && currentBar.low <= position.take_profit) {
        await this.closePosition(position, position.take_profit, currentBar.timestamp, "take_profit", balance);
      }
    }

    // Remove closed positions
    positions.splice(0, positions.length, ...positions.filter((p) => !p.exit_time));
  }

  private async executePosition(symbol: string, analysis: any, currentBar: any, balance: number, riskPerTrade: number): Promise<Trade | null> {
    const { action, entry_price, stop_loss, take_profit, risk_percentage } = analysis.recommendation;

    if (!entry_price || !stop_loss || !take_profit) {
      return null;
    }

    const riskAmount = balance * (risk_percentage || riskPerTrade);
    const riskPerShare = Math.abs(entry_price - stop_loss);
    const positionSize = Math.floor(riskAmount / riskPerShare);

    return {
      symbol,
      side: action === "buy" ? "long" : "short",
      entry_price,
      stop_loss,
      take_profit,
      size: positionSize,
      entry_time: currentBar.timestamp,
    };
  }

  private async closePosition(position: Trade, exitPrice: number, exitTime: string, reason: string, balance: number): Promise<void> {
    position.exit_price = exitPrice;
    position.exit_time = exitTime;
    position.reason = reason;

    // Calculate P&L
    const pnl = position.side === "long" ? (exitPrice - position.entry_price) * position.size : (position.entry_price - exitPrice) * position.size;

    position.pnl = pnl;
    position.pnl_percentage = (pnl / balance) * 100;
  }

  private calculateCurrentBalance(balance: number, positions: Trade[]): number {
    return positions.reduce((acc, pos) => acc + (pos.pnl || 0), balance);
  }

  private calculateStatistics(positions: Trade[], initialBalance: number, finalBalance: number, equityCurve: { timestamp: string; balance: number }[]): any {
    const closedPositions = positions.filter((p) => p.exit_price !== undefined);
    const winningTrades = closedPositions.filter((p) => (p.pnl || 0) > 0);
    const losingTrades = closedPositions.filter((p) => (p.pnl || 0) <= 0);

    const totalWins = winningTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0));

    // Calculate max drawdown
    let maxDrawdown = 0;
    let maxDrawdownPercentage = 0;
    let peak = initialBalance;

    equityCurve.forEach((point) => {
      const balance = Number(point.balance);
      if (balance > peak) {
        peak = balance;
      }
      const drawdown = peak - balance;
      const drawdownPercentage = (drawdown / peak) * 100;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercentage = drawdownPercentage;
      }
    });

    return {
      total_trades: closedPositions.length,
      winning_trades: winningTrades.length,
      losing_trades: losingTrades.length,
      win_rate: winningTrades.length / (closedPositions.length || 1),
      average_win: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      average_loss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
      profit_factor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
      max_drawdown: maxDrawdown,
      max_drawdown_percentage: maxDrawdownPercentage,
    };
  }

  private closeAllPositions(positions: Trade[], lastBar: any): void {
    positions.forEach((position) => {
      if (!position.exit_time) {
        this.closePosition(position, lastBar.close, lastBar.timestamp, "end_of_backtest", 0);
      }
    });
  }
}

export const backtesting = BacktestingService.getInstance();
