import { createCanvas, Canvas, CanvasRenderingContext2D } from "canvas";
import { calculateEMA, calculateBollingerBands, calculateRSI } from "../utils/indicators";

interface OHLCData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartDimensions {
  width: number;
  height: number;
  padding: number;
}

interface TechnicalLevels {
  support: number[];
  resistance: number[];
  pivots: number[];
}

export async function generateAnalysisChart(data: OHLCData[], symbol: string): Promise<Buffer> {
  // Create a larger canvas for analysis
  const dimensions: ChartDimensions = {
    width: 1200,
    height: 800,
    padding: 60,
  };

  const canvas = createCanvas(dimensions.width, dimensions.height);
  const ctx = canvas.getContext("2d");

  // Set white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, dimensions.width, dimensions.height);

  // Calculate all technical indicators
  const closePrices = data.map((bar) => bar.close);
  const ema20 = calculateEMA(closePrices, 20);
  const ema50 = calculateEMA(closePrices, 50);
  const ema200 = calculateEMA(closePrices, 200);
  const bb = calculateBollingerBands(closePrices);
  const rsi = calculateRSI(closePrices);

  // Find key price levels
  const levels = findKeyLevels(data);

  // Draw main price chart (70% of height)
  const mainChartHeight = dimensions.height * 0.7;
  drawPriceChart(ctx, data, dimensions, mainChartHeight, levels);

  // Draw volume chart (15% of height)
  const volumeChartHeight = dimensions.height * 0.15;
  const volumeStartY = mainChartHeight + 10;
  drawVolumeChart(ctx, data, dimensions, volumeChartHeight, volumeStartY);

  // Draw RSI chart (15% of height)
  const rsiChartHeight = dimensions.height * 0.15;
  const rsiStartY = volumeStartY + volumeChartHeight + 10;
  drawRSIChart(ctx, rsi, dimensions, rsiChartHeight, rsiStartY);

  // Draw technical indicators
  drawTechnicalIndicators(
    ctx,
    data,
    {
      ema20,
      ema50,
      ema200,
      bb,
    },
    dimensions,
    mainChartHeight
  );

  // Add chart title and metadata
  drawChartMetadata(
    ctx,
    {
      symbol,
      period: "4H",
      indicators: ["EMA(20,50,200)", "BB(20,2)", "RSI(14)"],
    },
    dimensions
  );

  // Add annotations for significant patterns
  const patterns = identifyPatterns(data);
  annotatePatterns(ctx, patterns, dimensions);

  return canvas.toBuffer("image/png");
}

function drawPriceChart(ctx: CanvasRenderingContext2D, data: OHLCData[], dimensions: ChartDimensions, height: number, levels: TechnicalLevels) {
  const { width, padding } = dimensions;
  const chartWidth = width - 2 * padding;
  const barWidth = chartWidth / data.length;

  // Calculate price range
  const minPrice = Math.min(...data.map((bar) => bar.low));
  const maxPrice = Math.max(...data.map((bar) => bar.high));
  const priceRange = maxPrice - minPrice;
  const priceToY = (price: number) => height - padding - ((price - minPrice) / priceRange) * (height - 2 * padding);

  // Draw candlesticks
  data.forEach((bar, i) => {
    const x = padding + i * barWidth;
    const centerX = x + barWidth / 2;

    // Draw wick
    ctx.strokeStyle = bar.close >= bar.open ? "#26a69a" : "#ef5350";
    ctx.beginPath();
    ctx.moveTo(centerX, priceToY(bar.high));
    ctx.lineTo(centerX, priceToY(bar.low));
    ctx.stroke();

    // Draw body
    const bodyTop = priceToY(Math.max(bar.open, bar.close));
    const bodyBottom = priceToY(Math.min(bar.open, bar.close));
    ctx.fillStyle = bar.close >= bar.open ? "#26a69a" : "#ef5350";
    ctx.fillRect(x + 2, bodyTop, barWidth - 4, bodyBottom - bodyTop);
  });

  // Draw support and resistance levels
  ctx.strokeStyle = "#2196F3";
  ctx.setLineDash([5, 5]);
  levels.support.forEach((level) => {
    const y = priceToY(level);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    ctx.fillStyle = "#2196F3";
    ctx.fillText(`Support: ${level.toFixed(2)}`, width - padding + 5, y);
  });

  ctx.strokeStyle = "#FF9800";
  levels.resistance.forEach((level) => {
    const y = priceToY(level);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    ctx.fillStyle = "#FF9800";
    ctx.fillText(`Resistance: ${level.toFixed(2)}`, width - padding + 5, y);
  });
  ctx.setLineDash([]);
}

function drawVolumeChart(ctx: CanvasRenderingContext2D, data: OHLCData[], dimensions: ChartDimensions, height: number, startY: number) {
  const { width, padding } = dimensions;
  const chartWidth = width - 2 * padding;
  const barWidth = chartWidth / data.length;

  const maxVolume = Math.max(...data.map((bar) => bar.volume));
  const volumeToHeight = (volume: number) => (volume / maxVolume) * height;

  data.forEach((bar, i) => {
    const x = padding + i * barWidth;
    const barHeight = volumeToHeight(bar.volume);
    ctx.fillStyle = bar.close >= bar.open ? "rgba(38, 166, 154, 0.6)" : "rgba(239, 83, 80, 0.6)";
    ctx.fillRect(x + 1, startY + height - barHeight, barWidth - 2, barHeight);
  });
}

function drawRSIChart(ctx: CanvasRenderingContext2D, rsiData: number[], dimensions: ChartDimensions, height: number, startY: number) {
  const { width, padding } = dimensions;
  const chartWidth = width - 2 * padding;
  const step = chartWidth / (rsiData.length - 1);

  // Draw RSI line
  ctx.strokeStyle = "#7B1FA2";
  ctx.beginPath();
  rsiData.forEach((value, i) => {
    const x = padding + i * step;
    const y = startY + height - (value / 100) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw overbought/oversold levels
  ctx.strokeStyle = "#FF0000";
  ctx.setLineDash([5, 5]);
  const overboughtY = startY + height - (70 / 100) * height;
  ctx.beginPath();
  ctx.moveTo(padding, overboughtY);
  ctx.lineTo(width - padding, overboughtY);
  ctx.stroke();

  ctx.strokeStyle = "#00FF00";
  const oversoldY = startY + height - (30 / 100) * height;
  ctx.beginPath();
  ctx.moveTo(padding, oversoldY);
  ctx.lineTo(width - padding, oversoldY);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawChartMetadata(
  ctx: CanvasRenderingContext2D,
  metadata: {
    symbol: string;
    period: string;
    indicators: string[];
  },
  dimensions: ChartDimensions
) {
  const { width, padding } = dimensions;
  ctx.fillStyle = "#333333";
  ctx.font = "bold 20px Arial";
  ctx.fillText(`${metadata.symbol} - ${metadata.period} Timeframe`, padding, 30);

  ctx.font = "14px Arial";
  ctx.fillText(`Technical Indicators: ${metadata.indicators.join(", ")}`, padding, 50);
}

function findKeyLevels(data: OHLCData[]): TechnicalLevels {
  // Simple implementation - can be enhanced with more sophisticated algorithms
  const highs = data.map((bar) => bar.high);
  const lows = data.map((bar) => bar.low);

  return {
    support: [Math.min(...lows)],
    resistance: [Math.max(...highs)],
    pivots: [],
  };
}

function identifyPatterns(data: OHLCData[]): any[] {
  // Implement pattern recognition logic
  return [];
}

function annotatePatterns(ctx: CanvasRenderingContext2D, patterns: any[], dimensions: ChartDimensions) {
  // Implement pattern annotation logic
}

function drawTechnicalIndicators(
  ctx: CanvasRenderingContext2D,
  data: OHLCData[],
  indicators: {
    ema20: number[];
    ema50: number[];
    ema200: number[];
    bb: { upper: number[]; middle: number[]; lower: number[] };
  },
  dimensions: ChartDimensions,
  height: number
) {
  const { width, padding } = dimensions;
  const chartWidth = width - 2 * padding;
  const step = chartWidth / (data.length - 1);

  // Calculate price range for scaling
  const minPrice = Math.min(...data.map((bar) => bar.low));
  const maxPrice = Math.max(...data.map((bar) => bar.high));
  const priceRange = maxPrice - minPrice;
  const priceToY = (price: number) => height - padding - ((price - minPrice) / priceRange) * (height - 2 * padding);

  // Draw EMAs
  const drawLine = (data: number[], color: string) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    data.forEach((value, i) => {
      const x = padding + i * step;
      const y = priceToY(value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  drawLine(indicators.ema20, "#2196F3"); // EMA 20
  drawLine(indicators.ema50, "#FF9800"); // EMA 50
  drawLine(indicators.ema200, "#E91E63"); // EMA 200

  // Draw Bollinger Bands
  ctx.strokeStyle = "#9C27B0";
  ctx.setLineDash([5, 5]);
  drawLine(indicators.bb.upper, "#9C27B0");
  drawLine(indicators.bb.lower, "#9C27B0");
  ctx.setLineDash([]);
  drawLine(indicators.bb.middle, "#9C27B0");
}
