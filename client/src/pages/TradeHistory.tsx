import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TradeHistory() {
  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Trade history will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
