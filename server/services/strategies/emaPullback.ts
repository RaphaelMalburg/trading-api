import { calculateEMA } from "../../utils/indicators";
import { Bar } from "../../types/trading";

interface EMAPullbackSignal {
  isValid: boolean;
  trend: "bullish" | "bearish" | "neutral";
  ema: {
    ema20: number;
    ema50: number;
    ema200: number;
  };
  rsi: number;
  entry?: number;
  stopLoss?: number;
  confidence: number;
  reason: string;
}

class EMAPullbackStrategy {
  private static instance: EMAPullbackStrategy;

  private constructor() {}

  public static getInstance(): EMAPullbackStrategy {
    if (!EMAPullbackStrategy.instance) {
      EMAPullbackStrategy.instance = new EMAPullbackStrategy();
    }
    return EMAPullbackStrategy.instance;
  }

  public analyze(bars: Bar[], timeframe: string): EMAPullbackSignal {
    try {
      console.log(`[Strategy] Analyzing EMA Pullback for ${timeframe}`);

      // Extract close prices
      const closePrices = bars.map((bar) => bar.close);
      const currentPrice = closePrices[closePrices.length - 1];

      // Calculate EMAs
      const ema20 = calculateEMA(closePrices, 20);
      const ema50 = calculateEMA(closePrices, 50);
      const ema200 = calculateEMA(closePrices, 200);

      // Get current values
      const currentEMA20 = ema20[ema20.length - 1];
      const currentEMA50 = ema50[ema50.length - 1];
      const currentEMA200 = ema200[ema200.length - 1];

      // Calculate RSI for momentum
      const rsi = this.calculateRSI(closePrices);
      const currentRSI = rsi[rsi.length - 1];

      // Determine trend based on EMA alignment
      const trend = this.determineTrend(currentEMA20, currentEMA50, currentEMA200);

      // Check for pullback conditions
      const pullbackSignal = this.checkPullbackConditions(currentPrice, currentEMA20, currentEMA50, currentEMA200, currentRSI, trend, bars);

      console.log(`[Strategy] EMA Pullback analysis completed with confidence: ${pullbackSignal.confidence}`);
      return pullbackSignal;
    } catch (error) {
      console.error("[Strategy] Error analyzing EMA Pullback:", error);
      return {
        isValid: false,
        trend: "neutral",
        ema: { ema20: 0, ema50: 0, ema200: 0 },
        rsi: 0,
        confidence: 0,
        reason: `Analysis error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private calculateRSI(prices: number[], period: number = 14): number[] {
    const changes = prices.map((price, index) => {
      if (index === 0) return 0;
      return price - prices[index - 1];
    });

    const gains = changes.map((change) => (change > 0 ? change : 0));
    const losses = changes.map((change) => (change < 0 ? -change : 0));

    const rsiData: number[] = [];
    let avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < prices.length; i++) {
      if (i > period) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      }

      const rs = avgGain / avgLoss;
      const rsi = 100 - 100 / (1 + rs);
      rsiData.push(rsi);
    }

    return rsiData;
  }

  private determineTrend(ema20: number, ema50: number, ema200: number): "bullish" | "bearish" | "neutral" {
    // Strong trend conditions
    if (ema20 > ema50 && ema50 > ema200) {
      return "bullish";
    }
    if (ema20 < ema50 && ema50 < ema200) {
      return "bearish";
    }

    // Check if EMAs are close to each other (within 0.5%)
    const areEMAsClose = (ema1: number, ema2: number) => {
      return Math.abs(ema1 - ema2) / ema1 < 0.005;
    };

    if (areEMAsClose(ema20, ema50) && areEMAsClose(ema50, ema200)) {
      return "neutral";
    }

    // Weak trend conditions
    if (ema20 > ema50) {
      return "bullish";
    }
    if (ema20 < ema50) {
      return "bearish";
    }

    return "neutral";
  }

  private checkPullbackConditions(
    currentPrice: number,
    ema20: number,
    ema50: number,
    ema200: number,
    rsi: number,
    trend: "bullish" | "bearish" | "neutral",
    bars: Bar[]
  ): EMAPullbackSignal {
    let confidence = 0;
    let reason = "";

    // Base case - no valid signal
    if (trend === "neutral") {
      return {
        isValid: false,
        trend,
        ema: { ema20, ema50, ema200 },
        rsi,
        confidence,
        reason: "No clear trend detected",
      };
    }

    // Check for pullback to EMA
    const isPullingBackTo20 = this.isPriceNearEMA(currentPrice, ema20, 0.002);
    const isPullingBackTo50 = this.isPriceNearEMA(currentPrice, ema50, 0.003);

    if (!isPullingBackTo20 && !isPullingBackTo50) {
      return {
        isValid: false,
        trend,
        ema: { ema20, ema50, ema200 },
        rsi,
        confidence,
        reason: "Price not near any key EMA level",
      };
    }

    // Calculate confidence based on multiple factors
    confidence = this.calculateConfidence(currentPrice, ema20, ema50, ema200, rsi, trend, bars);

    // Determine entry and stop loss levels
    const { entry, stopLoss } = this.calculateLevels(currentPrice, ema20, ema50, trend, bars);

    return {
      isValid: confidence >= 75,
      trend,
      ema: { ema20, ema50, ema200 },
      rsi,
      entry,
      stopLoss,
      confidence,
      reason: this.generateReason(confidence, trend, isPullingBackTo20, isPullingBackTo50, rsi),
    };
  }

  private isPriceNearEMA(price: number, ema: number, threshold: number): boolean {
    return Math.abs(price - ema) / ema <= threshold;
  }

  private calculateConfidence(price: number, ema20: number, ema50: number, ema200: number, rsi: number, trend: "bullish" | "bearish" | "neutral", bars: Bar[]): number {
    let confidence = 0;

    // Trend strength (0-30 points)
    if (trend === "bullish") {
      confidence += ema20 > ema50 ? 15 : 0;
      confidence += ema50 > ema200 ? 15 : 0;
    } else if (trend === "bearish") {
      confidence += ema20 < ema50 ? 15 : 0;
      confidence += ema50 < ema200 ? 15 : 0;
    }

    // RSI alignment (0-20 points)
    if (trend === "bullish" && rsi < 50) {
      confidence += 20;
    } else if (trend === "bearish" && rsi > 50) {
      confidence += 20;
    }

    // Price proximity to EMA (0-30 points)
    const ema20Proximity = Math.abs(price - ema20) / ema20;
    const ema50Proximity = Math.abs(price - ema50) / ema50;

    if (ema20Proximity <= 0.001) confidence += 30;
    else if (ema20Proximity <= 0.002) confidence += 20;
    else if (ema50Proximity <= 0.003) confidence += 15;

    // Volume confirmation (0-20 points)
    const recentVolume = bars.slice(-5).reduce((sum, bar) => sum + bar.volume, 0) / 5;
    const previousVolume = bars.slice(-10, -5).reduce((sum, bar) => sum + bar.volume, 0) / 5;

    if (recentVolume > previousVolume) {
      confidence += 20;
    } else if (recentVolume > previousVolume * 0.8) {
      confidence += 10;
    }

    return Math.min(100, confidence);
  }

  private calculateLevels(price: number, ema20: number, ema50: number, trend: "bullish" | "bearish" | "neutral", bars: Bar[]): { entry: number; stopLoss: number } {
    let entry = price;
    let stopLoss = price;

    // Find recent swing high/low for stop loss
    const recentBars = bars.slice(-10);
    if (trend === "bullish") {
      stopLoss = Math.min(...recentBars.map((bar) => bar.low));
      stopLoss = Math.min(stopLoss, ema50 * 0.995); // Add buffer below EMA50
    } else {
      stopLoss = Math.max(...recentBars.map((bar) => bar.high));
      stopLoss = Math.max(stopLoss, ema50 * 1.005); // Add buffer above EMA50
    }

    return { entry, stopLoss };
  }

  private generateReason(confidence: number, trend: string, nearEMA20: boolean, nearEMA50: boolean, rsi: number): string {
    if (confidence < 75) {
      return `Insufficient confidence (${confidence}%) for ${trend} trend`;
    }

    const emaLevel = nearEMA20 ? "EMA20" : "EMA50";
    const rsiCondition = trend === "bullish" ? "oversold" : "overbought";

    return `Strong ${trend} trend with pullback to ${emaLevel} and ${rsiCondition} RSI (${rsi.toFixed(2)})`;
  }
}

export const emaPullback = EMAPullbackStrategy.getInstance();
