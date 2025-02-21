import { aiAnalysis } from "./aiAnalysis.js";
import { getHistoricalBars } from "./alpaca.js";
import { generateAnalysisChart } from "./chartAnalysis.js";

interface Position {
  symbol: string;
  side: "long" | "short";
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  size: number;
  entry_time: Date;
  exit_time?: Date;
  exit_price?: number;
  pnl?: number;
  pnl_percentage?: number;
  reason?: string;
}

interface BacktestResult {
  symbol: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  initial_balance: number;
  final_balance: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  average_win: number;
  average_loss: number;
  profit_factor: number;
  max_drawdown: number;
  max_drawdown_percentage: number;
  trades: Position[];
  equity_curve: { timestamp: string; balance: number }[];
  analysis_history: {
    timestamp: string;
    chart_image: string; // base64 encoded image
    analysis_result: any;
  }[];
}

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
    riskPerTrade: number = 0.01
  ): Promise<BacktestResult> {
    try {
      console.log(`[Backtest] Starting backtest for ${symbol}`);
      console.log(`[Backtest] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Validate dates
      if (startDate > endDate) {
        throw new Error("Start date must be before end date");
      }

      // Get historical bars
      const bars = await getHistoricalBars(symbol, timeframe, undefined, startDate, endDate);

      // Validate we have enough bars
      if (bars.length < 60) {
        throw new Error(`Insufficient historical data. Need at least 60 bars, but got ${bars.length}. This could be due to market holidays or limited market hours.`);
      }

      // Log bar timestamps for debugging
      console.log(`[Backtest] First bar timestamp: ${new Date(bars[0].timestamp).toISOString()}`);
      console.log(`[Backtest] Last bar timestamp: ${new Date(bars[bars.length - 1].timestamp).toISOString()}`);
      console.log(`[Backtest] Total bars: ${bars.length}`);

      const positions: Position[] = [];
      const equityCurve: { timestamp: string; balance: number }[] = [];
      let balance = initialBalance;
      const analysisHistory: { timestamp: string; chart_image: string; analysis_result: any }[] = [];

      console.log(`[Backtest] Processing ${bars.length} bars in batches`);
      const batchSize = 5; // Process 5 bars at a time
      const delay = 2000; // 2 second delay between batches

      // Process bars in batches
      for (let i = 60; i < bars.length; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, bars.length);
        console.log(`[Backtest] Processing batch ${i / batchSize + 1}/${Math.ceil((bars.length - 60) / batchSize)}`);

        // Process each bar in the current batch
        for (let j = i; j < batchEnd; j++) {
          const currentBar = bars[j];
          console.log(`[Backtest] Processing bar ${j}/${bars.length - 1}: ${currentBar.timestamp}`);

          // Update open positions
          await this.updateOpenPositions(positions, currentBar, balance);

          // Generate chart and analyze
          try {
            // Get the last 60 bars for analysis
            const analysisWindow = bars.slice(j - 60, j + 1);
            console.log(`[Backtest] Generating chart for analysis window of ${analysisWindow.length} bars`);

            const chartImage = await generateAnalysisChart(analysisWindow, symbol);
            console.log(`[Backtest] Chart generated, size: ${chartImage.length} bytes`);

            const analysis = await aiAnalysis.analyzeChart(symbol, timeframe, balance, positions);
            console.log(`[Backtest] AI Analysis completed with confidence: ${analysis.confidence}`);

            // Save analysis history
            analysisHistory.push({
              timestamp: currentBar.timestamp,
              chart_image: chartImage.toString("base64"),
              analysis_result: analysis,
            });

            console.log(`[Backtest] Analysis history entry added for ${currentBar.timestamp}`);
            console.log(`[Backtest] Current analysis history size: ${analysisHistory.length}`);

            // Execute trades based on analysis
            if (positions.length < 3 && analysis.recommendation.action !== "hold" && analysis.confidence >= 75) {
              const position = await this.executePosition(symbol, analysis, currentBar, balance, riskPerTrade);
              if (position) {
                positions.push(position);
                console.log(`[Backtest] Opened new position:`, { side: position.side, entry_price: position.entry_price, size: position.size });
              }
            }
          } catch (error) {
            console.error(`[Backtest] Error analyzing bar ${currentBar.timestamp}:`, error);
          }

          // Update equity curve
          balance = this.calculateCurrentBalance(balance, positions);
          equityCurve.push({ timestamp: currentBar.timestamp, balance });
        }

        // Add delay between batches
        if (batchEnd < bars.length) {
          console.log(`[Backtest] Waiting ${delay}ms before next batch...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      // Close any remaining positions
      this.closeAllPositions(positions, bars[bars.length - 1]);

      // Calculate final statistics
      const stats = this.calculateStatistics(positions, initialBalance, balance, equityCurve);

      console.log(`[Backtest] Completed backtest for ${symbol}:`, { total_trades: positions.length, win_rate: stats.win_rate, profit_factor: stats.profit_factor });
      console.log(`[Backtest] Analysis history entries: ${analysisHistory.length}`);

      return {
        symbol,
        timeframe,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        initial_balance: initialBalance,
        final_balance: Number(balance),
        ...stats,
        trades: positions,
        equity_curve: equityCurve,
        analysis_history: analysisHistory,
      };
    } catch (error) {
      console.error(`[Backtest] Error running backtest:`, error);
      throw error;
    }
  }

  private async updateOpenPositions(positions: Position[], currentBar: any, balance: number): Promise<void> {
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

  private async executePosition(symbol: string, analysis: any, currentBar: any, balance: number, riskPerTrade: number): Promise<Position | null> {
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
      entry_time: new Date(currentBar.timestamp),
    };
  }

  private async closePosition(position: Position, exitPrice: number, exitTime: string, reason: string, balance: number): Promise<void> {
    position.exit_price = exitPrice;
    position.exit_time = new Date(exitTime);
    position.reason = reason;

    // Calculate P&L
    const pnl = position.side === "long" ? (exitPrice - position.entry_price) * position.size : (position.entry_price - exitPrice) * position.size;

    position.pnl = pnl;
    position.pnl_percentage = (pnl / balance) * 100;
  }

  private calculateCurrentBalance(balance: number, positions: Position[]): number {
    return positions.reduce((acc, pos) => acc + (pos.pnl || 0), balance);
  }

  private calculateStatistics(positions: Position[], initialBalance: number, finalBalance: number, equityCurve: { timestamp: string; balance: number }[]): any {
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
      if (point.balance > peak) {
        peak = point.balance;
      }
      const drawdown = peak - point.balance;
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
      win_rate: winningTrades.length / closedPositions.length,
      average_win: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      average_loss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
      profit_factor: totalLosses > 0 ? totalWins / totalLosses : totalWins,
      max_drawdown: maxDrawdown,
      max_drawdown_percentage: maxDrawdownPercentage,
    };
  }

  private closeAllPositions(positions: Position[], lastBar: any): void {
    positions.forEach((position) => {
      if (!position.exit_time) {
        this.closePosition(position, lastBar.close, lastBar.timestamp, "end_of_backtest", 0);
      }
    });
  }
}

export const backtesting = BacktestingService.getInstance();
