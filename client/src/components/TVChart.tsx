import { useEffect, useRef } from "react";
import { createChart, ColorType, Time, IChartApi, ISeriesApi, LineStyle } from "lightweight-charts";

interface OHLCData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TVChartProps {
  data: OHLCData[];
  colors?: {
    backgroundColor?: string;
    lineColor?: string;
    textColor?: string;
    areaTopColor?: string;
    areaBottomColor?: string;
  };
}

// Utility function to calculate EMA
function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) {
    return Array(prices.length).fill(prices[0]);
  }

  const k = 2 / (period + 1);
  const emaData: number[] = [];

  // Calculate initial SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  let ema = sum / period;
  emaData.push(ema);

  // Calculate subsequent EMAs
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
    emaData.push(ema);
  }

  // Pad the beginning with the first EMA value
  while (emaData.length < prices.length) {
    emaData.unshift(emaData[0]);
  }

  return emaData;
}

// Utility function to calculate RSI
function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsiData: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  // Calculate price changes and separate gains and losses
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // Calculate initial averages
  let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;

  // First RSI value
  let rs = avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);
  rsiData.push(rsi);

  // Calculate subsequent values
  for (let i = period; i < prices.length - 1; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    rs = avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);
    rsiData.push(rsi);
  }

  return rsiData;
}

// Technical Analysis Functions
function calculateBollingerBands(data: number[], period: number = 20, stdDev: number = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const sma = data.map((_, idx, arr) => {
    if (idx < period - 1) return null;
    const slice = arr.slice(idx - period + 1, idx + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });

  const upper = sma.map((middle, idx) => {
    if (middle === null) return null;
    const slice = data.slice(idx - period + 1, idx + 1);
    const std = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period);
    return middle + stdDev * std;
  });

  const lower = sma.map((middle, idx) => {
    if (middle === null) return null;
    const slice = data.slice(idx - period + 1, idx + 1);
    const std = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period);
    return middle - stdDev * std;
  });

  return {
    upper: upper.filter((x): x is number => x !== null),
    middle: sma.filter((x): x is number => x !== null),
    lower: lower.filter((x): x is number => x !== null),
  };
}

export default function TVChart({ data, colors = {} }: TVChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartRef2 = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !rsiChartRef.current) return;

    // Create main chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.backgroundColor || "white" },
        textColor: colors.textColor || "black",
      },
      width: chartContainerRef.current.clientWidth,
      height: 450,
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: {
        borderVisible: true,
        borderColor: "rgba(70, 130, 180, 0.2)",
        entireTextOnly: true,
        scaleMargins: {
          top: 0.05,
          bottom: 0.05,
        },
        visible: true,
        alignLabels: true,
        autoScale: true,
        ticksVisible: true,
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        borderVisible: true,
        borderColor: "rgba(70, 130, 180, 0.2)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 35,
        barSpacing: 8,
        minBarSpacing: 6,
        fixLeftEdge: true,
        lockVisibleTimeRangeOnResize: true,
      },
    });

    // Create RSI chart
    const rsiChart = createChart(rsiChartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.backgroundColor || "white" },
        textColor: colors.textColor || "black",
      },
      width: rsiChartRef.current.clientWidth,
      height: 150,
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: {
        borderVisible: true,
        borderColor: "rgba(70, 130, 180, 0.2)",
        entireTextOnly: true,
        scaleMargins: {
          top: 0.05,
          bottom: 0.05,
        },
        visible: true,
        alignLabels: true,
        autoScale: true,
        ticksVisible: true,
      },
      leftPriceScale: {
        visible: false,
      },
      timeScale: {
        borderVisible: true,
        borderColor: "rgba(70, 130, 180, 0.2)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 35,
        barSpacing: 8,
        minBarSpacing: 6,
        fixLeftEdge: true,
        lockVisibleTimeRangeOnResize: true,
      },
    });

    // Transform and validate data
    const transformedData = data
      .filter((bar) => {
        if (!bar || typeof bar !== "object") {
          console.error("Invalid bar data: not an object", bar);
          return false;
        }

        const hasRequiredFields = "timestamp" in bar && "open" in bar && "high" in bar && "low" in bar && "close" in bar;

        if (!hasRequiredFields) {
          console.error("Invalid bar data: missing required fields", {
            bar,
            hasTimestamp: "timestamp" in bar,
            hasOpen: "open" in bar,
            hasHigh: "high" in bar,
            hasLow: "low" in bar,
            hasClose: "close" in bar,
          });
          return false;
        }

        const allFieldsAreValid = !isNaN(Number(bar.open)) && !isNaN(Number(bar.high)) && !isNaN(Number(bar.low)) && !isNaN(Number(bar.close)) && Boolean(bar.timestamp);

        if (!allFieldsAreValid) {
          console.error("Invalid bar data: invalid field values", {
            bar,
            openValid: !isNaN(Number(bar.open)),
            highValid: !isNaN(Number(bar.high)),
            lowValid: !isNaN(Number(bar.low)),
            closeValid: !isNaN(Number(bar.close)),
            timestampValid: Boolean(bar.timestamp),
          });
          return false;
        }

        return true;
      })
      .map((bar) => {
        try {
          const timestamp = new Date(bar.timestamp).getTime() / 1000;
          if (isNaN(timestamp)) {
            console.error("Invalid timestamp format", bar.timestamp);
            return null;
          }

          return {
            time: timestamp as Time,
            open: Number(bar.open),
            high: Number(bar.high),
            low: Number(bar.low),
            close: Number(bar.close),
          };
        } catch (error) {
          console.error("Error transforming bar data", { bar, error });
          return null;
        }
      })
      .filter((bar): bar is NonNullable<typeof bar> => bar !== null)
      .sort((a, b) => (a.time as number) - (b.time as number));

    if (transformedData.length === 0) {
      console.error("No valid data points after transformation", { originalLength: data.length });
      return;
    }

    // Add candlestick series with proper price format
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    // Set candlestick data
    candlestickSeries.setData(transformedData);

    // Calculate and add EMAs and Bollinger Bands
    const closePrices = transformedData.map((bar) => bar.close);

    // EMA 20 (faster EMA)
    const ema20 = calculateEMA(closePrices, 20);
    const ema20Series = chart.addLineSeries({
      color: "#2196F3",
      lineWidth: 2,
      title: "EMA 20",
      lastValueVisible: true,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    // EMA 50 (medium EMA)
    const ema50 = calculateEMA(closePrices, 50);
    const ema50Series = chart.addLineSeries({
      color: "#FF9800",
      lineWidth: 2,
      title: "EMA 50",
      lastValueVisible: true,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    // EMA 200 (slower EMA)
    const ema200 = calculateEMA(closePrices, 200);
    const ema200Series = chart.addLineSeries({
      color: "#E91E63",
      lineWidth: 2,
      title: "EMA 200",
      lastValueVisible: true,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    // Set EMA data with proper validation
    const setEMAData = (series: ISeriesApi<"Line">, data: number[]) => {
      series.setData(
        transformedData.map((bar, i) => ({
          time: bar.time,
          value: Number.isFinite(data[i]) ? data[i] : bar.close,
        }))
      );
    };

    setEMAData(ema20Series, ema20);
    setEMAData(ema50Series, ema50);
    setEMAData(ema200Series, ema200);

    // Calculate Bollinger Bands
    const { upper, middle, lower } = calculateBollingerBands(closePrices, 20, 2);

    // Add Bollinger Bands with proper price format
    const upperBandSeries = chart.addLineSeries({
      color: "rgba(76, 175, 80, 0.5)",
      lineWidth: 1,
      title: "Upper Band",
      lineStyle: LineStyle.Dotted,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    const middleBandSeries = chart.addLineSeries({
      color: "rgba(156, 39, 176, 0.5)",
      lineWidth: 1,
      title: "Middle Band",
      lineStyle: LineStyle.Dotted,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    const lowerBandSeries = chart.addLineSeries({
      color: "rgba(76, 175, 80, 0.5)",
      lineWidth: 1,
      title: "Lower Band",
      lineStyle: LineStyle.Dotted,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    // Set Bollinger Bands data
    const offset = transformedData.length - upper.length;
    upperBandSeries.setData(
      transformedData.slice(offset).map((bar, i) => ({
        time: bar.time,
        value: upper[i],
      }))
    );

    middleBandSeries.setData(
      transformedData.slice(offset).map((bar, i) => ({
        time: bar.time,
        value: middle[i],
      }))
    );

    lowerBandSeries.setData(
      transformedData.slice(offset).map((bar, i) => ({
        time: bar.time,
        value: lower[i],
      }))
    );

    // Calculate and add RSI
    const rsiValues = calculateRSI(closePrices);
    const rsiSeries = rsiChart.addLineSeries({
      color: "#7B1FA2",
      lineWidth: 1,
      title: "RSI",
      priceFormat: {
        type: "custom",
        minMove: 0.01,
        formatter: (price: number) => price.toFixed(2),
      },
    });

    rsiSeries.setData(
      transformedData.slice(14).map((bar, i) => ({
        time: bar.time,
        value: rsiValues[i],
      }))
    );

    // Add RSI levels (30 and 70)
    const rsiLowerLevel = rsiChart.addLineSeries({
      color: "#00FF00",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
    });

    const rsiUpperLevel = rsiChart.addLineSeries({
      color: "#FF0000",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
    });

    rsiLowerLevel.setData(
      transformedData.map((bar) => ({
        time: bar.time,
        value: 30,
      }))
    );

    rsiUpperLevel.setData(
      transformedData.map((bar) => ({
        time: bar.time,
        value: 70,
      }))
    );

    // Sync the time scales
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const mainTimeRange = chart.timeScale().getVisibleRange();
      if (mainTimeRange) {
        rsiChart.timeScale().setVisibleRange(mainTimeRange);
      }
    });

    rsiChart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const rsiTimeRange = rsiChart.timeScale().getVisibleRange();
      if (rsiTimeRange) {
        chart.timeScale().setVisibleRange(rsiTimeRange);
      }
    });

    // Fit content
    chart.timeScale().fitContent();
    rsiChart.timeScale().fitContent();

    // Set initial zoom level with some padding
    const points = transformedData.length;
    const firstPoint = transformedData[0].time;
    const lastPoint = transformedData[points - 1].time;
    const padding = ((lastPoint as number) - (firstPoint as number)) * 0.1; // 10% padding on each side

    chart.timeScale().setVisibleRange({
      from: ((firstPoint as number) - padding) as Time,
      to: ((lastPoint as number) + padding) as Time,
    });

    rsiChart.timeScale().setVisibleRange({
      from: ((firstPoint as number) - padding) as Time,
      to: ((lastPoint as number) + padding) as Time,
    });

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && rsiChartRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
        rsiChart.applyOptions({
          width: rsiChartRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    // Store chart references
    chartRef.current = chart;
    rsiChartRef2.current = rsiChart;

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      rsiChart.remove();
    };
  }, [data, colors]);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1px" }}>
      <div ref={chartContainerRef} style={{ width: "100%", height: "450px" }} />
      <div ref={rsiChartRef} style={{ width: "100%", height: "150px" }} />
    </div>
  );
}
