import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { backtests, backtestTrades, backtestAnalysis, backtestEquityCurve } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import type { BacktestResult, Trade, AnalysisEntry, EquityCurvePoint } from "../types/trading.js";
import type { InferInsertModel } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

export class DatabaseService {
  private static instance: DatabaseService;

  private constructor() {
    // Initialize standalone backtest record
    this.ensureStandaloneBacktest().catch((error) => {
      console.error("[Database] Error ensuring standalone backtest:", error);
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private async ensureStandaloneBacktest() {
    try {
      // Check if standalone backtest exists
      const existing = await db.select().from(backtests).where(eq(backtests.id, 0));

      if (existing.length === 0) {
        // Create standalone backtest record
        await db.insert(backtests).values({
          id: 0,
          symbol: "STANDALONE",
          timeframe: "NONE",
          startDate: new Date(),
          endDate: new Date(),
          initialBalance: 0,
          finalBalance: 0,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          averageWin: 0,
          averageLoss: 0,
          profitFactor: 0,
          maxDrawdown: 0,
          maxDrawdownPercentage: 0,
        });
        console.log("[Database] Created standalone backtest record");
      }
    } catch (error) {
      console.error("[Database] Error creating standalone backtest:", error);
      throw error;
    }
  }

  public async testConnection(): Promise<string> {
    try {
      const result = await sql`SELECT version()`;
      return result[0]?.version || "Unknown version";
    } catch (error) {
      console.error("[Database] Connection test failed:", error);
      throw error;
    }
  }

  public async findTrades() {
    try {
      return await db.select().from(backtests);
    } catch (error) {
      console.error("[Database] Find trades failed:", error);
      throw error;
    }
  }

  public async insertTrade(data: InferInsertModel<typeof backtests>) {
    try {
      const [trade] = await db.insert(backtests).values(data).returning();
      return trade;
    } catch (error) {
      console.error("[Database] Insert trade failed:", error);
      throw error;
    }
  }

  public async deleteTrade(id: number) {
    try {
      await db.delete(backtests).where(eq(backtests.id, id));
    } catch (error) {
      console.error("[Database] Delete trade failed:", error);
      throw error;
    }
  }

  async createBacktest(data: BacktestResult) {
    try {
      const [backtest] = await db
        .insert(backtests)
        .values({
          symbol: data.symbol,
          timeframe: data.timeframe,
          startDate: new Date(data.start_date),
          endDate: new Date(data.end_date),
          initialBalance: data.initial_balance,
          finalBalance: data.final_balance,
          totalTrades: data.total_trades,
          winningTrades: data.winning_trades,
          losingTrades: data.losing_trades,
          winRate: data.win_rate,
          averageWin: data.average_win,
          averageLoss: data.average_loss,
          profitFactor: data.profit_factor,
          maxDrawdown: data.max_drawdown,
          maxDrawdownPercentage: data.max_drawdown_percentage,
        })
        .returning();

      return backtest;
    } catch (error) {
      console.error("[Backtest DB] Error creating backtest:", error);
      throw error;
    }
  }

  async addBacktestTrades(backtestId: number, trades: Trade[]) {
    try {
      if (!trades || trades.length === 0) {
        console.log("[Backtest DB] No trades to insert");
        return;
      }

      const tradesToInsert = trades.map((trade) => ({
        backtestId,
        symbol: trade.symbol,
        side: trade.side,
        entryPrice: trade.entry_price,
        stopLoss: trade.stop_loss,
        takeProfit: trade.take_profit,
        size: trade.size,
        entryTime: new Date(trade.entry_time),
        exitTime: trade.exit_time ? new Date(trade.exit_time) : null,
        exitPrice: trade.exit_price,
        pnl: trade.pnl,
        pnlPercentage: trade.pnl_percentage,
        reason: trade.reason,
      }));

      await db.insert(backtestTrades).values(tradesToInsert);
    } catch (error) {
      console.error("[Backtest DB] Error adding trades:", error);
      throw error;
    }
  }

  async addBacktestAnalysis(backtestId: number, analyses: AnalysisEntry[]) {
    try {
      const analysesToInsert = analyses.map((analysis) => {
        // Log the incoming analysis data
        console.log("[Database] Processing analysis for insertion:", {
          timestamp: analysis.timestamp,
          hasImage: !!analysis.chart_image,
          imageLength: analysis.chart_image?.length,
          analysisResult: {
            trend: analysis.analysis_result?.trend,
            confidence: analysis.analysis_result?.confidence,
            action: analysis.analysis_result?.recommendation?.action,
          },
        });

        return {
          backtestId,
          timestamp: new Date(analysis.timestamp),
          chart_image: analysis.chart_image,
          trend: analysis.analysis_result?.trend,
          confidence: analysis.analysis_result?.confidence,
          action: analysis.analysis_result?.recommendation?.action,
          entryPrice: analysis.analysis_result?.recommendation?.entry_price,
          stopLoss: analysis.analysis_result?.recommendation?.stop_loss,
          takeProfit: analysis.analysis_result?.recommendation?.take_profit,
          reasoning: analysis.analysis_result?.recommendation?.reasoning,
          riskPercentage: analysis.analysis_result?.recommendation?.risk_percentage,
          supportLevels: JSON.stringify(analysis.analysis_result?.key_levels?.support || []),
          resistanceLevels: JSON.stringify(analysis.analysis_result?.key_levels?.resistance || []),
          patterns: JSON.stringify(analysis.analysis_result?.patterns || []),
          signals: JSON.stringify(analysis.analysis_result?.signals || {}),
        };
      });

      await db.insert(backtestAnalysis).values(analysesToInsert);
    } catch (error) {
      console.error("[Backtest DB] Error adding analyses:", error);
      throw error;
    }
  }

  async addBacktestEquityCurve(backtestId: number, equityCurve: EquityCurvePoint[]) {
    try {
      const pointsToInsert = equityCurve.map((point) => ({
        backtestId,
        timestamp: new Date(point.timestamp),
        balance: point.balance,
      }));

      await db.insert(backtestEquityCurve).values(pointsToInsert);
    } catch (error) {
      console.error("[Backtest DB] Error adding equity curve:", error);
      throw error;
    }
  }

  async getBacktestById(id: number) {
    try {
      const backtest = await db.select().from(backtests).where(eq(backtests.id, id)).limit(1);

      if (!backtest.length) return null;

      const trades = await db.select().from(backtestTrades).where(eq(backtestTrades.backtestId, id));

      const analyses = await db.select().from(backtestAnalysis).where(eq(backtestAnalysis.backtestId, id));

      const equityCurve = await db.select().from(backtestEquityCurve).where(eq(backtestEquityCurve.backtestId, id));

      return {
        ...backtest[0],
        trades,
        analyses,
        equityCurve,
      };
    } catch (error) {
      console.error("[Backtest DB] Error fetching backtest:", error);
      throw error;
    }
  }

  async getAllBacktests() {
    try {
      return await db.select().from(backtests).orderBy(desc(backtests.createdAt));
    } catch (error) {
      console.error("[Backtest DB] Error fetching all backtests:", error);
      throw error;
    }
  }

  async getAllAnalyses() {
    try {
      console.log("[Database] Fetching all analyses...");
      const analyses = await db
        .select()
        .from(backtestAnalysis)
        .where(eq(backtestAnalysis.backtestId, 0)) // Get standalone analyses
        .orderBy(desc(backtestAnalysis.timestamp));

      // Log raw data from database
      if (analyses.length > 0) {
        console.log("[Database] First analysis raw data:", {
          id: analyses[0].id,
          hasImage: !!analyses[0].chart_image,
          imageLength: analyses[0].chart_image?.length,
          allFields: Object.keys(analyses[0]),
          trend: analyses[0].trend,
          confidence: analyses[0].confidence,
          action: analyses[0].action,
        });
      }

      return analyses.map((analysis) => {
        // Log each analysis transformation
        console.log("[Database] Processing analysis:", {
          id: analysis.id,
          hasImage: !!analysis.chart_image,
          imageLength: analysis.chart_image?.length,
          trend: analysis.trend,
          confidence: analysis.confidence,
          action: analysis.action,
        });

        // Transform the data to match the frontend's expected structure
        const transformedAnalysis = {
          id: analysis.id,
          timestamp: analysis.timestamp,
          chart_image: analysis.chart_image,
          trend: analysis.trend,
          confidence: analysis.confidence,
          key_levels: {
            support: JSON.parse(analysis.supportLevels || "[]"),
            resistance: JSON.parse(analysis.resistanceLevels || "[]"),
          },
          signals: JSON.parse(analysis.signals || "{}"),
          recommendation: {
            action: analysis.action,
            entry_price: analysis.entryPrice,
            stop_loss: analysis.stopLoss,
            take_profit: analysis.takeProfit,
            reasoning: analysis.reasoning,
            risk_percentage: analysis.riskPercentage,
          },
          patterns: JSON.parse(analysis.patterns || "[]"),
        };

        // Log the transformed analysis
        console.log("[Database] Transformed analysis:", {
          id: transformedAnalysis.id,
          trend: transformedAnalysis.trend,
          confidence: transformedAnalysis.confidence,
          action: transformedAnalysis.recommendation.action,
        });

        return transformedAnalysis;
      });
    } catch (error) {
      console.error("[Database] Error fetching analyses:", error);
      throw error;
    }
  }
}

export const database = DatabaseService.getInstance();
