import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { BacktestList } from "@/components/BacktestList";

export default function BacktestsPage() {
  const {
    data: backtests,
    isLoading: isLoadingBacktests,
    error: backtestsError,
  } = useQuery({
    queryKey: ["backtests"],
    queryFn: async () => {
      const response = await fetch("/api/backtests");
      if (!response.ok) {
        throw new Error("Failed to fetch backtests");
      }
      const data = await response.json();
      console.log("[Backtests] Fetched backtests:", data.length);
      return data;
    },
  });

  const {
    data: analyses,
    isLoading: isLoadingAnalyses,
    error: analysesError,
  } = useQuery({
    queryKey: ["analyses"],
    queryFn: async () => {
      const response = await fetch("/api/analysis/history");
      if (!response.ok) {
        throw new Error("Failed to fetch analyses");
      }
      const data = await response.json();
      console.log("[Backtests] Fetched analyses:", data.length);
      return data;
    },
  });

  const isLoading = isLoadingBacktests || isLoadingAnalyses;
  const error = backtestsError || analysesError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-500">Error loading data: {error instanceof Error ? error.message : "Unknown error"}</div>;
  }

  // Combine backtests with their analyses
  const backtestsWithAnalyses = backtests?.map((backtest: any) => ({
    ...backtest,
    analyses: analyses?.filter((analysis: any) => analysis.backtestId === backtest.id) || [],
  }));

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Backtest Results</h1>
      <BacktestList backtests={backtestsWithAnalyses || []} />
    </div>
  );
}
