import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

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
  const stats = [
    { label: 'Total Calls', value: totalCalls, color: '#3b82f6' },
    { label: 'Answered Calls', value: answeredCalls, color: '#22c55e' },
    { label: 'Not Answered', value: notAnsweredCalls, color: '#ef4444' },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
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

  // Chart dimensions
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 40, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate max value for Y axis
  const maxValue = Math.max(totalCalls, answeredCalls, notAnsweredCalls, 10);
  const yScale = chartHeight / maxValue;

  // X positions for the three points
  const xPositions = [
    padding.left,
    padding.left + chartWidth / 2,
    padding.left + chartWidth
  ];

  // Y positions based on values
  const yPositions = stats.map(stat =>
    padding.top + chartHeight - (stat.value * yScale)
  );

  // Create path data for each line
  const createLinePath = (points: number[]) => {
    return points.map((y, i) => {
      const x = xPositions[i];
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');
  };

  // Grid lines
  const gridLines = 5;
  const gridYPositions = Array.from({ length: gridLines }, (_, i) =>
    padding.top + (chartHeight / (gridLines - 1)) * i
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Call Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto"
            style={{ minHeight: '300px' }}
          >
            {/* Grid lines */}
            {gridYPositions.map((y, i) => (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartWidth}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="currentColor"
                  opacity="0.5"
                >
                  {Math.round(maxValue - (maxValue / (gridLines - 1)) * i)}
                </text>
              </g>
            ))}

            {/* X axis */}
            <line
              x1={padding.left}
              y1={padding.top + chartHeight}
              x2={padding.left + chartWidth}
              y2={padding.top + chartHeight}
              stroke="currentColor"
              strokeOpacity="0.2"
              strokeWidth="2"
            />

            {/* Y axis */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={padding.left}
              y2={padding.top + chartHeight}
              stroke="currentColor"
              strokeOpacity="0.2"
              strokeWidth="2"
            />

            {/* Line for each stat */}
            {stats.map((stat, idx) => {
              const points = [stat.value, stat.value, stat.value];
              const path = createLinePath(points.map((val, i) =>
                padding.top + chartHeight - (val * yScale)
              ));

              return (
                <g key={idx}>
                  {/* Line */}
                  <path
                    d={path}
                    fill="none"
                    stroke={stat.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Points */}
                  {xPositions.map((x, i) => {
                    const y = padding.top + chartHeight - (stat.value * yScale);
                    return (
                      <g key={i}>
                        <circle
                          cx={x}
                          cy={y}
                          r="6"
                          fill={stat.color}
                          stroke="white"
                          strokeWidth="2"
                        />
                        {/* Value label on hover */}
                        <title>{`${stat.label}: ${stat.value}`}</title>
                      </g>
                    );
                  })}
                </g>
              );
            })}

            {/* X axis labels */}
            {stats.map((stat, i) => (
              <text
                key={i}
                x={xPositions[i]}
                y={padding.top + chartHeight + 30}
                textAnchor="middle"
                fontSize="12"
                fill="currentColor"
                opacity="0.7"
              >
                {stat.label}
              </text>
            ))}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-6">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: stat.color }}
              />
              <span className="text-sm font-medium">{stat.label}</span>
              <span className="text-sm text-muted-foreground">({stat.value})</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
