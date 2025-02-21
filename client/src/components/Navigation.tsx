import { Link } from "wouter";
import { LineChart, BarChart2, Settings, Home, History } from "lucide-react";

export function Navigation() {
  return (
    <nav className="fixed top-0 left-0 h-full w-16 bg-background border-r flex flex-col items-center py-4 space-y-4">
      <Link href="/">
        <div className="p-3 hover:bg-accent rounded-lg transition-colors cursor-pointer" title="Dashboard">
          <Home className="w-6 h-6" />
        </div>
      </Link>

      <Link href="/backtest">
        <div className="p-3 hover:bg-accent rounded-lg transition-colors cursor-pointer" title="Backtest">
          <LineChart className="w-6 h-6" />
        </div>
      </Link>

      <Link href="/trades">
        <div className="p-3 hover:bg-accent rounded-lg transition-colors cursor-pointer" title="Trade History">
          <History className="w-6 h-6" />
        </div>
      </Link>

      <Link href="/analytics">
        <div className="p-3 hover:bg-accent rounded-lg transition-colors cursor-pointer" title="Analytics">
          <BarChart2 className="w-6 h-6" />
        </div>
      </Link>

      <div className="flex-grow" />

      <Link href="/settings">
        <div className="p-3 hover:bg-accent rounded-lg transition-colors cursor-pointer" title="Settings">
          <Settings className="w-6 h-6" />
        </div>
      </Link>
    </nav>
  );
}
