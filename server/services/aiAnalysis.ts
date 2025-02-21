import { GoogleGenerativeAI } from "@google/generative-ai";
import { Buffer } from "buffer";
import { generateAnalysisChart } from "./chartAnalysis.js";
import { getHistoricalBars } from "./alpaca.js";

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

  public async analyzeChart(symbol: string, timeframe: string, accountBalance: number, openPositions: any[]): Promise<AnalysisResult> {
    try {
      console.log(`[AI] Starting analysis for ${symbol} (${timeframe})`);

      // Get historical data and generate chart
      const bars = await getHistoricalBars(symbol, timeframe, 200);
      const chartImage = await generateAnalysisChart(bars, symbol);
      const prompt = this.createAnalysisPrompt(symbol, timeframe, accountBalance, openPositions);

      const response = await this.retryWithExponentialBackoff(async () => {
        const model = this.genAI.getGenerativeModel({
          model: "gemini-1.5-flash",
          generationConfig: {
            temperature: 0.1,
            topP: 1,
            topK: 32,
          },
        });

        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: "image/png",
              data: chartImage.toString("base64"),
            },
          },
          {
            text: prompt,
          },
        ]);

        const response = await result.response;
        let text = response.text().trim();

        // Log the raw response for debugging
        console.log("[AI] Raw response:", text);

        // Clean the response text
        if (text.includes("```")) {
          text = text.replace(/```json\n|\```\n|```/g, "").trim();
        }
        text = text.replace(/`/g, "").trim();

        // Ensure the text starts with { and ends with }
        if (!text.startsWith("{") || !text.endsWith("}")) {
          console.error("[AI] Response is not a JSON object:", text);
          throw new Error("Response is not in the required JSON format");
        }

        try {
          const parsed = JSON.parse(text);
          console.log("[AI] Parsed response:", JSON.stringify(parsed, null, 2));
          return parsed;
        } catch (error) {
          console.error("[AI] JSON parse error:", error);
          console.error("[AI] Failed text:", text);
          throw new Error("Failed to parse JSON response");
        }
      });

      // Validate analysis
      if (!this.validateAnalysis(response, accountBalance)) {
        console.error("[AI] Invalid analysis result:", JSON.stringify(response, null, 2));
        throw new Error("Invalid analysis result structure");
      }

      console.log(`[AI] Analysis completed for ${symbol} with confidence: ${response.confidence}`);
      return response;
    } catch (error) {
      console.error("[AI] Error analyzing chart:", error);
      throw new Error(`Failed to analyze chart: ${error instanceof Error ? error.message : "Unknown error"}`);
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
