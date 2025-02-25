import { Bar } from "../types/trading.js";

interface TechnicalSignals {
  trend: "bullish" | "bearish" | "neutral";
  strength: number;
  support: number[];
  resistance: number[];
  rsi: number;
  macd: {
    line: number;
    signal: number;
    histogram: number;
  };
  volume: {
    current: number;
    average: number;
    trend: "increasing" | "decreasing" | "neutral";
  };
}

class TechnicalAnalysisService {
  private static instance: TechnicalAnalysisService;

  private constructor() {}

  public static getInstance(): TechnicalAnalysisService {
    if (!TechnicalAnalysisService.instance) {
      TechnicalAnalysisService.instance = new TechnicalAnalysisService();
    }
    return TechnicalAnalysisService.instance;
  }

  public async analyzeMarket(bars: Bar[]): Promise<TechnicalSignals> {
    const closes = bars.map((b) => b.close);
    const volumes = bars.map((b) => b.volume);

    // Calculate EMAs for trend
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const trend = this.determineTrend(ema20, ema50);

    // Calculate other indicators
    const rsi = this.calculateRSI(closes);
    const macd = this.calculateMACD(closes);
    const volumeAnalysis = this.analyzeVolume(volumes);
    const keyLevels = this.findKeyLevels(bars);
    const strength = this.calculateTrendStrength(closes);

    return {
      trend,
      strength,
      ...keyLevels,
      rsi,
      macd,
      volume: volumeAnalysis,
    };
  }

  private calculateEMA(values: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema = [values[0]];

    for (let i = 1; i < values.length; i++) {
      ema.push(values[i] * k + ema[i - 1] * (1 - k));
    }

    return ema;
  }

  private calculateSMA(values: number[], period: number): number {
    const sum = values.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  private determineTrend(ema20: number[], ema50: number[]): "bullish" | "bearish" | "neutral" {
    const last20 = ema20[ema20.length - 1];
    const last50 = ema50[ema50.length - 1];
    const prev20 = ema20[ema20.length - 2];
    const prev50 = ema50[ema50.length - 2];

    if (last20 > last50 && prev20 <= prev50) return "bullish";
    if (last20 < last50 && prev20 >= prev50) return "bearish";
    if (last20 > last50) return "bullish";
    if (last20 < last50) return "bearish";
    return "neutral";
  }

  private calculateRSI(closes: number[], period: number = 14): number {
    const changes = closes.slice(1).map((price, i) => price - closes[i]);
    const gains = changes.map((change) => (change > 0 ? change : 0));
    const losses = changes.map((change) => (change < 0 ? -change : 0));

    const avgGain = this.calculateSMA(gains, period);
    const avgLoss = this.calculateSMA(losses, period);

    return 100 - 100 / (1 + avgGain / avgLoss);
  }

  private calculateMACD(closes: number[]): { line: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);

    const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
    const macdValues = ema12.map((v, i) => v - ema26[i]);
    const signalLine = this.calculateEMA(macdValues, 9)[macdValues.length - 1];

    return {
      line: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine,
    };
  }

  private findKeyLevels(bars: Bar[]): { support: number[]; resistance: number[] } {
    const support: number[] = [];
    const resistance: number[] = [];
    const minDistance = 0.002;

    for (let i = 2; i < bars.length - 2; i++) {
      const current = bars[i];
      const [prev2, prev1, next1, next2] = [bars[i - 2], bars[i - 1], bars[i + 1], bars[i + 2]];

      if (this.isSwingLow(current, prev1, prev2, next1, next2)) {
        if (!this.isNearExistingLevel(current.low, support, minDistance)) {
          support.push(current.low);
        }
      }

      if (this.isSwingHigh(current, prev1, prev2, next1, next2)) {
        if (!this.isNearExistingLevel(current.high, resistance, minDistance)) {
          resistance.push(current.high);
        }
      }
    }

    return {
      support: support.sort((a, b) => b - a).slice(0, 3),
      resistance: resistance.sort((a, b) => a - b).slice(0, 3),
    };
  }

  private isSwingLow(current: Bar, prev1: Bar, prev2: Bar, next1: Bar, next2: Bar): boolean {
    return current.low < prev1.low && current.low < prev2.low && current.low < next1.low && current.low < next2.low;
  }

  private isSwingHigh(current: Bar, prev1: Bar, prev2: Bar, next1: Bar, next2: Bar): boolean {
    return current.high > prev1.high && current.high > prev2.high && current.high > next1.high && current.high > next2.high;
  }

  private isNearExistingLevel(price: number, levels: number[], minDistance: number): boolean {
    return levels.some((level) => Math.abs(level - price) / price < minDistance);
  }

  private calculateTrendStrength(closes: number[]): number {
    const returns = closes.slice(1).map((price, i) => (price - closes[i]) / closes[i]);
    const avgReturn = returns.reduce((sum, ret) => sum + Math.abs(ret), 0) / returns.length;
    return Math.min(avgReturn * 100, 1);
  }

  private analyzeVolume(volumes: number[]): { current: number; average: number; trend: "increasing" | "decreasing" | "neutral" } {
    const current = volumes[volumes.length - 1];
    const average = this.calculateSMA(volumes, 20);
    const shortTermAvg = this.calculateSMA(volumes.slice(-5), 5);

    let trend: "increasing" | "decreasing" | "neutral";
    if (shortTermAvg > average * 1.1) trend = "increasing";
    else if (shortTermAvg < average * 0.9) trend = "decreasing";
    else trend = "neutral";

    return { current, average, trend };
  }
}

export const technicalAnalysis = TechnicalAnalysisService.getInstance();
