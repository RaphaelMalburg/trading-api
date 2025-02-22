// @ts-ignore
import AlpacaApi from "@alpacahq/alpaca-trade-api";
import WebSocket from "ws";

// Check if environment variables are set
if (!process.env.APCA_API_KEY_ID || !process.env.APCA_API_SECRET_KEY) {
  throw new Error("Alpaca API credentials not found in environment variables");
}

console.log("Using API Key:", process.env.APCA_API_KEY_ID);

// Types
interface Account {
  equity: number;
  buying_power: number;
  cash: number;
  portfolio_value: number;
  day_trade_count: number;
}

interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Position {
  symbol: string;
  qty: number;
  market_value: number;
  unrealized_pl: number;
  current_price: number;
}

interface AlpacaPosition {
  symbol: string;
  qty: string | number;
  market_value: string | number;
  unrealized_pl: string | number;
  current_price: string | number;
}

// @ts-ignore
const alpaca = new AlpacaApi({
  keyId: process.env.APCA_API_KEY_ID,
  secretKey: process.env.APCA_API_SECRET_KEY,
  paper: true,
  feed: "iex",
  baseUrl: "https://paper-api.alpaca.markets",
  apiVersion: "v2",
});

// Function to get historical bars
export async function getHistoricalBars(symbol: string, timeframe: string, limit: number = 200): Promise<Bar[]> {
  try {
    console.log("[Alpaca] Fetching historical bars:", {
      symbol,
      timeframe,
      limit,
      timestamp: new Date().toISOString(),
    });

    // Calculate the end date (current time) and start date based on the limit
    const end = new Date();
    const start = new Date();

    // Adjust start date based on timeframe and limit
    switch (timeframe.toLowerCase()) {
      case "1min":
        start.setMinutes(start.getMinutes() - limit);
        break;
      case "5min":
        start.setMinutes(start.getMinutes() - limit * 5);
        break;
      case "15min":
        start.setMinutes(start.getMinutes() - limit * 15);
        break;
      case "1h":
        start.setHours(start.getHours() - limit);
        break;
      case "4hour":
      case "4h":
        start.setHours(start.getHours() - limit * 4);
        break;
      case "1d":
        start.setDate(start.getDate() - limit);
        break;
      default:
        start.setHours(start.getHours() - limit * 4); // Default to 4h
    }

    console.log("[Alpaca] Time range:", {
      start: start.toISOString(),
      end: end.toISOString(),
    });

    const bars = await alpaca.getBarsV2(symbol, {
      start: start,
      end: end,
      timeframe: timeframe.toLowerCase() as any,
      limit: limit,
    });

    const barArray = [];
    for await (const bar of bars) {
      barArray.push(bar);
    }

    console.log("[Alpaca] Fetched bars:", {
      count: barArray.length,
      firstBar: barArray[0],
      lastBar: barArray[barArray.length - 1],
    });

    return barArray;
  } catch (error) {
    console.error(`[Alpaca] Error fetching bars for ${symbol}:`, error);
    throw error;
  }
}

// Initialize WebSocket connection
const ws = new WebSocket(process.env.APCA_DATA_STREAM_URL || "wss://stream.data.alpaca.markets/v2/iex");

ws.on("open", () => {
  console.log("WebSocket connected!");

  // Send authentication message
  const authMsg = {
    action: "auth",
    key: process.env.APCA_API_KEY_ID,
    secret: process.env.APCA_API_SECRET_KEY,
  };
  console.log("Sending auth message...");
  ws.send(JSON.stringify(authMsg));
});

ws.on("message", async (data: WebSocket.RawData) => {
  try {
    const message = JSON.parse(data.toString());
    console.log("Received data:", message);

    // If authentication successful, subscribe and get historical data
    if (message[0]?.T === "success" && message[0]?.msg === "authenticated") {
      console.log("Successfully authenticated!");

      // Subscribe to real-time bars
      const subscribeMsg = {
        action: "subscribe",
        bars: ["AAPL"],
      };
      ws.send(JSON.stringify(subscribeMsg));

      // Get historical data
      console.log("Fetching historical AAPL data...");
      const historicalData = await getHistoricalBars("AAPL", "4Hour", 100);
      console.log(`Retrieved ${historicalData.length} historical bars`);
    }

    // Handle real-time bar updates
    if (message[0]?.T === "b") {
      console.log("Real-time bar update:", message[0]);
    }
  } catch (error) {
    console.error("Error handling message:", error);
  }
});

ws.on("error", (error: Error) => {
  console.error("WebSocket error:", error);
});

ws.on("close", () => {
  console.log("WebSocket connection closed");
});

async function getAccount(): Promise<Account> {
  try {
    console.log("[Alpaca] Fetching account information...");
    const account = await alpaca.getAccount();
    console.log("[Alpaca] Account information fetched successfully");
    return {
      equity: Number(account.equity),
      buying_power: Number(account.buying_power),
      cash: Number(account.cash),
      portfolio_value: Number(account.portfolio_value),
      day_trade_count: Number(account.daytrade_count),
    };
  } catch (error) {
    console.error("[Alpaca] Error fetching account:", error);
    throw error;
  }
}

async function getPositions(): Promise<Position[]> {
  try {
    console.log("[Alpaca] Fetching positions...");
    const positions = await alpaca.getPositions();
    console.log("[Alpaca] Positions fetched successfully:", positions.length, "positions found");
    return positions.map((position: AlpacaPosition) => ({
      symbol: position.symbol,
      qty: Number(position.qty),
      market_value: Number(position.market_value),
      unrealized_pl: Number(position.unrealized_pl),
      current_price: Number(position.current_price),
    }));
  } catch (error) {
    console.error("[Alpaca] Error fetching positions:", error);
    throw error;
  }
}

// Update exports
export { alpaca, getAccount, getPositions };
