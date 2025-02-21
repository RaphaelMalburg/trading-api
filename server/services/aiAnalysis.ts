import { GoogleGenerativeAI } from "@google/generative-ai";
import { Buffer } from "buffer";
import { generateAnalysisChart } from "./chartAnalysis.js";
import { getHistoricalBars } from "./alpaca.js";

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

interface AnalysisResult {
  trend: "bullish" | "bearish" | "neutral";
  confidence: number;
  key_levels: {
    support: number[];
    resistance: number[];
  };
  signals: {
    ema_pullback: boolean;
    mean_reversion: boolean;
    breakout: boolean;
  };
  recommendation: {
    action: "buy" | "sell" | "hold";
    entry_price?: number;
    stop_loss?: number;
    take_profit?: number;
    timeframe: string;
    reasoning: string;
    risk_percentage?: number;
  };
  patterns: {
    name: string;
    confidence: number;
    location: {
      start_index: number;
      end_index: number;
    };
  }[];
}

class AIAnalysisService {
  private genAI: GoogleGenerativeAI;
  private static instance: AIAnalysisService;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // ms

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

  private createAnalysisPrompt(symbol: string, timeframe: string, accountBalance: number, openPositions: any[]): string {
    return `You are a trading analysis AI. Your task is to analyze the provided chart and respond with a JSON object.

IMPORTANT: Your response must be a valid JSON object only. Do not include any explanatory text, markdown formatting, or backticks.

Chart: ${timeframe} timeframe for ${symbol}

Account Information:
- Balance: $${accountBalance}
- Open Positions: ${openPositions.length}/3 maximum
${openPositions.length > 0 ? `- Current Positions: ${openPositions.map((p) => p.symbol).join(", ")}` : ""}

Required Analysis:
1. Trend direction and strength
2. Support/resistance levels
3. Pattern identification
4. Trading signals (EMA pullback, mean reversion, breakout)

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

  private async retryWithExponentialBackoff<T>(operation: () => Promise<T>, retryCount = 0): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount >= this.maxRetries) {
        throw error;
      }

      const delay = this.retryDelay * Math.pow(2, retryCount);
      console.log(`Retrying operation after ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      return this.retryWithExponentialBackoff(operation, retryCount + 1);
    }
  }

  public async analyzeChart(symbol: string, timeframe: string, balance: number, positions: Position[]): Promise<any> {
    try {
      const response = await this.makeRequest(symbol, timeframe, balance, positions);
      return response;
    } catch (error) {
      console.error(`[AI] Error analyzing chart for ${symbol}:`, error);
      throw error;
    }
  }

  private async makeRequest(symbol: string, timeframe: string, balance: number, positions: Position[], retries = 3): Promise<any> {
    try {
      const response = await this.sendRequest(symbol, timeframe, balance, positions);
      return response;
    } catch (error) {
      if (retries > 0) {
        const delay = Math.pow(2, 4 - retries) * 1000; // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.makeRequest(symbol, timeframe, balance, positions, retries - 1);
      }
      throw error;
    }
  }

  private async sendRequest(symbol: string, timeframe: string, balance: number, positions: Position[]): Promise<any> {
    try {
      const response = await this.processAnalysis(symbol, timeframe, balance, positions);
      return response;
    } catch (error) {
      console.error(`[AI] Error in analysis request for ${symbol}:`, error);
      throw error;
    }
  }

  private async processAnalysis(symbol: string, timeframe: string, balance: number, positions: Position[]): Promise<any> {
    try {
      // Process the analysis and return the result
      // This is a placeholder for the actual AI analysis logic
      return {
        confidence: 85,
        recommendation: {
          action: "hold",
          entry_price: 0,
          stop_loss: 0,
          take_profit: 0,
          risk_percentage: 0.01,
        },
      };
    } catch (error) {
      console.error(`[AI] Error processing analysis for ${symbol}:`, error);
      throw error;
    }
  }

  private validateAnalysis(analysis: AnalysisResult, accountBalance: number): boolean {
    // Basic structure validation
    if (!analysis.trend || !analysis.confidence || !analysis.recommendation) {
      console.error("[AI] Missing required fields in analysis");
      return false;
    }

    // Confidence score validation
    if (analysis.confidence < 0 || analysis.confidence > 100) {
      console.error("[AI] Invalid confidence score");
      return false;
    }

    // Validate confidence thresholds
    if (analysis.recommendation.action !== "hold") {
      const minConfidence = this.getMinimumConfidence(analysis);
      if (analysis.confidence < minConfidence) {
        console.error(`[AI] Confidence score ${analysis.confidence} below minimum required ${minConfidence}`);
        return false;
      }
    }

    // Validate risk percentage
    if (analysis.recommendation.risk_percentage) {
      if (analysis.recommendation.risk_percentage < 0.5 || analysis.recommendation.risk_percentage > 2.0) {
        console.error("[AI] Invalid risk percentage");
        return false;
      }
    }

    // Validate price levels
    if (analysis.recommendation.action !== "hold") {
      if (!this.validatePriceLevels(analysis, accountBalance)) {
        console.error("[AI] Invalid price levels");
        return false;
      }
    }

    return true;
  }

  private getMinimumConfidence(analysis: AnalysisResult): number {
    // Counter-trend trades require higher confidence
    if ((analysis.trend === "bullish" && analysis.recommendation.action === "sell") || (analysis.trend === "bearish" && analysis.recommendation.action === "buy")) {
      return 90;
    }

    // Mean reversion trades
    if (analysis.signals.mean_reversion) {
      return 80;
    }

    // Standard trades
    return 75;
  }

  private validatePriceLevels(analysis: AnalysisResult, accountBalance: number): boolean {
    const { entry_price, stop_loss, take_profit } = analysis.recommendation;

    if (!entry_price || !stop_loss || !take_profit) {
      return false;
    }

    // Calculate risk and reward
    const risk = Math.abs(entry_price - stop_loss);
    const reward = Math.abs(take_profit - entry_price);
    const riskRewardRatio = reward / risk;

    // Validate risk-reward ratio (minimum 1:1)
    if (riskRewardRatio < 1 || riskRewardRatio > 4) {
      console.error(`[AI] Invalid risk-reward ratio: ${riskRewardRatio}`);
      return false;
    }

    return true;
  }
}

export const aiAnalysis = AIAnalysisService.getInstance();
