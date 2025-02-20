import express, { Express } from "express";
import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as alpaca from "./services/alpaca";
import { generateCandlestickChart, generateVolumeChart } from "./services/chart";
import { getHistoricalBars } from "./services/alpaca";

const router = express.Router();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = app.listen(5000, () => {
    console.log("Server running on port 5000");
  });

  // WebSocket server setup
  const wss = new WebSocketServer({ server: httpServer });

  // Handle WebSocket connections
  wss.on("connection", (ws: WebSocket) => {
    console.log("[WS] Client connected to WebSocket");
    let currentSymbol: string | null = null;
    let intervalId: NodeJS.Timeout | null = null;

    const sendBarsUpdate = async (symbol: string) => {
      try {
        const bars = await getHistoricalBars(symbol, "4Hour", 200);
        ws.send(JSON.stringify({ type: "bars", data: bars }));
      } catch (error) {
        console.error(`[WS] Error fetching bars for ${symbol}:`, error);
      }
    };

    const startDataStream = (symbol: string) => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      currentSymbol = symbol;
      sendBarsUpdate(symbol);
      intervalId = setInterval(() => sendBarsUpdate(symbol), 60000); // Update every minute
    };

    const stopDataStream = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      currentSymbol = null;
    };

    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log("[WS] Received message:", data);

        if (data.type === "subscribe") {
          if (currentSymbol !== data.symbol) {
            console.log(`[WS] Subscribing to ${data.symbol}`);
            startDataStream(data.symbol);
          }
        } else if (data.type === "unsubscribe") {
          console.log(`[WS] Unsubscribing from ${data.symbol}`);
          stopDataStream();
        }
      } catch (error) {
        console.error("[WS] Error processing message:", error);
      }
    });

    ws.on("close", () => {
      console.log("[WS] Client disconnected");
      stopDataStream();
    });

    // Send initial data for AAPL
    startDataStream("AAPL");
  });

  // Chart image endpoints
  app.get("/api/charts/candlestick/:symbol", async (req, res) => {
    try {
      const bars = await getHistoricalBars(req.params.symbol, "4Hour", 100);

      if (!bars || !Array.isArray(bars) || bars.length === 0) {
        console.error("No bars data available");
        return res.status(404).json({
          error: "No data found",
          details: `No bars available for ${req.params.symbol}`,
        });
      }

      const image = await generateCandlestickChart(bars);
      res.contentType("image/png");
      res.send(image);
    } catch (error) {
      console.error("Error generating candlestick chart:", error);
      res.status(500).json({
        error: "Failed to generate chart",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/charts/volume/:symbol", async (req, res) => {
    try {
      const bars = await getHistoricalBars(req.params.symbol, "4Hour", 100);

      if (!bars || !Array.isArray(bars) || bars.length === 0) {
        console.error("No bars data available");
        return res.status(404).json({
          error: "No data found",
          details: `No bars available for ${req.params.symbol}`,
        });
      }

      const image = await generateVolumeChart(bars);
      res.contentType("image/png");
      res.send(image);
    } catch (error) {
      console.error("Error generating volume chart:", error);
      res.status(500).json({
        error: "Failed to generate chart",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // REST endpoints
  app.get("/api/bars/:symbol", async (req, res) => {
    try {
      console.log(`[API] Fetching bars for symbol: ${req.params.symbol}`);
      const bars = await getHistoricalBars(req.params.symbol, "4Hour", 200);

      if (!bars || !Array.isArray(bars) || bars.length === 0) {
        console.log("[API] No bars data available");
        return res.status(404).json({
          error: "No data found",
          details: `No bars available for ${req.params.symbol}`,
        });
      }

      // Compress and send the response
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Connection", "keep-alive");

      // Send the response in chunks
      const chunkSize = 50;
      for (let i = 0; i < bars.length; i += chunkSize) {
        const chunk = bars.slice(i, i + chunkSize);
        if (i === 0) {
          // First chunk, start the array
          res.write("[\n");
        }

        // Write the chunk
        chunk.forEach((bar, index) => {
          res.write(JSON.stringify(bar));
          if (i + index < bars.length - 1) {
            res.write(",\n");
          }
        });
      }

      // End the array and response
      res.write("\n]");
      res.end();
    } catch (error) {
      console.error("[API] Error fetching bars:", error);
      res.status(500).json({
        error: "Failed to fetch market data",
        details: error instanceof Error ? error.message : "Unknown error",
        symbol: req.params.symbol,
      });
    }
  });

  app.get("/api/account", async (req, res) => {
    try {
      console.log("[API] Fetching account data...");
      const account = await alpaca.getAccount();
      console.log("[API] Account data:", JSON.stringify(account, null, 2));
      res.setHeader("Content-Type", "application/json");
      res.json(account);
    } catch (error) {
      console.error("[API] Error fetching account data:", error);
      res.status(500).json({
        error: "Failed to fetch account data",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/positions", async (req, res) => {
    try {
      console.log("[API] Fetching positions...");
      const positions = await alpaca.getPositions();
      console.log("[API] Retrieved positions:", positions.length);
      res.setHeader("Content-Type", "application/json");
      res.json(positions);
    } catch (error) {
      console.error("[API] Error fetching positions:", error);
      res.status(500).json({
        error: "Failed to fetch positions",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Simple login endpoint
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    console.log("Login attempt with:", { username, password });

    // Check hardcoded credentials
    if (username === "malburg" && password === "laquie321") {
      console.log("Login successful");
      res.json({ success: true });
    } else {
      console.log("Login failed");
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  return httpServer;
}

export default router;
