import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Analytics() {
  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Trading analytics and performance metrics will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  );
}
