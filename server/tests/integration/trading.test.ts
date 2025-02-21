import { describe, expect, test, jest, beforeEach } from "@jest/globals";
import { riskManagement } from "../../services/riskManagement";
import { tradeExecution } from "../../services/tradeExecution";
import { positionManagement } from "../../services/positionManagement";
import { emaPullback } from "../../services/strategies/emaPullback";
import { meanReversion } from "../../services/strategies/meanReversion";
import { Bar, Position } from "../../types/trading";

// Mock external dependencies
jest.mock("../../services/tradeExecution");

describe("Trading System Integration", () => {
  let mockBars: Bar[];
  let mockPosition: Position;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock price data
    mockBars = [
      ...Array(20)
        .fill(0)
        .map((_, i) => ({
          timestamp: new Date(2024, 0, i + 1).toISOString(),
          open: 150 + i,
          high: 152 + i,
          low: 149 + i,
          close: 151 + i,
          volume: 1000000 + i * 100000,
        })),
    ];

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
  });

  describe("Strategy to Position Management Flow", () => {
    test("should execute EMA pullback strategy and manage position", async () => {
      // 1. Get strategy signal
      const signal = await emaPullback.analyze(mockBars, "4Hour");
      expect(signal.isValid).toBeDefined();

      if (signal.isValid && signal.entry) {
        // 2. Calculate position size
        const riskParams = {
          accountBalance: 100000,
          riskPercentage: 1,
          entry_price: signal.entry,
          stop_loss: signal.stopLoss!,
          take_profit: signal.entry + (signal.entry - signal.stopLoss!) * 2, // 2R target
        };

        const positionSize = riskManagement.calculatePositionSize(riskParams);
        expect(positionSize.size).toBeGreaterThan(0);

        // 3. Execute trade
        await tradeExecution.executeOrder({
          symbol: "AAPL",
          side: "buy",
          type: "limit",
          qty: positionSize.size,
          time_in_force: "gtc",
          limit_price: signal.entry,
        });

        expect(tradeExecution.executeOrder).toHaveBeenCalled();
      }
    });

    test("should execute mean reversion strategy and manage position", async () => {
      // 1. Get strategy signal
      const signal = await meanReversion.analyze(mockBars, "4Hour");
      expect(signal.isValid).toBeDefined();

      if (signal.isValid && signal.entry) {
        // 2. Calculate position size
        const riskParams = {
          accountBalance: 100000,
          riskPercentage: 1,
          entry_price: signal.entry,
          stop_loss: signal.stopLoss!,
          take_profit: signal.bands.middle, // Target middle band
        };

        const positionSize = riskManagement.calculatePositionSize(riskParams);
        expect(positionSize.size).toBeGreaterThan(0);

        // 3. Execute trade
        await tradeExecution.executeOrder({
          symbol: "AAPL",
          side: signal.direction === "long" ? "buy" : "sell",
          type: "limit",
          qty: positionSize.size,
          time_in_force: "gtc",
          limit_price: signal.entry,
        });

        expect(tradeExecution.executeOrder).toHaveBeenCalled();
      }
    });
  });

  describe("Position Management to Trade Execution Flow", () => {
    test("should analyze position and execute updates", async () => {
      // 1. Analyze existing position
      const update = await positionManagement.analyzePosition(mockPosition, mockBars);
      expect(update).toBeDefined();

      // 2. Execute position updates
      await positionManagement.updatePosition(mockPosition, update);

      // Verify trade execution calls
      if (update.shouldClose) {
        expect(tradeExecution.closePosition).toHaveBeenCalledWith(mockPosition.symbol);
      } else {
        if (update.stopLoss) {
          expect(tradeExecution.modifyPosition).toHaveBeenCalledWith(mockPosition.symbol, update.stopLoss.newStopLoss, mockPosition.take_profit);
        }

        if (update.takeProfit) {
          update.takeProfit.forEach((level) => {
            expect(tradeExecution.executeOrder).toHaveBeenCalledWith(
              expect.objectContaining({
                symbol: mockPosition.symbol,
                side: "sell",
                type: "limit",
                qty: expect.any(Number),
                limit_price: level.price,
              })
            );
          });
        }
      }
    });
  });

  describe("Risk Management Integration", () => {
    test("should validate position creation through entire flow", async () => {
      // 1. Get strategy signal
      const signal = await emaPullback.analyze(mockBars, "4Hour");

      if (signal.isValid && signal.entry) {
        // 2. Calculate and validate position size
        const riskParams = {
          accountBalance: 100000,
          riskPercentage: 1,
          entry_price: signal.entry,
          stop_loss: signal.stopLoss!,
          take_profit: signal.entry + (signal.entry - signal.stopLoss!) * 2,
        };

        // Validate new position
        const validation = riskManagement.validateNewPosition(riskParams, [mockPosition]);
        expect(validation.isValid).toBeDefined();

        if (validation.isValid) {
          const positionSize = riskManagement.calculatePositionSize(riskParams);

          // 3. Execute trade
          await tradeExecution.executeOrder({
            symbol: "AAPL",
            side: "buy",
            type: "limit",
            qty: positionSize.size,
            time_in_force: "gtc",
            limit_price: signal.entry,
          });

          expect(tradeExecution.executeOrder).toHaveBeenCalled();
        }
      }
    });

    test("should enforce position limits", async () => {
      // Create mock positions at limit
      const existingPositions: Position[] = Array(3).fill(mockPosition);

      // Attempt to validate new position
      const validation = riskManagement.validateNewPosition(
        {
          accountBalance: 100000,
          riskPercentage: 1,
          entry_price: 150,
          stop_loss: 145,
          take_profit: 160,
        },
        existingPositions
      );

      expect(validation.isValid).toBe(false);
      expect(validation.reason).toContain("Maximum number of positions");
    });
  });
});
