import { GoogleGenerativeAI } from "@google/generative-ai";
import { generateAnalysisChart } from "./chartAnalysis.js";
import { getHistoricalBars } from "./alpaca.js";
import { database } from "./database.js";
import type { Trade, AnalysisResult, TechnicalSignals } from "../types/trading.js";

class AIAnalysisService {
  private genAI: GoogleGenerativeAI;
  private static instance: AIAnalysisService;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  private constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("Google API key not found in environment variables");
    }
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }

  public static getInstance(): AIAnalysisService {
    if (!AIAnalysisService.instance) {
      AIAnalysisService.instance = new AIAnalysisService();
    }
    return AIAnalysisService.instance;
  }

  private async retryOperation<T>(operation: () => Promise<T>, retryCount = 0): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount >= this.maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, this.retryDelay * Math.pow(2, retryCount)));
      return this.retryOperation(operation, retryCount + 1);
    }
  }

  public async analyzeChart(symbol: string, timeframe: string, balance: number, positions: Trade[], technicalSignals: TechnicalSignals): Promise<AnalysisResult> {
    return this.retryOperation(async () => {
      // Get the model and prepare data
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });
      const now = new Date();
      const chartData = await getHistoricalBars(symbol, timeframe, 200);
      const chartImage = await generateAnalysisChart(chartData, symbol);

      // Create prompt and image parts
      const prompt = this.createAnalysisPrompt(symbol, timeframe, balance, positions, technicalSignals);
      const base64Image = chartImage.toString("base64");
      const parts = [
        { text: prompt },
        {
          inlineData: {
            data: base64Image,
            mimeType: "image/png",
          },
        },
      ];

      // Get AI response
      const result = await model.generateContent(parts);
      await result.response;
      const text = result.response.text();

      // Parse and validate response
      const analysisResult = this.parseAndValidateResponse(text, balance);

      // Store analysis
      await this.storeAnalysis(now.toISOString(), base64Image, analysisResult, technicalSignals);

      return analysisResult;
    });
  }

  private createAnalysisPrompt(symbol: string, timeframe: string, accountBalance: number, openPositions: Trade[], technicalSignals: TechnicalSignals): string {
    return `You are a trading analysis AI. Your task is to analyze the provided chart and technical signals to respond with a JSON object.

IMPORTANT: Your response must be a valid JSON object only. Do not include any explanatory text, markdown formatting, or backticks.

Chart: ${timeframe} timeframe for ${symbol}

Account Information:
- Balance: $${accountBalance}
- Open Positions: ${openPositions.length}/3 maximum
${openPositions.length > 0 ? `- Current Positions: ${openPositions.map((p) => p.symbol).join(", ")}` : ""}

Technical Analysis:
- Trend: ${technicalSignals.trend} (Strength: ${(technicalSignals.strength * 100).toFixed(1)}%)
- RSI: ${technicalSignals.rsi.toFixed(2)}
- MACD:
  * Line: ${technicalSignals.macd.line.toFixed(4)}
  * Signal: ${technicalSignals.macd.signal.toFixed(4)}
  * Histogram: ${technicalSignals.macd.histogram.toFixed(4)}
- Volume:
  * Current: ${technicalSignals.volume.current}
  * Average: ${technicalSignals.volume.average}
  * Trend: ${technicalSignals.volume.trend}
- Support Levels: ${technicalSignals.support.map((level) => level.toFixed(2)).join(", ")}
- Resistance Levels: ${technicalSignals.resistance.map((level) => level.toFixed(2)).join(", ")}

Trading Parameters:
- Risk per trade: 0.5-2% ($${(accountBalance * 0.005).toFixed(2)}-$${(accountBalance * 0.02).toFixed(2)})
- Risk/Reward: 1:1 to 1:4
- Stop loss: Technical levels only
- Minimum confidence:
  * Standard trades: 75%
  * Counter-trend: 90%
  * Mean reversion: 80%

Response Format (use exact structure):
{
  "trend": "bullish" | "bearish" | "neutral",
  "confidence": <number 0-100>,
  "key_levels": {
    "support": [<price levels>],
    "resistance": [<price levels>]
  },
  "signals": {
    "ema_pullback": <boolean>,
    "mean_reversion": <boolean>,
    "breakout": <boolean>
  },
  "recommendation": {
    "action": "buy" | "sell" | "hold",
    "entry_price": <number>,
    "stop_loss": <number>,
    "take_profit": <number>,
    "timeframe": "${timeframe}",
    "reasoning": <string>,
    "risk_percentage": <number 0.5-2.0>
  },
  "patterns": [
    {
      "name": <string>,
      "confidence": <number 0-100>,
      "location": {
        "start_index": <number>,
        "end_index": <number>
      }
    }
  ]
}`;
  }

  private parseAndValidateResponse(text: string, accountBalance: number): AnalysisResult {
    try {
      const analysisResult = JSON.parse(text);
      if (!this.validateAnalysis(analysisResult, accountBalance)) {
        throw new Error("Invalid analysis result from AI model");
      }
      return analysisResult;
    } catch (error) {
      throw new Error(`Failed to parse AI analysis response: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private async storeAnalysis(timestamp: string, chartImage: string, analysisResult: AnalysisResult, technicalSignals: TechnicalSignals): Promise<void> {
    try {
      await database.addBacktestAnalysis(0, [
        {
          timestamp,
          chart_image: chartImage,
          analysis_result: analysisResult,
          technical_signals: technicalSignals,
        },
      ]);
    } catch (error) {
      console.error("[AI] Error storing analysis result:", error);
      // Don't throw here, we still want to return the analysis even if storage fails
    }
  }

  private validateAnalysis(analysis: AnalysisResult, accountBalance: number): boolean {
    if (!analysis.trend || !analysis.confidence || !analysis.recommendation) {
      return false;
    }

    if (analysis.confidence < 0 || analysis.confidence > 100) {
      return false;
    }

    const rec = analysis.recommendation;
    if (!["buy", "sell", "hold"].includes(rec.action)) {
      return false;
    }

    if (rec.risk_percentage < 0.5 || rec.risk_percentage > 2.0) {
      return false;
    }

    if (rec.action !== "hold") {
      if (!rec.entry_price || !rec.stop_loss || !rec.take_profit) {
        return false;
      }

      const entryPrice = rec.entry_price;
      const stopLoss = rec.stop_loss;
      const takeProfit = rec.take_profit;

      if (rec.action === "buy" && (stopLoss >= entryPrice || takeProfit <= entryPrice)) {
        return false;
      }

      if (rec.action === "sell" && (stopLoss <= entryPrice || takeProfit >= entryPrice)) {
        return false;
      }

      const riskAmount = Math.abs(entryPrice - stopLoss);
      const maxRiskAmount = accountBalance * (rec.risk_percentage / 100);
      if (riskAmount > maxRiskAmount) {
        return false;
      }
    }

    return true;
  }
}

export const aiAnalysis = AIAnalysisService.getInstance();
