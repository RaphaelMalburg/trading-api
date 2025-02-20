import Alpaca from "@alpacahq/alpaca-trade-api";
import WebSocket from "ws";

// Check if environment variables are set
if (!process.env.APCA_API_KEY_ID || !process.env.APCA_API_SECRET_KEY) {
  throw new Error("Alpaca API credentials not found in environment variables");
}

console.log("Using API Key:", process.env.APCA_API_KEY_ID);

// Initialize Alpaca client
const alpaca = new Alpaca({
  keyId: process.env.APCA_API_KEY_ID,
  secretKey: process.env.APCA_API_SECRET_KEY,
  paper: true,
  feed: "iex",
});

// Function to get historical bars
async function getHistoricalBars(symbol: string, timeframe = "4Hour", limit = 100) {
  try {
    console.log(`Fetching last ${limit} ${timeframe} bars for ${symbol}...`);

    // Calculate start date based on timeframe to ensure we get enough bars
    const end = new Date();
    const start = new Date();
    const daysToFetch = timeframe === "4Hour" ? 30 : 5; // Fetch more days for 4-hour charts
    start.setDate(start.getDate() - daysToFetch);

    console.log(`Fetching data from ${start.toISOString()} to ${end.toISOString()}`);

    const resp = await alpaca.getBarsV2(symbol, {
      start: start.toISOString(),
      end: end.toISOString(),
      timeframe: timeframe,
      feed: "iex",
      limit: limit,
    });

    // Convert response to array
    const bars = [];
    for await (const bar of resp) {
      bars.push({
        timestamp: bar.Timestamp,
        open: bar.OpenPrice,
        high: bar.HighPrice,
        low: bar.LowPrice,
        close: bar.ClosePrice,
        volume: bar.Volume,
      });
    }

    // Get the last 100 bars if we have more
    const lastBars = bars.slice(-limit);

    console.log(`Retrieved ${lastBars.length} bars`);
    if (lastBars.length > 0) {
      console.log("First bar:", lastBars[0]);
      console.log("Last bar:", lastBars[lastBars.length - 1]);
    }

    return lastBars;
  } catch (error) {
    console.error("Error fetching bars:", error);
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

// Add these functions before the export statement
async function getAccount() {
  return await alpaca.getAccount();
}

async function getPositions() {
  return await alpaca.getPositions();
}

// Update exports
export { alpaca, getHistoricalBars, getAccount, getPositions };
