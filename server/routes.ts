import express, { Express, Request, Response } from "express";
import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as alpaca from "./services/alpaca.js";
import { generateCandlestickChart, generateVolumeChart } from "./services/chart.js";
import { generateAnalysisChart } from "./services/chartAnalysis.js";
import { aiAnalysis } from "./services/aiAnalysis.js";
import { getHistoricalBars } from "./services/alpaca.js";
import { backtesting } from "./services/backtesting.js";
import { database } from "./services/database.js";

const router = express.Router();

interface BacktestRequest {
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  riskPerTrade: number;
}

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

  app.get("/api/charts/analysis/:symbol", async (req, res) => {
    try {
      console.log(`[API] Generating analysis chart for ${req.params.symbol}`);
      const bars = await getHistoricalBars(req.params.symbol, "4Hour", 200);

      if (!bars || !Array.isArray(bars) || bars.length === 0) {
        console.error("No bars data available");
        return res.status(404).json({
          error: "No data found",
          details: `No bars available for ${req.params.symbol}`,
        });
      }

      const image = await generateAnalysisChart(bars, req.params.symbol);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-cache");
      res.send(image);
    } catch (error) {
      console.error("Error generating analysis chart:", error);
      res.status(500).json({
        error: "Failed to generate analysis chart",
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

  // Chart analysis endpoint
  app.post("/api/analyze/:symbol", async (req, res) => {
    try {
      console.log(`[API] Analyzing chart for ${req.params.symbol}`);
      const timeframe = (req.query.timeframe as string) || "4Hour";

      // Get historical data
      const bars = await getHistoricalBars(req.params.symbol, timeframe, 200);
      if (!bars || !Array.isArray(bars) || bars.length === 0) {
        console.error("No bars data available");
        return res.status(404).json({
          error: "No data found",
          details: `No bars available for ${req.params.symbol}`,
        });
      }

      // Generate analysis chart
      const chartImage = await generateAnalysisChart(bars, req.params.symbol);

      // Analyze chart with AI
      const analysis = await aiAnalysis.analyzeChart(req.params.symbol, timeframe, 100000, []);

      // Return analysis result
      res.json({
        symbol: req.params.symbol,
        timeframe,
        analysis,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[API] Error analyzing chart:", error);
      res.status(500).json({
        error: "Failed to analyze chart",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Backtesting endpoint
  app.post("/api/backtest", async (req: Request<{}, {}, BacktestRequest>, res: Response) => {
    try {
      console.log("[Backtest] Received request:", req.body);

      const { symbol, timeframe, startDate, endDate, initialBalance, riskPerTrade } = req.body;

      // Validate required parameters
      if (!symbol || !timeframe || !startDate || !endDate || !initialBalance || !riskPerTrade) {
        return res.status(400).json({
          error: "Missing required parameters",
          required: ["symbol", "timeframe", "startDate", "endDate", "initialBalance", "riskPerTrade"],
          received: req.body,
        });
      }

      // Parse dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: "Invalid date format",
          startDate,
          endDate,
        });
      }

      if (start >= end) {
        return res.status(400).json({
          error: "Start date must be before end date",
          startDate,
          endDate,
        });
      }

      // Run backtest
      console.log(`[Backtest] Running backtest for ${symbol} from ${startDate} to ${endDate}`);
      const result = await backtesting.runBacktest(symbol, timeframe, start, end, initialBalance, riskPerTrade);

      console.log(`[Backtest] Completed with ${result.total_trades} trades`);
      res.json(result);
    } catch (error) {
      console.error("[Backtest] Error:", error);
      res.status(500).json({
        error: "Backtest failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Backtest endpoints
  app.get("/api/backtests", async (req, res) => {
    try {
      const backtests = await database.getAllBacktests();
      res.json(backtests);
    } catch (error) {
      console.error("[API] Error fetching backtests:", error);
      res.status(500).json({ error: "Failed to fetch backtests" });
    }
  });

  app.get("/api/backtests/:id", async (req, res) => {
    try {
      const backtest = await database.getBacktestById(Number(req.params.id));
      if (!backtest) {
        res.status(404).json({ error: "Backtest not found" });
        return;
      }
      res.json(backtest);
    } catch (error) {
      console.error("[API] Error fetching backtest:", error);
      res.status(500).json({ error: "Failed to fetch backtest" });
    }
  });

  app.post("/api/backtest", async (req, res) => {
    try {
      const { symbol, timeframe, startDate, endDate, initialBalance, riskPerTrade } = req.body;

      const result = await backtesting.runBacktest(symbol, timeframe, new Date(startDate), new Date(endDate), Number(initialBalance), Number(riskPerTrade));

      res.json(result);
    } catch (error) {
      console.error("[API] Error running backtest:", error);
      res.status(500).json({ error: "Failed to run backtest" });
    }
  });

  return httpServer;
}

export default router;
