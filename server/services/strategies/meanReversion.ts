import { calculateBollingerBands, calculateRSI } from "../../utils/indicators";
import { Bar } from "../../types/trading";

interface MeanReversionSignal {
  isValid: boolean;
  direction: "long" | "short" | "none";
  bands: {
    upper: number;
    middle: number;
    lower: number;
  };
  rsi: number;
  entry?: number;
  stopLoss?: number;
  confidence: number;
  reason: string;
}

class MeanReversionStrategy {
  private static instance: MeanReversionStrategy;
  private readonly RSI_OVERSOLD = 30;
  private readonly RSI_OVERBOUGHT = 70;

  private constructor() {}

  public static getInstance(): MeanReversionStrategy {
    if (!MeanReversionStrategy.instance) {
      MeanReversionStrategy.instance = new MeanReversionStrategy();
    }
    return MeanReversionStrategy.instance;
  }

  public analyze(bars: Bar[], timeframe: string): MeanReversionSignal {
    try {
      console.log(`[Strategy] Analyzing Mean Reversion for ${timeframe}`);

      // Extract close prices and volumes
      const closePrices = bars.map((bar) => bar.close);
      const volumes = bars.map((bar) => bar.volume);
      const currentPrice = closePrices[closePrices.length - 1];

      // Calculate Bollinger Bands
      const bb = calculateBollingerBands(closePrices);
      const currentBB = {
        upper: bb.upper[bb.upper.length - 1],
        middle: bb.middle[bb.middle.length - 1],
        lower: bb.lower[bb.lower.length - 1],
      };

      // Calculate RSI
      const rsi = calculateRSI(closePrices);
      const currentRSI = rsi[rsi.length - 1];

      // Check for mean reversion conditions
      const signal = this.checkMeanReversionConditions(currentPrice, currentBB, currentRSI, bars);

      console.log(`[Strategy] Mean Reversion analysis completed with confidence: ${signal.confidence}`);
      return signal;
    } catch (error) {
      console.error("[Strategy] Error analyzing Mean Reversion:", error);
      return {
        isValid: false,
        direction: "none",
        bands: { upper: 0, middle: 0, lower: 0 },
        rsi: 0,
        confidence: 0,
        reason: `Analysis error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private checkMeanReversionConditions(price: number, bb: { upper: number; middle: number; lower: number }, rsi: number, bars: Bar[]): MeanReversionSignal {
    let confidence = 0;
    let direction: "long" | "short" | "none" = "none";
    let entry: number | undefined;
    let stopLoss: number | undefined;

    // Check if price is at band extremes
    const upperDeviation = (price - bb.upper) / bb.upper;
    const lowerDeviation = (bb.lower - price) / bb.lower;

    // Determine potential trade direction
    if (price > bb.upper && rsi > this.RSI_OVERBOUGHT) {
      direction = "short";
      confidence = this.calculateConfidence(upperDeviation, rsi, "short", bars);
      entry = price;
      stopLoss = this.calculateStopLoss("short", price, bb, bars);
    } else if (price < bb.lower && rsi < this.RSI_OVERSOLD) {
      direction = "long";
      confidence = this.calculateConfidence(lowerDeviation, rsi, "long", bars);
      entry = price;
      stopLoss = this.calculateStopLoss("long", price, bb, bars);
    }

    // Validate signal
    const isValid = confidence >= 80; // Mean reversion requires higher confidence

    return {
      isValid,
      direction,
      bands: bb,
      rsi,
      entry: isValid ? entry : undefined,
      stopLoss: isValid ? stopLoss : undefined,
      confidence,
      reason: this.generateReason(direction, confidence, rsi, price, bb),
    };
  }

  private calculateConfidence(deviation: number, rsi: number, direction: "long" | "short", bars: Bar[]): number {
    let confidence = 0;

    // Band deviation score (0-30 points)
    const deviationScore = Math.min(30, Math.abs(deviation) * 100);
    confidence += deviationScore;

    // RSI extremes score (0-30 points)
    if (direction === "long") {
      confidence += Math.min(30, Math.max(0, (this.RSI_OVERSOLD - rsi) * 2));
    } else {
      confidence += Math.min(30, Math.max(0, (rsi - this.RSI_OVERBOUGHT) * 2));
    }

    // Volume confirmation (0-20 points)
    const recentVolume = bars.slice(-3).reduce((sum, bar) => sum + bar.volume, 0) / 3;
    const previousVolume = bars.slice(-6, -3).reduce((sum, bar) => sum + bar.volume, 0) / 3;

    if (recentVolume > previousVolume * 1.5) {
      confidence += 20;
    } else if (recentVolume > previousVolume * 1.2) {
      confidence += 10;
    }

    // Price momentum (0-20 points)
    const recentPrices = bars.slice(-5).map((bar) => bar.close);
    const priceChanges = recentPrices.map((price, i) => (i === 0 ? 0 : (price - recentPrices[i - 1]) / recentPrices[i - 1]));

    const momentum = priceChanges.reduce((sum, change) => sum + change, 0);
    if ((direction === "long" && momentum < -0.02) || (direction === "short" && momentum > 0.02)) {
      confidence += 20;
    } else if ((direction === "long" && momentum < -0.01) || (direction === "short" && momentum > 0.01)) {
      confidence += 10;
    }

    return Math.min(100, confidence);
  }

  private calculateStopLoss(direction: "long" | "short", price: number, bb: { upper: number; middle: number; lower: number }, bars: Bar[]): number {
    // For mean reversion, we use the opposite band as stop loss with a buffer
    const buffer = 0.002; // 0.2% buffer

    if (direction === "long") {
      const lowestLow = Math.min(...bars.slice(-5).map((bar) => bar.low));
      return Math.min(lowestLow, price * (1 - buffer));
    } else {
      const highestHigh = Math.max(...bars.slice(-5).map((bar) => bar.high));
      return Math.max(highestHigh, price * (1 + buffer));
    }
  }

  private generateReason(direction: "long" | "short" | "none", confidence: number, rsi: number, price: number, bb: { upper: number; middle: number; lower: number }): string {
    if (direction === "none" || confidence < 80) {
      return `No valid mean reversion setup (Confidence: ${confidence}%)`;
    }

    const rsiCondition = direction === "long" ? "oversold" : "overbought";
    const bandLevel = direction === "long" ? "lower" : "upper";
    const deviation = direction === "long" ? (((bb.lower - price) / bb.lower) * 100).toFixed(2) : (((price - bb.upper) / bb.upper) * 100).toFixed(2);

    return `Mean reversion ${direction} signal: Price ${Math.abs(Number(deviation))}% ${
      direction === "long" ? "below" : "above"
    } ${bandLevel} band with ${rsiCondition} RSI (${rsi.toFixed(2)})`;
  }
}

export const meanReversion = MeanReversionStrategy.getInstance();
