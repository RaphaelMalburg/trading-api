import { GoogleGenerativeAI } from "@google/generative-ai";
import { Buffer } from "buffer";
import { generateAnalysisChart } from "./chartAnalysis.js";
import { getHistoricalBars } from "./alpaca.js";
import type { Trade, AnalysisResult } from "../types/trading.js";

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

  private createAnalysisPrompt(symbol: string, timeframe: string, accountBalance: number, openPositions: Trade[]): string {
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

  public async analyzeChart(symbol: string, timeframe: string, balance: number, positions: Trade[]): Promise<AnalysisResult> {
    try {
      const response = await this.makeRequest(symbol, timeframe, balance, positions);
      return response;
    } catch (error) {
      console.error(`[AI] Error analyzing chart for ${symbol}:`, error);
      throw error;
    }
  }

  private async makeRequest(symbol: string, timeframe: string, balance: number, positions: Trade[], retries = 3): Promise<AnalysisResult> {
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

  private async sendRequest(symbol: string, timeframe: string, balance: number, positions: Trade[]): Promise<AnalysisResult> {
    try {
      const response = await this.processAnalysis(symbol, timeframe, balance, positions);
      return response;
    } catch (error) {
      console.error(`[AI] Error in analysis request for ${symbol}:`, error);
      throw error;
    }
  }

  private async processAnalysis(symbol: string, timeframe: string, balance: number, positions: Trade[]): Promise<AnalysisResult> {
    try {
      // Get the model
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

      // Generate the chart image
      const chartData = await getHistoricalBars(symbol, timeframe);
      const chartImage = await generateAnalysisChart(chartData, symbol);

      // Create the prompt
      const prompt = this.createAnalysisPrompt(symbol, timeframe, balance, positions);

      // Convert chart image to base64
      const base64Image = chartImage.toString("base64");

      // Create the image part for the model
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: "image/png",
        },
      };

      // Create the content parts
      const parts = [{ text: prompt }, imagePart];

      // Send request to the model
      const result = await model.generateContent(parts, {});

      // Wait for the response to be ready
      await result.response;

      // Get the text from the response
      const text = result.response.text();
      console.log("[AI] Raw response:", text);

      // Parse the JSON response
      let analysisResult: AnalysisResult;
      try {
        analysisResult = JSON.parse(text);
      } catch (error) {
        console.error("[AI] Error parsing analysis response:", error);
        throw new Error("Failed to parse AI analysis response");
      }

      // Validate the analysis result
      if (!this.validateAnalysis(analysisResult, balance)) {
        throw new Error("Invalid analysis result from AI model");
      }

      return analysisResult;
    } catch (error) {
      console.error(`[AI] Error processing analysis for ${symbol}:`, error);
      throw error;
    }
  }

  private validateAnalysis(analysis: AnalysisResult, accountBalance: number): boolean {
    // Basic structure validation
    if (!analysis.trend || !analysis.confidence || !analysis.recommendation) {
      console.error("[AI] Missing required fields in analysis:", {
        hasTrend: !!analysis.trend,
        hasConfidence: !!analysis.confidence,
        hasRecommendation: !!analysis.recommendation,
        analysis: JSON.stringify(analysis, null, 2),
      });
      return false;
    }

    // Confidence score validation
    if (analysis.confidence < 0 || analysis.confidence > 100) {
      console.error("[AI] Invalid confidence score:", analysis.confidence);
      return false;
    }

    // Validate confidence thresholds
    if (analysis.recommendation.action !== "hold") {
      const minConfidence = this.getMinimumConfidence(analysis);
      if (analysis.confidence < minConfidence) {
        console.error(`[AI] Confidence score ${analysis.confidence} below minimum required ${minConfidence}`);
        return false;
      }

      // Only validate price levels for non-hold actions
      if (!this.validatePriceLevels(analysis, accountBalance)) {
        console.error("[AI] Invalid price levels for action:", analysis.recommendation.action);
        return false;
      }
    }

    // Validate risk percentage if present
    if (analysis.recommendation.risk_percentage !== undefined) {
      if (analysis.recommendation.risk_percentage < 0.5 || analysis.recommendation.risk_percentage > 2.0) {
        console.error("[AI] Invalid risk percentage:", analysis.recommendation.risk_percentage);
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
    if (analysis.signals?.mean_reversion) {
      return 80;
    }

    // Standard trades
    return 75;
  }

  private validatePriceLevels(analysis: AnalysisResult, accountBalance: number): boolean {
    const { entry_price, stop_loss, take_profit } = analysis.recommendation;

    if (!entry_price || !stop_loss || !take_profit) {
      console.error("[AI] Missing price levels:", { entry_price, stop_loss, take_profit });
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
