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
async function getHistoricalBars(symbol: string, timeframe = "4Hour", limit = 100, startDate?: Date, endDate?: Date) {
  try {
    console.log(`[Alpaca] Fetching ${timeframe} bars for ${symbol}...`);

    // Calculate default dates if not provided
    const now = new Date();
    let end = endDate ? new Date(endDate) : now;
    let start = startDate ? new Date(startDate) : new Date(end);

    // If dates are in the future, adjust them to current time
    if (end > now) {
      console.log("[Alpaca] Warning: End date is in the future. Using current time.");
      end = now;
    }

    // For backtesting, we need at least 60 bars
    // Calculate minimum start date based on timeframe
    const minBarsNeeded = 60;
    const hoursPerBar = timeframe === "4Hour" ? 4 : 1;
    const minHoursNeeded = minBarsNeeded * hoursPerBar;
    const minDaysNeeded = Math.ceil(minHoursNeeded / 6.5); // 6.5 trading hours per day

    // If start date is not provided or too recent, adjust it
    if (!startDate || start > end) {
      start = new Date(end);
      start.setDate(start.getDate() - (minDaysNeeded + 5)); // Add extra days for safety
    }

    // Ensure we have enough historical data
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < minDaysNeeded) {
      start.setDate(start.getDate() - (minDaysNeeded - daysDiff + 5)); // Add extra days for safety
    }

    console.log(`[Alpaca] Requesting bars from ${start.toISOString()} to ${end.toISOString()}`);
    console.log(`[Alpaca] API Key: ${process.env.APCA_API_KEY_ID?.slice(0, 5)}...`);

    const resp = await alpaca.getBarsV2(symbol, {
      start: start.toISOString(),
      end: end.toISOString(),
      timeframe: timeframe,
      feed: "iex",
      adjustment: "all", // Include all adjustments
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

    // Log detailed bar information
    console.log(`[Alpaca] Retrieved ${bars.length} bars`);
    if (bars.length > 0) {
      console.log(`[Alpaca] First bar: ${JSON.stringify(bars[0], null, 2)}`);
      console.log(`[Alpaca] Last bar: ${JSON.stringify(bars[bars.length - 1], null, 2)}`);

      // Log time gaps
      for (let i = 1; i < bars.length; i++) {
        const timeDiff = new Date(bars[i].timestamp).getTime() - new Date(bars[i - 1].timestamp).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        if (hoursDiff > 4) {
          console.log(`[Alpaca] Time gap detected between bars ${i - 1} and ${i}: ${hoursDiff} hours`);
        }
      }
    } else {
      console.log("[Alpaca] No bars retrieved");
      console.log("[Alpaca] This might be due to:");
      console.log("- Market being closed during the requested period");
      console.log("- Future dates with no data");
      console.log("- No trading activity in the specified timeframe");
      throw new Error("No historical data available for the specified period");
    }

    if (bars.length < minBarsNeeded) {
      throw new Error(`Insufficient historical data. Retrieved ${bars.length} bars but need at least ${minBarsNeeded} bars for accurate backtesting.`);
    }

    return bars;
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
