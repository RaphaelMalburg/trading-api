import axios from "axios";
import type { AxiosError } from "axios";
import WebSocket from "ws";
import { Bar } from "../types/trading.js";
import { prisma } from "../db.js";
import { CAPITAL_API, ResolutionType } from "../constants/capital.js";

const CAPITAL_API_KEY = process.env.CAPITAL_API_KEY;
const CAPITAL_IDENTIFIER = process.env.CAPITAL_IDENTIFIER;
const CAPITAL_PASSWORD = process.env.CAPITAL_PASSWORD;

interface SessionResponse {
  CST: string;
  X_SECURITY_TOKEN: string;
}

interface SessionInfo {
  clientId: string;
  currentAccountId: string;
  timezoneOffset: number;
  locale: string;
  currencyIsoCode: string;
  streamEndpoint: string;
}

interface StreamSubscription {
  epic: string;
  ws: WebSocket;
}

interface PriceResponse {
  prices: {
    snapshotTime: string;
    snapshotTimeUTC: string;
    openPrice: { bid: number; ask: number };
    closePrice: { bid: number; ask: number };
    highPrice: { bid: number; ask: number };
    lowPrice: { bid: number; ask: number };
    lastTradedVolume: number;
  }[];
  instrumentType: string;
}

let sessionTokens: SessionResponse | null = null;
let sessionInfo: SessionInfo | null = null;
const activeStreams = new Map<string, StreamSubscription>();

const axiosInstance = axios.create({
  baseURL: CAPITAL_API.BASE_URL,
  headers: {
    [CAPITAL_API.HEADER_API_KEY_NAME]: CAPITAL_API_KEY,
  },
});

// Update request interceptor to include session tokens and handle authentication
axiosInstance.interceptors.request.use(async (config) => {
  // Skip session check for session-related endpoints
  if (config.url?.includes(CAPITAL_API.SESSION)) {
    return config;
  }

  // Ensure we have a valid session before making any request
  await ensureSession();

  if (!sessionTokens) {
    throw new Error("Failed to create session");
  }

  // Add authentication headers
  config.headers["CST"] = sessionTokens.CST;
  config.headers["X-SECURITY-TOKEN"] = sessionTokens.X_SECURITY_TOKEN;
  return config;
});

export async function createSession(): Promise<SessionResponse> {
  console.log("[Capital] Starting session creation process...");

  if (!CAPITAL_API_KEY || !CAPITAL_IDENTIFIER || !CAPITAL_PASSWORD) {
    console.error("[Capital] Missing credentials:", {
      hasApiKey: !!CAPITAL_API_KEY,
      hasIdentifier: !!CAPITAL_IDENTIFIER,
      hasPassword: !!CAPITAL_PASSWORD,
    });
    throw new Error("Missing Capital.com API credentials in environment variables");
  }

  try {
    console.log("[Capital] Sending session creation request");

    const response = await axios.post(
      `${CAPITAL_API.BASE_URL}${CAPITAL_API.SESSION}`,
      {
        identifier: CAPITAL_IDENTIFIER,
        password: CAPITAL_PASSWORD,
        encryptedPassword: false,
      },
      {
        headers: {
          [CAPITAL_API.HEADER_API_KEY_NAME]: CAPITAL_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    // Check for required headers (case sensitive as per API docs)
    const cst = response.headers["cst"];
    const securityToken = response.headers["x-security-token"];

    if (!cst || !securityToken) {
      console.error("[Capital] Missing session tokens in response headers");
      throw new Error("Missing session tokens in response");
    }

    sessionTokens = {
      CST: cst,
      X_SECURITY_TOKEN: securityToken,
    };

    console.log("[Capital] Session created successfully");

    return sessionTokens;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.isAxiosError) {
      console.error("[Capital] Session creation failed:", {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      throw new Error(`Capital.com session creation failed: ${JSON.stringify(axiosError.response?.data || axiosError.message)}`);
    }
    throw error;
  }
}

async function ensureSession() {
  if (!sessionTokens) {
    console.log("[Capital] No session tokens found, creating new session...");
    await createSession();
    return;
  }

  try {
    // Try to verify the current session
    console.log("[Capital] Verifying existing session...");
    const response = await axios.get(`${CAPITAL_API.BASE_URL}${CAPITAL_API.SESSION}`, {
      headers: {
        [CAPITAL_API.HEADER_API_KEY_NAME]: CAPITAL_API_KEY,
        CST: sessionTokens.CST,
        "X-SECURITY-TOKEN": sessionTokens.X_SECURITY_TOKEN,
      },
    });

    sessionInfo = response.data;
    console.log("[Capital] Session is valid");
  } catch (error) {
    console.log("[Capital] Session expired or invalid, creating new session...");
    sessionTokens = null;
    sessionInfo = null;
    await createSession();
  }
}

export async function getHistoricalData(symbol: string, timeframe: ResolutionType = ResolutionType.HOUR, limit: number = 10, from?: string, to?: string): Promise<Bar[]> {
  console.log("[Capital] Starting historical data fetch...");

  try {
    // Format symbol for Capital.com API (e.g., EUR/USD -> EUR_USD)
    const formattedSymbol = symbol.replace("/", "_").toUpperCase();

    // Prepare query parameters
    const params: Record<string, string | number> = {
      resolution: timeframe,
      max: limit,
    };

    if (from) params.from = from;
    if (to) params.to = to;

    // Get historical prices
    const response = await axiosInstance.get<PriceResponse>(`${CAPITAL_API.PRICES}/${formattedSymbol}`, {
      params,
    });

    if (!response.data?.prices || !Array.isArray(response.data.prices)) {
      throw new Error("Invalid response format from Capital.com API");
    }

    // Process and validate the bars
    const validBars = response.data.prices
      .map((bar) => {
        if (!bar.snapshotTimeUTC || !bar.openPrice || !bar.highPrice || !bar.lowPrice || !bar.closePrice) {
          return null;
        }

        return {
          timestamp: new Date(bar.snapshotTimeUTC).toISOString(),
          open: Number(bar.openPrice.ask),
          high: Number(bar.highPrice.ask),
          low: Number(bar.lowPrice.ask),
          close: Number(bar.closePrice.ask),
          volume: Number(bar.lastTradedVolume || 0),
        };
      })
      .filter((bar): bar is Bar => bar !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return validBars;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.isAxiosError) {
      if (axiosError.response?.status === 401) {
        console.log("[Capital] Session expired, refreshing...");
        sessionTokens = null;
        await ensureSession();
        return getHistoricalData(symbol, timeframe, limit, from, to);
      }

      throw new Error(`Capital.com API error: ${JSON.stringify(axiosError.response?.data || axiosError.message)}`);
    }
    throw error;
  }
}

export async function getSymbolInfo(symbol: string) {
  console.log("[Capital] Starting symbol info fetch...");

  if (!CAPITAL_API_KEY) {
    console.error("[Capital] API key not found in environment variables");
    throw new Error("CAPITAL_API_KEY environment variable is not set");
  }

  try {
    // Format symbol for Capital.com API (e.g., EUR/USD -> EUR_USD)
    const formattedSymbol = encodeURIComponent(symbol.replace("/", "_").toUpperCase());

    console.log("[Capital] Fetching instrument info:", {
      originalSymbol: symbol,
      formattedSymbol,
      url: `${CAPITAL_API.INSTRUMENTS}/${formattedSymbol}`,
    });

    const response = await axiosInstance.get(`${CAPITAL_API.INSTRUMENTS}/${formattedSymbol}`);

    console.log("[Capital] Instrument info received:", {
      status: response.status,
      statusText: response.statusText,
      hasData: !!response.data,
      epic: response.data?.epic,
    });

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.isAxiosError) {
      console.error("[Capital] API error fetching instrument info:", {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        message: axiosError.message,
        config: {
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          baseURL: axiosError.config?.baseURL,
          headers: {
            ...axiosError.config?.headers,
            [CAPITAL_API.HEADER_API_KEY_NAME]: "****" + CAPITAL_API_KEY?.slice(-4),
          },
        },
      });
      throw new Error(`Capital.com API error: ${JSON.stringify(axiosError.response?.data || axiosError.message)}`);
    }
    console.error("[Capital] Non-Axios error fetching instrument info:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export async function getMarketStatus(symbol: string) {
  if (!CAPITAL_API_KEY) {
    throw new Error("CAPITAL_API_KEY environment variable is not set");
  }

  try {
    const response = await axiosInstance.get(`/market-status/${symbol}`);
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.isAxiosError) {
      throw new Error(`Capital.com API error: ${axiosError.response?.data || axiosError.message}`);
    }
    throw error;
  }
}

export async function startLiveStream(symbol: string): Promise<void> {
  console.log("[Capital] Starting live stream setup...");

  try {
    await ensureSession();

    if (!sessionTokens) {
      console.error("[Capital] No valid session found");
      throw new Error("No valid session found. Please create a session first.");
    }

    // Check if stream already exists
    if (activeStreams.has(symbol)) {
      console.log(`[Capital] Stream already exists for ${symbol}`);
      return;
    }

    // Format symbol for Capital.com API (e.g., EUR/USD -> EUR_USD)
    const formattedSymbol = encodeURIComponent(symbol.replace("/", "_").toUpperCase());

    // Get instrument details first to get the epic
    console.log("[Capital] Getting instrument details:", {
      originalSymbol: symbol,
      formattedSymbol,
      url: `${CAPITAL_API.INSTRUMENTS}/${formattedSymbol}`,
    });

    const instrumentResponse = await axiosInstance.get(`${CAPITAL_API.INSTRUMENTS}/${formattedSymbol}`);

    console.log("[Capital] Instrument details received:", {
      status: instrumentResponse.status,
      hasData: !!instrumentResponse.data,
      epic: instrumentResponse.data?.epic,
    });

    const epic = instrumentResponse.data?.epic;
    if (!epic) {
      console.error("[Capital] Epic not found in instrument response:", instrumentResponse.data);
      throw new Error(`Could not find epic for symbol ${symbol}`);
    }

    console.log("[Capital] Connecting to WebSocket...");
    const ws = new WebSocket("wss://api-streaming-capital.backend-capital.com/connect");

    // Set up ping interval to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log(`[Capital] Sending ping for ${symbol}`, {
          timestamp: new Date().toISOString(),
          sessionTokens: {
            hasCst: !!sessionTokens?.CST,
            hasSecurityToken: !!sessionTokens?.X_SECURITY_TOKEN,
          },
        });

        ws.send(
          JSON.stringify({
            destination: "ping",
            correlationId: Date.now().toString(),
            cst: sessionTokens?.CST,
            securityToken: sessionTokens?.X_SECURITY_TOKEN,
          })
        );
      }
    }, 5 * 60 * 1000); // Ping every 5 minutes

    ws.on("open", () => {
      console.log(`[Capital] WebSocket connected for ${symbol}`, {
        timestamp: new Date().toISOString(),
        readyState: ws.readyState,
      });

      // Subscribe to OHLC market data with exact format from documentation
      const subscribeMessage = {
        destination: "OHLCMarketData.subscribe",
        correlationId: Date.now().toString(),
        cst: sessionTokens?.CST,
        securityToken: sessionTokens?.X_SECURITY_TOKEN,
        payload: {
          epics: [epic],
          resolutions: ["MINUTE"],
          type: "classic",
        },
      };

      console.log("[Capital] Sending subscription message:", {
        ...subscribeMessage,
        timestamp: new Date().toISOString(),
      });

      ws.send(JSON.stringify(subscribeMessage));
    });

    ws.on("message", async (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`[Capital] WebSocket message received for ${symbol}:`, {
          destination: message.destination,
          status: message.status,
          timestamp: new Date().toISOString(),
          hasPayload: !!message.payload,
        });

        if (message.destination === "ohlc.event" && message.status === "OK") {
          const bar = message.payload;
          if (bar && bar.epic === epic) {
            console.log(`[Capital] Processing price update for ${symbol}:`, {
              timestamp: new Date(bar.t).toISOString(),
              price: bar.c,
              epic: bar.epic,
            });

            // Store price update in database using Prisma
            await prisma.priceUpdate.create({
              data: {
                symbol: symbol,
                price: bar.c,
                timestamp: new Date(bar.t),
                bid: bar.c,
                ask: bar.c,
                volume: 0,
              },
            });

            console.log(`[Capital] Price update stored for ${symbol}`);
          }
        } else if (message.destination === "OHLCMarketData.subscribe") {
          console.log("[Capital] Subscription response:", message);
        }
      } catch (error) {
        console.error(`[Capital] Error processing WebSocket message for ${symbol}:`, {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
          data: typeof data === "string" ? data : "Binary data",
        });
      }
    });

    ws.on("error", (error) => {
      console.error(`[Capital] WebSocket error for ${symbol}:`, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    });

    ws.on("close", () => {
      console.log(`[Capital] WebSocket closed for ${symbol}`, {
        timestamp: new Date().toISOString(),
      });
      clearInterval(pingInterval);
      activeStreams.delete(symbol);
    });

    // Store the stream
    activeStreams.set(symbol, { epic, ws });
    console.log(`[Capital] Live stream setup completed for ${symbol}`);
  } catch (error) {
    console.error(`[Capital] Failed to start live stream for ${symbol}:`, {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}

export async function stopLiveStream(symbol: string): Promise<void> {
  const stream = activeStreams.get(symbol);
  if (stream) {
    // Unsubscribe from OHLC market data before closing with exact format from documentation
    if (stream.ws.readyState === WebSocket.OPEN) {
      const unsubscribeMessage = {
        destination: "OHLCMarketData.unsubscribe",
        correlationId: Date.now().toString(),
        cst: sessionTokens?.CST,
        securityToken: sessionTokens?.X_SECURITY_TOKEN,
        payload: {
          epics: [stream.epic],
          resolutions: ["MINUTE"],
          types: ["classic"],
        },
      };

      console.log("[Capital] Sending unsubscribe message:", unsubscribeMessage);
      stream.ws.send(JSON.stringify(unsubscribeMessage));
    }
    stream.ws.close();
    activeStreams.delete(symbol);
    console.log(`[Capital] Stopped live stream for ${symbol}`);
  }
}
