import { describe, expect, test } from "@jest/globals";
import { riskManagement } from "../services/riskManagement";
import { Position } from "../types/trading";

describe("RiskManagementService", () => {
  describe("calculatePositionSize", () => {
    test("should calculate correct position size based on risk parameters", () => {
      const params = {
        accountBalance: 100000,
        riskPercentage: 1,
        entry_price: 150,
        stop_loss: 145,
        take_profit: 160,
      };

      const result = riskManagement.calculatePositionSize(params);

      // Expected calculations:
      // Risk amount = $100000 * 1% = $1000
      // Risk per share = $150 - $145 = $5
      // Expected size = $1000 / $5 = 200 shares
      expect(result.size).toBe(200);
      expect(result.riskAmount).toBe(1000);
      expect(result.riskRewardRatio).toBe(2); // ($160 - $150) / ($150 - $145) = 2
    });

    test("should respect maximum risk percentage", () => {
      const params = {
        accountBalance: 100000,
        riskPercentage: 3, // Above maximum of 2%
        entry_price: 150,
        stop_loss: 145,
        take_profit: 160,
      };

      expect(() => riskManagement.calculatePositionSize(params)).toThrow(/Invalid risk percentage/);
    });

    test("should handle minimum position size", () => {
      const params = {
        accountBalance: 1000,
        riskPercentage: 0.5, // Minimum risk
        entry_price: 150,
        stop_loss: 149.9, // Very tight stop
        take_profit: 160,
      };

      const result = riskManagement.calculatePositionSize(params);
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe("validateNewPosition", () => {
    const baseParams = {
      accountBalance: 100000,
      riskPercentage: 1,
      entry_price: 150,
      stop_loss: 145,
      take_profit: 160,
    };

    test("should validate position within risk limits", () => {
      const result = riskManagement.validateNewPosition(baseParams, []);
      expect(result.isValid).toBe(true);
    });

    test("should reject when maximum positions reached", () => {
      const existingPositions: Position[] = [
        {
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
        },
        {
          symbol: "MSFT",
          qty: 50,
          size: 50,
          entry_price: 350,
          current_price: 355,
          market_value: 17750,
          unrealized_pl: 250,
          stop_loss: 345,
          take_profit: 365,
          risk_percentage: 1,
        },
        {
          symbol: "GOOGL",
          qty: 20,
          size: 20,
          entry_price: 2800,
          current_price: 2850,
          market_value: 57000,
          unrealized_pl: 1000,
          stop_loss: 2750,
          take_profit: 2900,
          risk_percentage: 1,
        },
      ];

      const result = riskManagement.validateNewPosition(baseParams, existingPositions);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Maximum number of positions");
    });

    test("should reject when total risk exceeds limit", () => {
      const existingPositions: Position[] = [
        {
          symbol: "AAPL",
          qty: 100,
          size: 100,
          entry_price: 150,
          current_price: 155,
          market_value: 15500,
          unrealized_pl: 500,
          stop_loss: 145,
          take_profit: 165,
          risk_percentage: 2,
        },
        {
          symbol: "MSFT",
          qty: 50,
          size: 50,
          entry_price: 350,
          current_price: 355,
          market_value: 17750,
          unrealized_pl: 250,
          stop_loss: 345,
          take_profit: 365,
          risk_percentage: 2,
        },
      ];

      const params = {
        ...baseParams,
        riskPercentage: 2, // Would bring total to 6%
      };

      const result = riskManagement.validateNewPosition(params, existingPositions);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("exceed maximum");
    });

    test("should validate risk-reward ratio", () => {
      const poorRRParams = {
        ...baseParams,
        take_profit: 152, // Less than 1:1 risk-reward
      };

      const result = riskManagement.validateNewPosition(poorRRParams, []);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("risk-reward ratio");
    });
  });

  describe("validateStopLossModification", () => {
    const basePosition: Position = {
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

    test("should allow stop loss movement in profit direction", () => {
      const result = riskManagement.validateStopLossModification(basePosition, 148);
      expect(result.isValid).toBe(true);
    });

    test("should reject stop loss movement against position", () => {
      const result = riskManagement.validateStopLossModification(basePosition, 142);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("direction of profit");
    });

    test("should validate risk-reward ratio after modification", () => {
      const result = riskManagement.validateStopLossModification(basePosition, 154);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("risk-reward ratio");
    });
  });
});
