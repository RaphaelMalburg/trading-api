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

// Technical Analysis Functions
function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const emaData: number[] = [];
  let ema = data[0];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      emaData.push(ema);
    } else {
      ema = data[i] * k + ema * (1 - k);
      emaData.push(ema);
    }
  }

  return emaData;
}

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

function calculateRSI(data: number[], period: number = 14): number[] {
  const changes = data.map((price, index) => {
    if (index === 0) return 0;
    return price - data[index - 1];
  });

  const gains = changes.map((change) => (change > 0 ? change : 0));
  const losses = changes.map((change) => (change < 0 ? -change : 0));

  const rsiData: number[] = [];
  let avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < data.length; i++) {
    if (i > period) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    rsiData.push(rsi);
  }

  return rsiData;
}

export function TVChart({ data, colors = {} }: TVChartProps) {
  const mainChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const rsiChartApiRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!mainChartRef.current || !rsiChartRef.current) return;

    // Main chart
    const chart = createChart(mainChartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.backgroundColor || "white" },
        textColor: colors.textColor || "black",
      },
      width: mainChartRef.current.clientWidth,
      height: 400,
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
      },
    });

    // RSI chart
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
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
      },
    });

    // Main chart setup
    const mainSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    const priceData = data.map((bar) => ({
      time: Math.floor(new Date(bar.timestamp).getTime() / 1000) as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    mainSeries.setData(priceData);

    // Calculate and add EMAs
    const closePrices = data.map((bar) => bar.close);
    const ema20 = calculateEMA(closePrices, 20);
    const ema50 = calculateEMA(closePrices, 50);
    const ema200 = calculateEMA(closePrices, 200);

    const ema20Series = chart.addLineSeries({
      color: "#2196F3",
      lineWidth: 1,
      title: "EMA 20",
      lastValueVisible: true,
      priceLineVisible: false,
    });
    const ema50Series = chart.addLineSeries({
      color: "#FF9800",
      lineWidth: 1,
      title: "EMA 50",
      lastValueVisible: true,
      priceLineVisible: false,
    });
    const ema200Series = chart.addLineSeries({
      color: "#E91E63",
      lineWidth: 1,
      title: "EMA 200",
      lastValueVisible: true,
      priceLineVisible: false,
    });

    ema20Series.setData(
      data.map((bar, i) => ({
        time: Math.floor(new Date(bar.timestamp).getTime() / 1000) as Time,
        value: ema20[i],
      }))
    );

    ema50Series.setData(
      data.map((bar, i) => ({
        time: Math.floor(new Date(bar.timestamp).getTime() / 1000) as Time,
        value: ema50[i],
      }))
    );

    ema200Series.setData(
      data.map((bar, i) => ({
        time: Math.floor(new Date(bar.timestamp).getTime() / 1000) as Time,
        value: ema200[i],
      }))
    );

    // Calculate and add Bollinger Bands
    const bb = calculateBollingerBands(closePrices);
    const bbUpperSeries = chart.addLineSeries({
      color: "#9C27B0",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      title: "BB Upper",
      lastValueVisible: true,
      priceLineVisible: false,
    });
    const bbMiddleSeries = chart.addLineSeries({
      color: "#9C27B0",
      lineWidth: 1,
      title: "BB Middle",
      lastValueVisible: true,
      priceLineVisible: false,
    });
    const bbLowerSeries = chart.addLineSeries({
      color: "#9C27B0",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      title: "BB Lower",
      lastValueVisible: true,
      priceLineVisible: false,
    });

    bbUpperSeries.setData(
      data.slice(-bb.upper.length).map((bar, i) => ({
        time: Math.floor(new Date(bar.timestamp).getTime() / 1000) as Time,
        value: bb.upper[i],
      }))
    );

    bbMiddleSeries.setData(
      data.slice(-bb.middle.length).map((bar, i) => ({
        time: Math.floor(new Date(bar.timestamp).getTime() / 1000) as Time,
        value: bb.middle[i],
      }))
    );

    bbLowerSeries.setData(
      data.slice(-bb.lower.length).map((bar, i) => ({
        time: Math.floor(new Date(bar.timestamp).getTime() / 1000) as Time,
        value: bb.lower[i],
      }))
    );

    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
      color: "#26a69a",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "volume",
    });

    // Configure the volume scale
    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      visible: false,
    });

    const volumeData = data.map((bar) => ({
      time: Math.floor(new Date(bar.timestamp).getTime() / 1000) as Time,
      value: bar.volume,
      color: bar.close >= bar.open ? "#26a69a80" : "#ef535080",
    }));

    volumeSeries.setData(volumeData);

    // RSI setup
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
      lastValueVisible: true,
      priceLineVisible: false,
    });

    rsiSeries.setData(
      data.slice(-rsiValues.length).map((bar, i) => ({
        time: Math.floor(new Date(bar.timestamp).getTime() / 1000) as Time,
        value: rsiValues[i],
      }))
    );

    // Add RSI levels
    const rsiUpperLevel = rsiChart.addLineSeries({
      color: "#FF0000",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    const rsiLowerLevel = rsiChart.addLineSeries({
      color: "#00FF00",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    rsiUpperLevel.setData(
      data.map((bar) => ({
        time: Math.floor(new Date(bar.timestamp).getTime() / 1000) as Time,
        value: 70,
      }))
    );

    rsiLowerLevel.setData(
      data.map((bar) => ({
        time: Math.floor(new Date(bar.timestamp).getTime() / 1000) as Time,
        value: 30,
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

    // Fit the chart content
    chart.timeScale().fitContent();
    rsiChart.timeScale().fitContent();

    chartRef.current = chart;
    rsiChartApiRef.current = rsiChart;

    // Handle window resize
    const handleResize = () => {
      if (mainChartRef.current && rsiChartRef.current && chart && rsiChart) {
        chart.applyOptions({ width: mainChartRef.current.clientWidth });
        rsiChart.applyOptions({ width: rsiChartRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
      if (rsiChartApiRef.current) {
        rsiChartApiRef.current.remove();
      }
    };
  }, [data, colors]);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
      <div ref={mainChartRef} style={{ width: "100%", height: "400px" }} />
      <div ref={rsiChartRef} style={{ width: "100%", height: "150px" }} />
    </div>
  );
}
