import { alpaca } from "./alpaca";
import { riskManagement } from "./riskManagement";

interface TradeOrder {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  qty: number;
  time_in_force: "day" | "gtc" | "ioc";
  limit_price?: number;
  stop_price?: number;
}

interface Position {
  symbol: string;
  qty: number;
  size: number;
  entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pl: number;
  stop_loss: number;
  take_profit: number;
  risk_percentage: number;
}

class TradeExecutionService {
  private static instance: TradeExecutionService;
  private readonly MAX_POSITIONS = 3;
  private positions: Map<string, Position> = new Map();

  private constructor() {}

  public static getInstance(): TradeExecutionService {
    if (!TradeExecutionService.instance) {
      TradeExecutionService.instance = new TradeExecutionService();
    }
    return TradeExecutionService.instance;
  }

  public async executeOrder(order: TradeOrder): Promise<any> {
    try {
      console.log(`[Trade] Executing ${order.side} order for ${order.qty} ${order.symbol}`);

      // Validate position limit
      if (order.side === "buy" && !(await this.canOpenNewPosition())) {
        throw new Error(`Maximum positions (${this.MAX_POSITIONS}) reached`);
      }

      // Submit order to Alpaca
      const alpacaOrder = await alpaca.createOrder({
        symbol: order.symbol,
        qty: order.qty,
        side: order.side,
        type: order.type,
        time_in_force: order.time_in_force,
        limit_price: order.limit_price,
        stop_price: order.stop_price,
      });

      console.log(`[Trade] Order submitted successfully: ${alpacaOrder.id}`);
      return alpacaOrder;
    } catch (error) {
      console.error("[Trade] Error executing order:", error);
      throw error;
    }
  }

  public async modifyPosition(symbol: string, stopLoss: number, takeProfit: number): Promise<void> {
    try {
      console.log(`[Trade] Modifying position for ${symbol}`);
      const position = await this.getPosition(symbol);

      if (!position) {
        throw new Error(`No position found for ${symbol}`);
      }

      // Validate stop loss modification
      const validationResult = riskManagement.validateStopLossModification(
        {
          ...position,
          stop_loss: position.stop_loss,
          take_profit: position.take_profit,
          risk_percentage: 0, // Not needed for validation
        },
        stopLoss
      );

      if (!validationResult.isValid) {
        throw new Error(`Invalid stop loss modification: ${validationResult.reason}`);
      }

      // Update stop loss order
      await this.updateStopLoss(symbol, stopLoss);

      // Update take profit order
      await this.updateTakeProfit(symbol, takeProfit);

      console.log(`[Trade] Position modified successfully for ${symbol}`);
    } catch (error) {
      console.error("[Trade] Error modifying position:", error);
      throw error;
    }
  }

  public async closePosition(symbol: string): Promise<void> {
    try {
      console.log(`[Trade] Closing position for ${symbol}`);
      const position = await this.getPosition(symbol);

      if (!position) {
        throw new Error(`No position found for ${symbol}`);
      }

      // Submit market order to close position
      await this.executeOrder({
        symbol,
        side: "sell",
        type: "market",
        qty: position.qty,
        time_in_force: "day",
      });

      // Cancel any existing stop loss and take profit orders
      await this.cancelOrders(symbol);

      console.log(`[Trade] Position closed successfully for ${symbol}`);
    } catch (error) {
      console.error("[Trade] Error closing position:", error);
      throw error;
    }
  }

  private async getPosition(symbol: string): Promise<Position | null> {
    try {
      const position = await alpaca.getPosition(symbol);
      return {
        symbol: position.symbol,
        qty: Number(position.qty),
        size: Number(position.qty),
        entry_price: Number(position.avg_entry_price),
        current_price: Number(position.current_price),
        market_value: Number(position.market_value),
        unrealized_pl: Number(position.unrealized_pl),
        stop_loss: 0, // Will be updated from active orders
        take_profit: 0, // Will be updated from active orders
        risk_percentage: 0, // Will be calculated based on position size and stop loss
      };
    } catch (error) {
      if ((error as any).statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  private async canOpenNewPosition(): Promise<boolean> {
    const positions = await alpaca.getPositions();
    return positions.length < this.MAX_POSITIONS;
  }

  private async updateStopLoss(symbol: string, stopPrice: number): Promise<void> {
    // Cancel existing stop loss order
    await this.cancelOrders(symbol, "stop");

    // Create new stop loss order
    await alpaca.createOrder({
      symbol,
      qty: 1, // Will be replaced with actual position size
      side: "sell",
      type: "stop",
      time_in_force: "gtc",
      stop_price: stopPrice,
    });
  }

  private async updateTakeProfit(symbol: string, limitPrice: number): Promise<void> {
    // Cancel existing take profit order
    await this.cancelOrders(symbol, "limit");

    // Create new take profit order
    await alpaca.createOrder({
      symbol,
      qty: 1, // Will be replaced with actual position size
      side: "sell",
      type: "limit",
      time_in_force: "gtc",
      limit_price: limitPrice,
    });
  }

  private async cancelOrders(symbol: string, type?: string): Promise<void> {
    const orders = await alpaca.getOrders({
      status: "open",
      symbols: [symbol],
      after: null,
      until: null,
      limit: 100,
      direction: "desc",
      nested: false,
    });

    for (const order of orders) {
      if (!type || order.type === type) {
        await alpaca.cancelOrder(order.id);
      }
    }
  }
}

export const tradeExecution = TradeExecutionService.getInstance();
