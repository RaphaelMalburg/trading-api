import OpenAI from "openai";
import { Buffer } from "buffer";

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
  private openai: OpenAI;
  private static instance: AIAnalysisService;

  private constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not found in environment variables");
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  public static getInstance(): AIAnalysisService {
    if (!AIAnalysisService.instance) {
      AIAnalysisService.instance = new AIAnalysisService();
    }
    return AIAnalysisService.instance;
  }

  private createAnalysisPrompt(symbol: string, timeframe: string): string {
    return `Analyze this ${timeframe} chart for ${symbol}. Focus on:
1. Overall trend direction and strength
2. Key support and resistance levels
3. Technical patterns (if any)
4. EMA pullback opportunities
5. Mean reversion signals
6. Potential breakout/breakdown points

Provide a trading recommendation with:
- Entry price (if applicable)
- Stop loss level
- Take profit targets
- Confidence level (0-1)
- Clear reasoning for the recommendation

Format the response as a JSON object with the following structure:
{
  "trend": "bullish|bearish|neutral",
  "confidence": 0.0-1.0,
  "key_levels": {
    "support": [price_levels],
    "resistance": [price_levels]
  },
  "signals": {
    "ema_pullback": boolean,
    "mean_reversion": boolean,
    "breakout": boolean
  },
  "recommendation": {
    "action": "buy|sell|hold",
    "entry_price": number,
    "stop_loss": number,
    "take_profit": number,
    "timeframe": string,
    "reasoning": string
  },
  "patterns": [
    {
      "name": string,
      "confidence": 0.0-1.0,
      "location": {
        "start_index": number,
        "end_index": number
      }
    }
  ]
}`;
  }

  public async analyzeChart(chartImage: Buffer, symbol: string, timeframe: string): Promise<AnalysisResult> {
    try {
      console.log(`[AI] Analyzing chart for ${symbol} (${timeframe})`);

      const base64Image = chartImage.toString("base64");
      const prompt = this.createAnalysisPrompt(symbol, timeframe);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.2,
        response_format: { type: "json_object" },
      });

      if (!response.choices[0]?.message?.content) {
        throw new Error("No analysis received from OpenAI");
      }

      const analysis = JSON.parse(response.choices[0].message.content) as AnalysisResult;
      console.log(`[AI] Analysis completed for ${symbol} with confidence: ${analysis.confidence}`);

      return analysis;
    } catch (error) {
      console.error("[AI] Error analyzing chart:", error);
      throw new Error(`Failed to analyze chart: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  public async validateAnalysis(analysis: AnalysisResult): Promise<boolean> {
    // Implement validation logic
    if (!analysis.trend || !analysis.confidence || !analysis.recommendation) {
      return false;
    }

    if (analysis.confidence < 0 || analysis.confidence > 1) {
      return false;
    }

    if (!["bullish", "bearish", "neutral"].includes(analysis.trend)) {
      return false;
    }

    if (!["buy", "sell", "hold"].includes(analysis.recommendation.action)) {
      return false;
    }

    return true;
  }
}

export const aiAnalysis = AIAnalysisService.getInstance();
