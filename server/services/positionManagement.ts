import { Bar, Position } from "../types/trading";
import { findPivotPoints, identifyTrendlines } from "../utils/indicators";
import { riskManagement } from "./riskManagement";
import { tradeExecution } from "./tradeExecution";

interface StopLossAdjustment {
  newStopLoss: number;
  reason: string;
  confidence: number;
}

interface TakeProfitLevel {
  price: number;
  size: number; // Percentage of position to close at this level
  riskMultiple: number;
}

interface PositionUpdate {
  stopLoss?: StopLossAdjustment;
  takeProfit?: TakeProfitLevel[];
  shouldClose?: boolean;
  closeReason?: string;
}

class PositionManagementService {
  private static instance: PositionManagementService;
  private readonly MINIMUM_CONFIDENCE = 70;

  private constructor() {}

  public static getInstance(): PositionManagementService {
    if (!PositionManagementService.instance) {
      PositionManagementService.instance = new PositionManagementService();
    }
    return PositionManagementService.instance;
  }

  public async analyzePosition(position: Position, bars: Bar[]): Promise<PositionUpdate> {
    try {
      console.log(`[Position] Analyzing position for ${position.symbol}`);

      // Find technical levels
      const levels = this.findKeyLevels(bars);

      // Check if position should be closed
      const closeSignal = this.checkCloseSignals(position, bars, levels);
      if (closeSignal.shouldClose) {
        return {
          shouldClose: true,
          closeReason: closeSignal.reason,
        };
      }

      // Check for stop loss adjustment
      const stopLossAdjustment = this.calculateStopLossAdjustment(position, bars, levels);

      // Calculate take profit levels
      const takeProfitLevels = this.calculateTakeProfitLevels(position, bars, levels);

      return {
        stopLoss: stopLossAdjustment,
        takeProfit: takeProfitLevels,
      };
    } catch (error) {
      console.error("[Position] Error analyzing position:", error);
      throw error;
    }
  }

  private findKeyLevels(bars: Bar[]) {
    // Find pivot points
    const { pivotHigh, pivotLow } = findPivotPoints(bars);

    // Identify support and resistance levels
    const { support, resistance } = identifyTrendlines(bars);

    return {
      pivotHigh,
      pivotLow,
      support: support.map((level) => level.end),
      resistance: resistance.map((level) => level.end),
    };
  }

  private checkCloseSignals(
    position: Position,
    bars: Bar[],
    levels: { pivotHigh: number[]; pivotLow: number[]; support: number[]; resistance: number[] }
  ): { shouldClose: boolean; reason?: string } {
    const currentPrice = position.current_price;
    const isLong = position.entry_price < currentPrice;

    // Check for technical level breaches
    if (isLong) {
      const nearestSupport = Math.max(...levels.support.filter((level) => level < currentPrice));
      if (currentPrice < nearestSupport) {
        return {
          shouldClose: true,
          reason: `Price breached key support level at ${nearestSupport}`,
        };
      }
    } else {
      const nearestResistance = Math.min(...levels.resistance.filter((level) => level > currentPrice));
      if (currentPrice > nearestResistance) {
        return {
          shouldClose: true,
          reason: `Price breached key resistance level at ${nearestResistance}`,
        };
      }
    }

    // Check risk-reward deterioration
    const currentRR = Math.abs(currentPrice - position.entry_price) / Math.abs(position.stop_loss - position.entry_price);
    if (currentRR < 0.5) {
      return {
        shouldClose: true,
        reason: `Risk-reward ratio deteriorated to ${currentRR.toFixed(2)}`,
      };
    }

    return { shouldClose: false };
  }

  private calculateStopLossAdjustment(
    position: Position,
    bars: Bar[],
    levels: { pivotHigh: number[]; pivotLow: number[]; support: number[]; resistance: number[] }
  ): StopLossAdjustment | undefined {
    const currentPrice = position.current_price;
    const isLong = position.entry_price < currentPrice;
    let confidence = 0;
    let newStopLoss = position.stop_loss;
    let reason = "";

    // Find potential new stop loss level
    if (isLong) {
      // For longs, look for higher lows
      const recentLows = bars.slice(-10).map((bar) => bar.low);
      const potentialStop = Math.max(...recentLows.filter((low) => low < currentPrice));

      if (potentialStop > position.stop_loss) {
        newStopLoss = potentialStop;
        confidence = this.calculateStopLossConfidence(position, newStopLoss, bars);
        reason = "Higher swing low formed";
      }
    } else {
      // For shorts, look for lower highs
      const recentHighs = bars.slice(-10).map((bar) => bar.high);
      const potentialStop = Math.min(...recentHighs.filter((high) => high > currentPrice));

      if (potentialStop < position.stop_loss) {
        newStopLoss = potentialStop;
        confidence = this.calculateStopLossConfidence(position, newStopLoss, bars);
        reason = "Lower swing high formed";
      }
    }

    // Only return adjustment if confidence meets minimum threshold
    if (confidence >= this.MINIMUM_CONFIDENCE && newStopLoss !== position.stop_loss) {
      return {
        newStopLoss,
        reason,
        confidence,
      };
    }

    return undefined;
  }

  private calculateStopLossConfidence(position: Position, newStopLoss: number, bars: Bar[]): number {
    let confidence = 0;
    const currentPrice = position.current_price;
    const isLong = position.entry_price < currentPrice;

    // Price movement in favor (0-40 points)
    const priceMovement = Math.abs(currentPrice - position.entry_price) / position.entry_price;
    confidence += Math.min(40, priceMovement * 1000);

    // Stop loss improvement (0-30 points)
    const stopLossImprovement = Math.abs(newStopLoss - position.stop_loss) / position.stop_loss;
    confidence += Math.min(30, stopLossImprovement * 1000);

    // Volume confirmation (0-30 points)
    const recentVolume = bars.slice(-3).reduce((sum, bar) => sum + bar.volume, 0) / 3;
    const previousVolume = bars.slice(-6, -3).reduce((sum, bar) => sum + bar.volume, 0) / 3;

    if (recentVolume > previousVolume * 1.2) {
      confidence += 30;
    } else if (recentVolume > previousVolume) {
      confidence += 15;
    }

    return Math.min(100, confidence);
  }

  private calculateTakeProfitLevels(
    position: Position,
    bars: Bar[],
    levels: { pivotHigh: number[]; pivotLow: number[]; support: number[]; resistance: number[] }
  ): TakeProfitLevel[] {
    const currentPrice = position.current_price;
    const isLong = position.entry_price < currentPrice;
    const riskAmount = Math.abs(position.entry_price - position.stop_loss);
    const takeProfitLevels: TakeProfitLevel[] = [];

    // Calculate multiple take profit levels based on risk multiples
    const riskMultiples = [1, 2, 3];
    let remainingSize = 100; // 100% of position

    riskMultiples.forEach((multiple, index) => {
      const isLastLevel = index === riskMultiples.length - 1;
      const targetPrice = isLong ? position.entry_price + riskAmount * multiple : position.entry_price - riskAmount * multiple;

      // Adjust size based on risk multiple
      const levelSize = isLastLevel ? remainingSize : index === 0 ? 40 : 30;
      remainingSize -= levelSize;

      // Validate take profit level against technical levels
      const validatedPrice = this.validateTakeProfitLevel(targetPrice, isLong, levels);

      takeProfitLevels.push({
        price: validatedPrice,
        size: levelSize,
        riskMultiple: multiple,
      });
    });

    return takeProfitLevels;
  }

  private validateTakeProfitLevel(targetPrice: number, isLong: boolean, levels: { pivotHigh: number[]; pivotLow: number[]; support: number[]; resistance: number[] }): number {
    if (isLong) {
      // For longs, check nearest resistance above target
      const nearestResistance = Math.min(...levels.resistance.filter((level) => level > targetPrice));
      return nearestResistance ? Math.min(targetPrice, nearestResistance * 0.995) : targetPrice;
    } else {
      // For shorts, check nearest support below target
      const nearestSupport = Math.max(...levels.support.filter((level) => level < targetPrice));
      return nearestSupport ? Math.max(targetPrice, nearestSupport * 1.005) : targetPrice;
    }
  }

  public async updatePosition(position: Position, update: PositionUpdate): Promise<void> {
    try {
      if (update.shouldClose) {
        await tradeExecution.closePosition(position.symbol);
        console.log(`[Position] Closed position for ${position.symbol}: ${update.closeReason}`);
        return;
      }

      if (update.stopLoss) {
        await tradeExecution.modifyPosition(position.symbol, update.stopLoss.newStopLoss, position.take_profit);
        console.log(`[Position] Updated stop loss for ${position.symbol} to ${update.stopLoss.newStopLoss}`);
      }

      if (update.takeProfit && update.takeProfit.length > 0) {
        // Implement take profit orders
        for (const level of update.takeProfit) {
          // Calculate the quantity for this level
          const levelQty = Math.floor(position.qty * (level.size / 100));

          if (levelQty > 0) {
            await tradeExecution.executeOrder({
              symbol: position.symbol,
              side: "sell",
              type: "limit",
              qty: levelQty,
              time_in_force: "gtc",
              limit_price: level.price,
            });
          }
        }
        console.log(`[Position] Set take profit levels for ${position.symbol}`);
      }
    } catch (error) {
      console.error("[Position] Error updating position:", error);
      throw error;
    }
  }
}

export const positionManagement = PositionManagementService.getInstance();
