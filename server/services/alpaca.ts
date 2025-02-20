import Alpaca from "@alpacahq/alpaca-trade-api";
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

// Initialize Alpaca client
const alpaca = new Alpaca({
  keyId: process.env.APCA_API_KEY_ID,
  secretKey: process.env.APCA_API_SECRET_KEY,
  paper: true,
  feed: "iex",
  baseUrl: "https://paper-api.alpaca.markets",
});

// Function to get historical bars
async function getHistoricalBars(symbol: string, timeframe = "4Hour", limit = 100) {
  try {
    console.log(`[Alpaca] Fetching last ${limit} ${timeframe} bars for ${symbol}...`);

    // Calculate start date based on timeframe to ensure we get enough bars
    const end = new Date();
    const start = new Date();
    const daysToFetch = timeframe === "4Hour" ? 30 : 5; // Fetch more days for 4-hour charts
    start.setDate(start.getDate() - daysToFetch);

    console.log(`[Alpaca] Date range: ${start.toISOString()} to ${end.toISOString()}`);
    console.log(`[Alpaca] API Key: ${process.env.APCA_API_KEY_ID?.slice(0, 5)}...`);
    console.log(`[Alpaca] Using feed: iex`);

    const resp = await alpaca.getBarsV2(symbol, {
      start: start.toISOString(),
      end: end.toISOString(),
      timeframe: timeframe,
      feed: "iex",
      limit: limit,
    });

    console.log(`[Alpaca] Got response from getBarsV2`);

    // Convert response to array
    const bars = [];
    for await (const bar of resp) {
      bars.push({
        timestamp: bar.Timestamp,
        open: Number(bar.OpenPrice),
        high: Number(bar.HighPrice),
        low: Number(bar.LowPrice),
        close: Number(bar.ClosePrice),
        volume: Number(bar.Volume),
      });
    }

    // Get the last 100 bars if we have more
    const lastBars = bars.slice(-limit);

    console.log(`[Alpaca] Retrieved ${lastBars.length} bars`);
    if (lastBars.length > 0) {
      console.log("[Alpaca] First bar:", JSON.stringify(lastBars[0], null, 2));
      console.log("[Alpaca] Last bar:", JSON.stringify(lastBars[lastBars.length - 1], null, 2));
    } else {
      console.log("[Alpaca] No bars retrieved");
    }

    // Validate data format
    if (!Array.isArray(lastBars)) {
      throw new Error("Invalid data format: bars is not an array");
    }

    for (const bar of lastBars) {
      if (
        !bar.timestamp ||
        typeof bar.open !== "number" ||
        typeof bar.high !== "number" ||
        typeof bar.low !== "number" ||
        typeof bar.close !== "number" ||
        typeof bar.volume !== "number"
      ) {
        console.error("[Alpaca] Invalid bar format:", bar);
        throw new Error("Invalid bar format: missing required fields or invalid types");
      }
    }

    return lastBars;
  } catch (error) {
    console.error("[Alpaca] Error fetching bars:", error);
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
export { alpaca, getHistoricalBars, getAccount, getPositions };
