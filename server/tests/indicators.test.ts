import { describe, expect, test } from "@jest/globals";
import { calculateEMA, calculateBollingerBands, calculateRSI, findPivotPoints, identifyTrendlines } from "../utils/indicators";

describe("Technical Indicators", () => {
  describe("EMA", () => {
    test("should calculate EMA correctly", () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
      const period = 3;
      const ema = calculateEMA(prices, period);

      expect(ema.length).toBe(prices.length);
      expect(ema[0]).toBe(10); // First value should be equal to first price
      expect(ema[ema.length - 1]).toBeCloseTo(18.11, 2); // Verify last value
    });

    test("should handle empty array", () => {
      expect(() => calculateEMA([], 3)).toThrow();
    });
  });

  describe("Bollinger Bands", () => {
    test("should calculate Bollinger Bands correctly", () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
      const period = 5;
      const stdDev = 2;
      const bands = calculateBollingerBands(prices, period, stdDev);

      expect(bands.middle.length).toBe(prices.length - period + 1);
      expect(bands.upper.length).toBe(bands.middle.length);
      expect(bands.lower.length).toBe(bands.middle.length);

      // Verify last values
      const lastIndex = bands.middle.length - 1;
      expect(bands.middle[lastIndex]).toBeCloseTo(18, 2);
      expect(bands.upper[lastIndex]).toBeGreaterThan(bands.middle[lastIndex]);
      expect(bands.lower[lastIndex]).toBeLessThan(bands.middle[lastIndex]);
    });

    test("should handle insufficient data", () => {
      const prices = [10, 11, 12];
      const bands = calculateBollingerBands(prices, 5, 2);
      expect(bands.middle.length).toBe(0);
      expect(bands.upper.length).toBe(0);
      expect(bands.lower.length).toBe(0);
    });
  });

  describe("RSI", () => {
    test("should calculate RSI correctly", () => {
      const prices = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0];
      const period = 14;
      const rsi = calculateRSI(prices, period);

      expect(rsi.length).toBe(prices.length - period);
      expect(rsi[rsi.length - 1]).toBeGreaterThan(0);
      expect(rsi[rsi.length - 1]).toBeLessThan(100);
    });

    test("should handle price with no change", () => {
      const prices = Array(20).fill(100);
      const rsi = calculateRSI(prices, 14);
      expect(rsi[rsi.length - 1]).toBe(50); // RSI should be 50 when there's no price change
    });
  });

  describe("Pivot Points", () => {
    test("should identify pivot points correctly", () => {
      const data = [
        { high: 10, low: 8, close: 9 },
        { high: 11, low: 9, close: 10 },
        { high: 12, low: 10, close: 11 },
        { high: 11, low: 9, close: 10 },
        { high: 10, low: 8, close: 9 },
        { high: 9, low: 7, close: 8 },
        { high: 10, low: 8, close: 9 },
        { high: 11, low: 9, close: 10 },
        { high: 12, low: 10, close: 11 },
      ];

      const { pivotHigh, pivotLow } = findPivotPoints(data);

      expect(pivotHigh.length).toBeGreaterThan(0);
      expect(pivotLow.length).toBeGreaterThan(0);
      expect(Math.max(...pivotHigh)).toBeLessThanOrEqual(Math.max(...data.map((d) => d.high)));
      expect(Math.min(...pivotLow)).toBeGreaterThanOrEqual(Math.min(...data.map((d) => d.low)));
    });
  });

  describe("Trendlines", () => {
    test("should identify trendlines correctly", () => {
      const data = [
        { high: 10, low: 8, close: 9 },
        { high: 11, low: 9, close: 10 },
        { high: 12, low: 10, close: 11 },
        { high: 11, low: 9, close: 10 },
        { high: 10, low: 8, close: 9 },
        { high: 9, low: 7, close: 8 },
        { high: 10, low: 8, close: 9 },
        { high: 11, low: 9, close: 10 },
        { high: 12, low: 10, close: 11 },
      ];

      const { resistance, support } = identifyTrendlines(data);

      expect(resistance.length).toBeGreaterThan(0);
      expect(support.length).toBeGreaterThan(0);

      // Verify trendline structure
      if (resistance.length > 0) {
        expect(resistance[0]).toHaveProperty("start");
        expect(resistance[0]).toHaveProperty("end");
      }
      if (support.length > 0) {
        expect(support[0]).toHaveProperty("start");
        expect(support[0]).toHaveProperty("end");
      }
    });
  });
});
