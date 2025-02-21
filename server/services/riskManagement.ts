interface Position {
  symbol: string;
  entry_price: number;
  current_price: number;
  stop_loss: number;
  take_profit: number;
  size: number;
  unrealized_pl: number;
  risk_percentage: number;
}

interface RiskParameters {
  accountBalance: number;
  riskPercentage: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
}

class RiskManagementService {
  private static instance: RiskManagementService;
  private readonly MIN_RISK_PERCENTAGE = 0.5;
  private readonly MAX_RISK_PERCENTAGE = 2.0;
  private readonly MAX_TOTAL_RISK_PERCENTAGE = 6.0;

  private constructor() {}

  public static getInstance(): RiskManagementService {
    if (!RiskManagementService.instance) {
      RiskManagementService.instance = new RiskManagementService();
    }
    return RiskManagementService.instance;
  }

  public calculatePositionSize(params: RiskParameters): {
    size: number;
    riskAmount: number;
    maxRiskAmount: number;
    riskRewardRatio: number;
  } {
    try {
      console.log(`[Risk] Calculating position size for entry at ${params.entry_price}`);

      // Validate risk percentage
      if (!this.validateRiskPercentage(params.riskPercentage)) {
        throw new Error(`Invalid risk percentage: ${params.riskPercentage}%. Must be between ${this.MIN_RISK_PERCENTAGE}% and ${this.MAX_RISK_PERCENTAGE}%`);
      }

      // Calculate risk amount
      const riskAmount = (params.accountBalance * params.riskPercentage) / 100;
      const maxRiskAmount = (params.accountBalance * this.MAX_RISK_PERCENTAGE) / 100;

      // Calculate position size based on stop loss
      const riskPerShare = Math.abs(params.entry_price - params.stop_loss);
      if (riskPerShare === 0) {
        throw new Error("Invalid stop loss: Must be different from entry price");
      }

      const size = Math.floor(riskAmount / riskPerShare);

      // Calculate risk-reward ratio
      const reward = Math.abs(params.take_profit - params.entry_price);
      const riskRewardRatio = reward / riskPerShare;

      console.log(`[Risk] Position size calculated: ${size} units`);
      console.log(`[Risk] Risk amount: $${riskAmount.toFixed(2)}`);
      console.log(`[Risk] Risk-reward ratio: ${riskRewardRatio.toFixed(2)}`);

      return {
        size,
        riskAmount,
        maxRiskAmount,
        riskRewardRatio,
      };
    } catch (error) {
      console.error("[Risk] Error calculating position size:", error);
      throw error;
    }
  }

  public validateNewPosition(
    params: RiskParameters,
    openPositions: Position[]
  ): {
    isValid: boolean;
    reason?: string;
  } {
    try {
      // Check maximum positions
      if (openPositions.length >= 3) {
        return {
          isValid: false,
          reason: "Maximum number of positions (3) reached",
        };
      }

      // Validate risk percentage
      if (!this.validateRiskPercentage(params.riskPercentage)) {
        return {
          isValid: false,
          reason: `Risk percentage ${params.riskPercentage}% outside allowed range (${this.MIN_RISK_PERCENTAGE}%-${this.MAX_RISK_PERCENTAGE}%)`,
        };
      }

      // Calculate total risk including open positions
      const currentTotalRisk = this.calculateTotalRisk(openPositions);
      const newPositionRisk = params.riskPercentage;
      const totalRisk = currentTotalRisk + newPositionRisk;

      if (totalRisk > this.MAX_TOTAL_RISK_PERCENTAGE) {
        return {
          isValid: false,
          reason: `Total risk ${totalRisk.toFixed(2)}% would exceed maximum ${this.MAX_TOTAL_RISK_PERCENTAGE}%`,
        };
      }

      // Validate risk-reward ratio
      const riskPerShare = Math.abs(params.entry_price - params.stop_loss);
      const rewardPerShare = Math.abs(params.take_profit - params.entry_price);
      const riskRewardRatio = rewardPerShare / riskPerShare;

      if (riskRewardRatio < 1) {
        return {
          isValid: false,
          reason: `Risk-reward ratio ${riskRewardRatio.toFixed(2)} below minimum 1.0`,
        };
      }

      if (riskRewardRatio > 4) {
        return {
          isValid: false,
          reason: `Risk-reward ratio ${riskRewardRatio.toFixed(2)} above maximum 4.0`,
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error("[Risk] Error validating position:", error);
      return {
        isValid: false,
        reason: `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  public validateStopLossModification(
    position: Position,
    newStopLoss: number
  ): {
    isValid: boolean;
    reason?: string;
  } {
    try {
      // Only allow stop loss modifications in profit direction
      const isLong = position.entry_price < position.current_price;
      const isStopLossImproving = isLong ? newStopLoss > position.stop_loss : newStopLoss < position.stop_loss;

      if (!isStopLossImproving) {
        return {
          isValid: false,
          reason: "Stop loss can only be modified in the direction of profit",
        };
      }

      // Validate risk-reward ratio
      const newRisk = Math.abs(position.entry_price - newStopLoss);
      const reward = Math.abs(position.take_profit - position.entry_price);
      const newRiskRewardRatio = reward / newRisk;

      if (newRiskRewardRatio < 1) {
        return {
          isValid: false,
          reason: `New risk-reward ratio ${newRiskRewardRatio.toFixed(2)} would be below minimum 1.0`,
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error("[Risk] Error validating stop loss modification:", error);
      return {
        isValid: false,
        reason: `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private validateRiskPercentage(riskPercentage: number): boolean {
    return riskPercentage >= this.MIN_RISK_PERCENTAGE && riskPercentage <= this.MAX_RISK_PERCENTAGE;
  }

  private calculateTotalRisk(positions: Position[]): number {
    return positions.reduce((total, position) => total + position.risk_percentage, 0);
  }
}

export const riskManagement = RiskManagementService.getInstance();
