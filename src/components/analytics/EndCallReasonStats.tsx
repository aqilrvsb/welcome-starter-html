import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle } from 'lucide-react';

interface EndCallReasonStatsProps {
  callLogs: Array<{
    status: string;
    end_of_call_report?: any;
    metadata?: any;
  }>;
  isLoading?: boolean;
}

export function EndCallReasonStats({ callLogs, isLoading }: EndCallReasonStatsProps) {
  // Calculate call outcomes
  const getCallOutcomes = () => {
    let customerAnswer = 0;
    let customerNoAnswer = 0;

    callLogs.forEach(log => {
      // Use the categorized status from webhook
      const callOutcome = log.metadata?.call_outcome || log.status;
      
      if (callOutcome === 'answered') {
        customerAnswer++;
      } else {
        customerNoAnswer++;
      }
    });

    return { customerAnswer, customerNoAnswer };
  };

  const outcomes = getCallOutcomes();
  const total = callLogs.length;

  const getPercentage = (count: number) => {
    return total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            <span>Status Panggilan</span>
          </CardTitle>
          <CardDescription>
            Breakdown of call outcomes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          <span>Status Panggilan</span>
        </CardTitle>
        <CardDescription>
          Breakdown of call outcomes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm font-medium">Customer Answer Call</span>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">{outcomes.customerAnswer}</p>
              <p className="text-xs text-muted-foreground">
                {getPercentage(outcomes.customerAnswer)}% of calls
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium">Customer Not Answer Call</span>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">{outcomes.customerNoAnswer}</p>
              <p className="text-xs text-muted-foreground">
                {getPercentage(outcomes.customerNoAnswer)}% of calls
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}