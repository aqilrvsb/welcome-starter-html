import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { useMemo } from 'react';

interface StageAnalyticsProps {
  callLogs: Array<{
    status: string;
    metadata?: any;
    id?: string;
  }>;
  isLoading?: boolean;
}

interface StageData {
  stage_name: string;
  count: number;
  first_occurrence: number;
}

export function StageAnalytics({ callLogs, isLoading }: StageAnalyticsProps) {
  // Calculate dynamic stage distribution from database
  const stageStats = useMemo(() => {
    const stageMap = new Map<string, { count: number; first_occurrence: number }>();
    
    callLogs.forEach((log, index) => {
      // Only count answered calls with stage_reached
      if (log.status !== 'answered') return;
      
      const metadata = log.metadata as any;
      const stageReached = metadata?.stage_reached;
      
      if (!stageReached) return;
      
      const stageName = String(stageReached).trim();
      
      if (stageMap.has(stageName)) {
        stageMap.get(stageName)!.count++;
      } else {
        stageMap.set(stageName, {
          count: 1,
          first_occurrence: index
        });
      }
    });
    
    // Convert to array and sort by first occurrence
    const stageArray: StageData[] = Array.from(stageMap.entries()).map(([stage_name, data]) => ({
      stage_name,
      count: data.count,
      first_occurrence: data.first_occurrence
    }));
    
    stageArray.sort((a, b) => a.first_occurrence - b.first_occurrence);
    
    return stageArray;
  }, [callLogs]);

  const total = useMemo(() => {
    return stageStats.reduce((sum, stage) => sum + stage.count, 0);
  }, [stageStats]);

  const getPercentage = (count: number) => {
    return total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
  };

  // Generate colors dynamically
  const getStageColor = (index: number) => {
    const colors = [
      { text: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
      { text: 'text-green-500', bg: 'bg-green-50 dark:bg-green-950/30' },
      { text: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
      { text: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30' },
      { text: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
      { text: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-950/30' },
      { text: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
      { text: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-950/30' },
      { text: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
      { text: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-950/30' }
    ];
    return colors[index % colors.length];
  };

  if (isLoading) {
    return (
      <Card className="hover:shadow-md transition-shadow mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>Stage Analytics</span>
          </CardTitle>
          <CardDescription>
            Distribution of calls by conversation stage reached
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-muted rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <span>Stage Analytics</span>
        </CardTitle>
        <CardDescription>
          Distribution of answered calls by conversation stage reached
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stageStats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No stage data available yet
          </div>
        ) : (
          <div className="space-y-4">
            {stageStats.map((stage, index) => {
              const colorScheme = getStageColor(index);
              return (
                <div key={index} className={`flex items-center justify-between p-4 rounded-lg ${colorScheme.bg}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background">
                      <BarChart3 className={`h-5 w-5 ${colorScheme.text}`} />
                    </div>
                    <div>
                      <span className="text-sm font-medium">{stage.stage_name}</span>
                      <p className="text-xs text-muted-foreground">
                        Stage {index + 1} of {stageStats.length}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{stage.count}</p>
                    <p className="text-xs text-muted-foreground">
                      {getPercentage(stage.count)}% of calls
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {total > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Answered Calls Analyzed</span>
              <span className="font-medium">{total}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}