import { createCanvas, Canvas, CanvasRenderingContext2D } from "canvas";
import { calculateEMA, calculateBollingerBands, calculateRSI, findPivotPoints, identifyTrendlines } from "../utils/indicators";

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
  pivots: { price: number; type: "high" | "low" }[];
}

class ChartAnalysisService {
  private static readonly CHART_DIMENSIONS: ChartDimensions = {
    width: 1200,
    height: 800,
    padding: 60,
  };

  private static readonly COLORS = {
    background: "#ffffff",
    grid: "#f0f0f0",
    text: "#333333",
    bullish: "#26a69a",
    bearish: "#ef5350",
    ema20: "#2196F3",
    ema50: "#FF9800",
    ema200: "#E91E63",
    bbUpper: "#9C27B0",
    bbLower: "#9C27B0",
    bbMiddle: "#9C27B0",
    volume: "rgba(38, 166, 154, 0.6)",
    volumeBearish: "rgba(239, 83, 80, 0.6)",
    support: "#2196F3",
    resistance: "#FF9800",
  };

  public async generateAnalysisChart(data: OHLCData[], symbol: string): Promise<Buffer> {
    console.log(`[Chart] Generating analysis chart for ${symbol} with ${data.length} bars`);

    const canvas = createCanvas(ChartAnalysisService.CHART_DIMENSIONS.width, ChartAnalysisService.CHART_DIMENSIONS.height);
    const ctx = canvas.getContext("2d");

    // Set background
    ctx.fillStyle = ChartAnalysisService.COLORS.background;
    ctx.fillRect(0, 0, ChartAnalysisService.CHART_DIMENSIONS.width, ChartAnalysisService.CHART_DIMENSIONS.height);

    // Calculate technical indicators
    const closePrices = data.map((bar) => bar.close);
    const ema20 = calculateEMA(closePrices, 20);
    const ema50 = calculateEMA(closePrices, 50);
    const ema200 = calculateEMA(closePrices, 200);
    const bb = calculateBollingerBands(closePrices);
    const rsi = calculateRSI(closePrices);

    // Find key levels
    const levels = this.findKeyLevels(data);

    // Calculate chart layout
    const mainChartHeight = ChartAnalysisService.CHART_DIMENSIONS.height * 0.7;
    const volumeHeight = ChartAnalysisService.CHART_DIMENSIONS.height * 0.15;
    const rsiHeight = ChartAnalysisService.CHART_DIMENSIONS.height * 0.15;
    const volumeStartY = mainChartHeight + 10;
    const rsiStartY = volumeStartY + volumeHeight + 10;

    // Draw components
    this.drawPriceChart(ctx, data, mainChartHeight, levels);
    this.drawVolumeChart(ctx, data, volumeHeight, volumeStartY);
    this.drawRSIChart(ctx, rsi, rsiHeight, rsiStartY);
    this.drawTechnicalIndicators(
      ctx,
      data,
      {
        ema20,
        ema50,
        ema200,
        bb,
      },
      mainChartHeight
    );

    // Add metadata and annotations
    this.drawChartMetadata(ctx, {
      symbol,
      period: "4H",
      indicators: ["EMA(20,50,200)", "BB(20,2)", "RSI(14)"],
      levels,
    });

    // Add pattern annotations
    const patterns = this.identifyPatterns(data);
    this.annotatePatterns(ctx, patterns, data);

    console.log(`[Chart] Chart generation completed for ${symbol}`);
    return canvas.toBuffer("image/png");
  }

  private drawPriceChart(ctx: CanvasRenderingContext2D, data: OHLCData[], height: number, levels: TechnicalLevels): void {
    const { width, padding } = ChartAnalysisService.CHART_DIMENSIONS;
    const chartWidth = width - 2 * padding;
    const barWidth = chartWidth / data.length;

    // Calculate price range with padding
    const minPrice = Math.min(...data.map((bar) => bar.low)) * 0.995;
    const maxPrice = Math.max(...data.map((bar) => bar.high)) * 1.005;
    const priceRange = maxPrice - minPrice;
    const priceToY = (price: number) => height - padding - ((price - minPrice) / priceRange) * (height - 2 * padding);

    // Draw price grid
    this.drawGrid(ctx, height, minPrice, maxPrice);

    // Draw candlesticks
    data.forEach((bar, i) => {
      const x = padding + i * barWidth;
      const centerX = x + barWidth / 2;

      // Draw wick
      ctx.strokeStyle = bar.close >= bar.open ? ChartAnalysisService.COLORS.bullish : ChartAnalysisService.COLORS.bearish;
      ctx.beginPath();
      ctx.moveTo(centerX, priceToY(bar.high));
      ctx.lineTo(centerX, priceToY(bar.low));
      ctx.stroke();

      // Draw body
      const bodyTop = priceToY(Math.max(bar.open, bar.close));
      const bodyBottom = priceToY(Math.min(bar.open, bar.close));
      ctx.fillStyle = bar.close >= bar.open ? ChartAnalysisService.COLORS.bullish : ChartAnalysisService.COLORS.bearish;
      ctx.fillRect(x + 2, bodyTop, barWidth - 4, bodyBottom - bodyTop);
    });

    // Draw support and resistance levels
    this.drawKeyLevels(ctx, levels, height, minPrice, maxPrice);
  }

  private drawGrid(ctx: CanvasRenderingContext2D, height: number, minPrice: number, maxPrice: number): void {
    const { width, padding } = ChartAnalysisService.CHART_DIMENSIONS;
    ctx.strokeStyle = ChartAnalysisService.COLORS.grid;
    ctx.setLineDash([5, 5]);

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (height - 2 * padding) * (i / 5);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();

      // Price labels
      const price = maxPrice - (maxPrice - minPrice) * (i / 5);
      ctx.fillStyle = ChartAnalysisService.COLORS.text;
      ctx.font = "12px Arial";
      ctx.fillText(price.toFixed(2), 5, y + 4);
    }

    ctx.setLineDash([]);
  }

  private drawKeyLevels(ctx: CanvasRenderingContext2D, levels: TechnicalLevels, height: number, minPrice: number, maxPrice: number): void {
    const { width, padding } = ChartAnalysisService.CHART_DIMENSIONS;
    const priceToY = (price: number) => height - padding - ((price - minPrice) / (maxPrice - minPrice)) * (height - 2 * padding);

    // Draw support levels
    ctx.strokeStyle = ChartAnalysisService.COLORS.support;
    ctx.setLineDash([5, 5]);
    levels.support.forEach((level) => {
      const y = priceToY(level);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      ctx.fillStyle = ChartAnalysisService.COLORS.support;
      ctx.fillText(`Support: ${level.toFixed(2)}`, width - padding + 5, y);
    });

    // Draw resistance levels
    ctx.strokeStyle = ChartAnalysisService.COLORS.resistance;
    levels.resistance.forEach((level) => {
      const y = priceToY(level);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      ctx.fillStyle = ChartAnalysisService.COLORS.resistance;
      ctx.fillText(`Resistance: ${level.toFixed(2)}`, width - padding + 5, y);
    });

    ctx.setLineDash([]);
  }

  private drawVolumeChart(ctx: CanvasRenderingContext2D, data: OHLCData[], height: number, startY: number): void {
    const { width, padding } = ChartAnalysisService.CHART_DIMENSIONS;
    const chartWidth = width - 2 * padding;
    const barWidth = chartWidth / data.length;

    const maxVolume = Math.max(...data.map((bar) => bar.volume));
    const volumeToHeight = (volume: number) => (volume / maxVolume) * height;

    // Draw volume bars
    data.forEach((bar, i) => {
      const x = padding + i * barWidth;
      const barHeight = volumeToHeight(bar.volume);
      ctx.fillStyle = bar.close >= bar.open ? ChartAnalysisService.COLORS.volume : ChartAnalysisService.COLORS.volumeBearish;
      ctx.fillRect(x + 1, startY + height - barHeight, barWidth - 2, barHeight);
    });

    // Draw volume scale
    ctx.fillStyle = ChartAnalysisService.COLORS.text;
    ctx.font = "12px Arial";
    ctx.fillText(`Vol: ${maxVolume.toLocaleString()}`, padding, startY + 15);
  }

  private drawRSIChart(ctx: CanvasRenderingContext2D, rsiData: number[], height: number, startY: number): void {
    const { width, padding } = ChartAnalysisService.CHART_DIMENSIONS;
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
    this.drawRSILevels(ctx, height, startY);
  }

  private drawRSILevels(ctx: CanvasRenderingContext2D, height: number, startY: number): void {
    const { width, padding } = ChartAnalysisService.CHART_DIMENSIONS;

    // Draw overbought level (70)
    ctx.strokeStyle = "#FF0000";
    ctx.setLineDash([5, 5]);
    const overboughtY = startY + height - (70 / 100) * height;
    ctx.beginPath();
    ctx.moveTo(padding, overboughtY);
    ctx.lineTo(width - padding, overboughtY);
    ctx.stroke();
    ctx.fillText("70", padding - 20, overboughtY);

    // Draw oversold level (30)
    ctx.strokeStyle = "#00FF00";
    const oversoldY = startY + height - (30 / 100) * height;
    ctx.beginPath();
    ctx.moveTo(padding, oversoldY);
    ctx.lineTo(width - padding, oversoldY);
    ctx.stroke();
    ctx.fillText("30", padding - 20, oversoldY);

    ctx.setLineDash([]);
  }

  private drawTechnicalIndicators(
    ctx: CanvasRenderingContext2D,
    data: OHLCData[],
    indicators: {
      ema20: number[];
      ema50: number[];
      ema200: number[];
      bb: { upper: number[]; middle: number[]; lower: number[] };
    },
    height: number
  ): void {
    const { width, padding } = ChartAnalysisService.CHART_DIMENSIONS;
    const chartWidth = width - 2 * padding;
    const step = chartWidth / (data.length - 1);

    // Draw EMAs
    this.drawIndicatorLine(
      ctx,
      indicators.ema20,
      step,
      height,
      ChartAnalysisService.COLORS.ema20,
      Math.min(...data.map((bar) => bar.low)),
      Math.max(...data.map((bar) => bar.high))
    );
    this.drawIndicatorLine(
      ctx,
      indicators.ema50,
      step,
      height,
      ChartAnalysisService.COLORS.ema50,
      Math.min(...data.map((bar) => bar.low)),
      Math.max(...data.map((bar) => bar.high))
    );
    this.drawIndicatorLine(
      ctx,
      indicators.ema200,
      step,
      height,
      ChartAnalysisService.COLORS.ema200,
      Math.min(...data.map((bar) => bar.low)),
      Math.max(...data.map((bar) => bar.high))
    );

    // Draw Bollinger Bands
    ctx.setLineDash([5, 5]);
    this.drawIndicatorLine(
      ctx,
      indicators.bb.upper,
      step,
      height,
      ChartAnalysisService.COLORS.bbUpper,
      Math.min(...data.map((bar) => bar.low)),
      Math.max(...data.map((bar) => bar.high))
    );
    this.drawIndicatorLine(
      ctx,
      indicators.bb.lower,
      step,
      height,
      ChartAnalysisService.COLORS.bbLower,
      Math.min(...data.map((bar) => bar.low)),
      Math.max(...data.map((bar) => bar.high))
    );
    ctx.setLineDash([]);
    this.drawIndicatorLine(
      ctx,
      indicators.bb.middle,
      step,
      height,
      ChartAnalysisService.COLORS.bbMiddle,
      Math.min(...data.map((bar) => bar.low)),
      Math.max(...data.map((bar) => bar.high))
    );
  }

  private drawIndicatorLine(ctx: CanvasRenderingContext2D, data: number[], step: number, height: number, color: string, minPrice: number, maxPrice: number): void {
    const { padding } = ChartAnalysisService.CHART_DIMENSIONS;
    const priceToY = (price: number) => height - padding - ((price - minPrice) / (maxPrice - minPrice)) * (height - 2 * padding);

    ctx.strokeStyle = color;
    ctx.beginPath();
    data.forEach((value, i) => {
      const x = padding + i * step;
      const y = priceToY(value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  private findKeyLevels(data: OHLCData[]): TechnicalLevels {
    const { pivotHigh, pivotLow } = findPivotPoints(data);
    const { resistance, support } = identifyTrendlines(data);

    return {
      support: Array.from(new Set(support.map((level) => level.end))),
      resistance: Array.from(new Set(resistance.map((level) => level.end))),
      pivots: [...pivotHigh.map((price) => ({ price, type: "high" as const })), ...pivotLow.map((price) => ({ price, type: "low" as const }))],
    };
  }

  private identifyPatterns(data: OHLCData[]): any[] {
    // Implement pattern recognition logic
    return [];
  }

  private annotatePatterns(ctx: CanvasRenderingContext2D, patterns: any[], data: OHLCData[]): void {
    // Implement pattern annotation logic
  }

  private priceToY(price: number, height: number, data: OHLCData[]): number {
    const { padding } = ChartAnalysisService.CHART_DIMENSIONS;
    const minPrice = Math.min(...data.map((bar: OHLCData) => bar.low)) * 0.995;
    const maxPrice = Math.max(...data.map((bar: OHLCData) => bar.high)) * 1.005;
    const priceRange = maxPrice - minPrice;
    return height - padding - ((price - minPrice) / priceRange) * (height - 2 * padding);
  }

  private drawChartMetadata(
    ctx: CanvasRenderingContext2D,
    metadata: {
      symbol: string;
      period: string;
      indicators: string[];
      levels: TechnicalLevels;
    }
  ): void {
    const { padding } = ChartAnalysisService.CHART_DIMENSIONS;
    ctx.fillStyle = ChartAnalysisService.COLORS.text;

    // Draw title
    ctx.font = "bold 20px Arial";
    ctx.fillText(`${metadata.symbol} - ${metadata.period} Timeframe`, padding, 30);

    // Draw indicators
    ctx.font = "14px Arial";
    ctx.fillText(`Technical Indicators: ${metadata.indicators.join(", ")}`, padding, 50);

    // Draw key levels summary
    const supportLevels = metadata.levels.support.map((level) => level.toFixed(2)).join(", ");
    const resistanceLevels = metadata.levels.resistance.map((level) => level.toFixed(2)).join(", ");
    ctx.fillText(`Support Levels: ${supportLevels}`, padding, 70);
    ctx.fillText(`Resistance Levels: ${resistanceLevels}`, padding, 90);
  }
}

export const chartAnalysis = new ChartAnalysisService();
export const generateAnalysisChart = chartAnalysis.generateAnalysisChart.bind(chartAnalysis);
