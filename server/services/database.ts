import { PrismaClient } from "@prisma/client";
import type {
  Backtest,
  BacktestTrade as PrismaBacktestTrade,
  BacktestAnalysis as PrismaBacktestAnalysis,
  EquityCurvePoint as PrismaEquityCurvePoint,
  Prisma,
} from "@prisma/client";
import type { BacktestResult, Trade, AnalysisEntry, EquityCurvePoint } from "../types/trading.js";

class DatabaseService {
  private static instance: DatabaseService;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private handleError(operation: string, error: unknown): never {
    console.error(`[Database] Error ${operation}:`, error);
    throw error;
  }

  public async testConnection(): Promise<void> {
    try {
      await this.prisma.$connect();
      console.log("[Database] Connection successful");
    } catch (error) {
      this.handleError("testing connection", error);
    }
  }

  public async createBacktest(result: BacktestResult) {
    try {
      return await this.prisma.backtest.create({
        data: {
          symbol: result.symbol,
          timeframe: result.timeframe,
          startDate: new Date(result.start_date),
          endDate: new Date(result.end_date),
          initialBalance: result.initial_balance,
          finalBalance: result.final_balance,
          totalTrades: result.total_trades,
          winningTrades: result.winning_trades,
          losingTrades: result.losing_trades,
          winRate: result.win_rate,
          averageWin: result.average_win,
          averageLoss: result.average_loss,
          profitFactor: result.profit_factor,
          maxDrawdown: result.max_drawdown,
          maxDrawdownPercentage: result.max_drawdown_percentage,
        },
      });
    } catch (error) {
      this.handleError("creating backtest", error);
    }
  }

  public async addBacktestTrades(backtestId: number, trades: Trade[]) {
    try {
      await this.prisma.backtestTrade.createMany({
        data: trades.map((trade) => ({
          backtestId,
          symbol: trade.symbol,
          side: trade.side,
          entryPrice: trade.entry_price,
          stopLoss: trade.stop_loss,
          takeProfit: trade.take_profit,
          size: trade.size,
          entryTime: new Date(trade.entry_time),
          exitTime: trade.exit_time ? new Date(trade.exit_time) : null,
          exitPrice: trade.exit_price || null,
          pnl: trade.pnl || null,
          pnlPercentage: trade.pnl_percentage || null,
          reason: trade.reason || null,
        })),
      });
    } catch (error) {
      this.handleError("adding backtest trades", error);
    }
  }

  public async addBacktestAnalysis(backtestId: number, analysisHistory: AnalysisEntry[]) {
    try {
      await this.prisma.backtestAnalysis.createMany({
        data: analysisHistory.map((entry) => ({
          backtestId,
          timestamp: new Date(entry.timestamp),
          chartImage: entry.chart_image,
          analysisResult: entry.analysis_result as unknown as Prisma.JsonObject,
          technicalSignals: entry.technical_signals as unknown as Prisma.JsonObject,
        })),
      });
    } catch (error) {
      this.handleError("adding backtest analysis", error);
    }
  }

  public async addBacktestEquityCurve(backtestId: number, equityCurve: EquityCurvePoint[]) {
    try {
      await this.prisma.equityCurvePoint.createMany({
        data: equityCurve.map((point) => ({
          backtestId,
          timestamp: new Date(point.timestamp),
          balance: point.balance,
        })),
      });
    } catch (error) {
      this.handleError("adding backtest equity curve", error);
    }
  }

  public async getBacktest(backtestId: number): Promise<BacktestResult> {
    try {
      const backtest = await this.prisma.backtest.findUnique({
        where: { id: backtestId },
        include: {
          trades: true,
          analyses: true,
          equityCurve: true,
        },
      });

      if (!backtest) {
        throw new Error(`Backtest with id ${backtestId} not found`);
      }

      return {
        symbol: backtest.symbol,
        timeframe: backtest.timeframe,
        start_date: backtest.startDate.toISOString(),
        end_date: backtest.endDate.toISOString(),
        initial_balance: Number(backtest.initialBalance),
        final_balance: Number(backtest.finalBalance),
        total_trades: backtest.totalTrades,
        winning_trades: backtest.winningTrades,
        losing_trades: backtest.losingTrades,
        win_rate: Number(backtest.winRate),
        average_win: Number(backtest.averageWin),
        average_loss: Number(backtest.averageLoss),
        profit_factor: Number(backtest.profitFactor),
        max_drawdown: Number(backtest.maxDrawdown),
        max_drawdown_percentage: Number(backtest.maxDrawdownPercentage),
        trades: backtest.trades.map((trade) => ({
          symbol: trade.symbol,
          side: trade.side as "long" | "short",
          entry_price: Number(trade.entryPrice),
          stop_loss: Number(trade.stopLoss),
          take_profit: Number(trade.takeProfit),
          size: Number(trade.size),
          entry_time: trade.entryTime.toISOString(),
          exit_time: trade.exitTime?.toISOString(),
          exit_price: trade.exitPrice ? Number(trade.exitPrice) : undefined,
          pnl: trade.pnl ? Number(trade.pnl) : undefined,
          pnl_percentage: trade.pnlPercentage ? Number(trade.pnlPercentage) : undefined,
          reason: trade.reason || undefined,
        })),
        equity_curve: backtest.equityCurve.map((point) => ({
          timestamp: point.timestamp.toISOString(),
          balance: Number(point.balance),
        })),
        analysis_history: backtest.analyses.map((entry) => ({
          timestamp: entry.timestamp.toISOString(),
          chart_image: entry.chartImage,
          analysis_result: entry.analysisResult as unknown as AnalysisEntry["analysis_result"],
          technical_signals: entry.technicalSignals as unknown as AnalysisEntry["technical_signals"],
        })),
      };
    } catch (error) {
      this.handleError("getting backtest", error);
    }
  }

  public async getBacktests(): Promise<BacktestResult[]> {
    try {
      const backtests = await this.prisma.backtest.findMany({
        orderBy: { createdAt: "desc" },
      });

      return await Promise.all(backtests.map((backtest) => this.getBacktest(backtest.id)));
    } catch (error) {
      this.handleError("getting backtests", error);
    }
  }
}

export const database = DatabaseService.getInstance();
