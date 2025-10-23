import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

interface CallStatsChartProps {
  totalCalls: number;
  answeredCalls: number;
  notAnsweredCalls: number;
  isLoading?: boolean;
}

export function CallStatsChart({
  totalCalls,
  answeredCalls,
  notAnsweredCalls,
  isLoading = false
}: CallStatsChartProps) {
  // Calculate percentages for bar widths
  const maxValue = Math.max(totalCalls, answeredCalls, notAnsweredCalls) || 1;
  const totalWidth = (totalCalls / maxValue) * 100;
  const answeredWidth = (answeredCalls / maxValue) * 100;
  const notAnsweredWidth = (notAnsweredCalls / maxValue) * 100;

  const stats = [
    {
      label: 'Total Calls',
      value: totalCalls,
      width: totalWidth,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-100 dark:bg-blue-950'
    },
    {
      label: 'Answered Calls',
      value: answeredCalls,
      width: answeredWidth,
      color: 'bg-green-500',
      bgColor: 'bg-green-100 dark:bg-green-950'
    },
    {
      label: 'Not Answered',
      value: notAnsweredCalls,
      width: notAnsweredWidth,
      color: 'bg-red-500',
      bgColor: 'bg-red-100 dark:bg-red-950'
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Call Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading call statistics...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Call Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {stats.map((stat, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{stat.label}</span>
              <span className="text-muted-foreground">{stat.value}</span>
            </div>
            <div className={`w-full h-8 rounded-lg ${stat.bgColor} overflow-hidden`}>
              <div
                className={`h-full ${stat.color} transition-all duration-500 ease-out flex items-center justify-end pr-3`}
                style={{ width: `${stat.width}%` }}
              >
                {stat.value > 0 && (
                  <span className="text-white text-sm font-semibold">
                    {stat.value}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
