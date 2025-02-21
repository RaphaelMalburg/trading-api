import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { positionManagement } from "../services/positionManagement";
import { tradeExecution } from "../services/tradeExecution";
import { Bar, Position } from "../types/trading";

// Mock dependencies
jest.mock("../services/tradeExecution");

describe("PositionManagementService", () => {
  let mockPosition: Position;
  let mockBars: Bar[];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock position
    mockPosition = {
      symbol: "AAPL",
      qty: 100,
      size: 100,
      entry_price: 150,
      current_price: 155,
      market_value: 15500,
      unrealized_pl: 500,
      stop_loss: 145,
      take_profit: 165,
      risk_percentage: 1,
    };

    // Setup mock price bars
    mockBars = [
      // Generate 20 bars with an uptrend pattern
      ...Array(10)
        .fill(0)
        .map((_, i) => ({
          timestamp: new Date(2024, 0, i + 1).toISOString(),
          open: 145 + i,
          high: 146 + i,
          low: 144 + i,
          close: 145.5 + i,
          volume: 1000000,
        })),
      // Add recent bars showing higher lows
      ...Array(10)
        .fill(0)
        .map((_, i) => ({
          timestamp: new Date(2024, 0, i + 11).toISOString(),
          open: 155 + i * 0.5,
          high: 156 + i * 0.5,
          low: 154 + i * 0.5,
          close: 155.5 + i * 0.5,
          volume: 1500000,
        })),
    ];
  });

  describe("analyzePosition", () => {
    test("should identify higher lows for stop loss adjustment", async () => {
      const result = await positionManagement.analyzePosition(mockPosition, mockBars);

      expect(result.stopLoss).toBeDefined();
      expect(result.stopLoss?.newStopLoss).toBeGreaterThan(mockPosition.stop_loss);
      expect(result.stopLoss?.confidence).toBeGreaterThanOrEqual(70);
    });

    test("should calculate multiple take profit levels", async () => {
      const result = await positionManagement.analyzePosition(mockPosition, mockBars);

      expect(result.takeProfit).toBeDefined();
      expect(result.takeProfit?.length).toBe(3);

      // Verify risk multiples
      result.takeProfit?.forEach((level, index) => {
        expect(level.riskMultiple).toBe(index + 1);
        expect(level.size).toBeGreaterThan(0);
        expect(level.size).toBeLessThanOrEqual(100);
      });
    });

    test("should recommend position closure on support breach", async () => {
      const breachedPosition = {
        ...mockPosition,
        current_price: 140, // Price below support
      };

      const result = await positionManagement.analyzePosition(breachedPosition, mockBars);

      expect(result.shouldClose).toBe(true);
      expect(result.closeReason).toContain("support level");
    });

    test("should recommend position closure on poor risk-reward", async () => {
      const poorRRPosition = {
        ...mockPosition,
        current_price: 146, // Close to stop loss
      };

      const result = await positionManagement.analyzePosition(poorRRPosition, mockBars);

      expect(result.shouldClose).toBe(true);
      expect(result.closeReason).toContain("Risk-reward ratio");
    });
  });

  describe("updatePosition", () => {
    test("should execute position closure", async () => {
      const update = {
        shouldClose: true,
        closeReason: "Test closure",
      };

      await positionManagement.updatePosition(mockPosition, update);

      expect(tradeExecution.closePosition).toHaveBeenCalledWith(mockPosition.symbol);
    });

    test("should update stop loss", async () => {
      const update = {
        stopLoss: {
          newStopLoss: 150,
          reason: "Higher low formed",
          confidence: 80,
        },
      };

      await positionManagement.updatePosition(mockPosition, update);

      expect(tradeExecution.modifyPosition).toHaveBeenCalledWith(mockPosition.symbol, update.stopLoss.newStopLoss, mockPosition.take_profit);
    });

    test("should set take profit orders", async () => {
      const update = {
        takeProfit: [
          { price: 160, size: 40, riskMultiple: 1 },
          { price: 170, size: 30, riskMultiple: 2 },
          { price: 180, size: 30, riskMultiple: 3 },
        ],
      };

      await positionManagement.updatePosition(mockPosition, update);

      expect(tradeExecution.executeOrder).toHaveBeenCalledTimes(3);
      update.takeProfit.forEach((level, index) => {
        expect(tradeExecution.executeOrder).toHaveBeenNthCalledWith(index + 1, {
          symbol: mockPosition.symbol,
          side: "sell",
          type: "limit",
          qty: Math.floor(mockPosition.qty * (level.size / 100)),
          time_in_force: "gtc",
          limit_price: level.price,
        });
      });
    });
  });
});
