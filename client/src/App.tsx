import { Route, Switch } from "wouter";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/dashboard";
import { Backtest } from "./components/Backtest";
import { TradeHistory } from "./pages/TradeHistory";
import { Analytics } from "./pages/Analytics";
import { Settings } from "./pages/Settings";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/backtest" component={Backtest} />
          <Route path="/trades" component={TradeHistory} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/settings" component={Settings} />
        </Switch>
      </Layout>
      <Toaster />
    </QueryClientProvider>
  );
}
