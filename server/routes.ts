import express, { Express } from "express";
import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as alpaca from "./services/alpaca";
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
    console.log("Client connected to WebSocket");

    // Send initial data
    getHistoricalBars("AAPL", "4Hour", 100)
      .then((bars) => {
        ws.send(JSON.stringify({ type: "bars", data: bars }));
      })
      .catch((error) => {
        console.error("Error fetching initial data:", error);
      });
  });

  // REST endpoints
  app.get("/api/bars/aapl", async (req, res) => {
    try {
      const bars = await getHistoricalBars("AAPL", "4Hour", 100);
      res.json(bars);
    } catch (error) {
      console.error("Error fetching AAPL bars:", error);
      res.status(500).json({ error: "Failed to fetch AAPL data" });
    }
  });

  // HTTP API routes
  app.get("/api/bars/:symbol", async (req, res) => {
    try {
      console.log(`Fetching bars for symbol: ${req.params.symbol}`);
      const bars = await getHistoricalBars(req.params.symbol, "4Hour", 100);
      console.log(`Successfully fetched ${bars.length} bars`);
      console.log("Sample bar:", bars[0]); // Log first bar for debugging
      res.json(bars);
    } catch (error) {
      console.error("Error fetching bars:", error);
      res.status(500).json({
        error: "Failed to fetch market data",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/account", async (req, res) => {
    try {
      const account = await alpaca.getAccount();
      res.json(account);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch account data" });
    }
  });

  app.get("/api/positions", async (req, res) => {
    try {
      const positions = await alpaca.getPositions();
      res.json(positions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch positions" });
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
