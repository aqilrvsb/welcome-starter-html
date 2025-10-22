import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { calculateSuccessRate } from '@/lib/statusUtils';

interface Campaign {
  id: string;
  campaign_name: string;
  status: string;
  total_numbers: number;
  successful_calls: number;
  failed_calls: number;
  created_at: string;
}

interface RecentCampaignsProps {
  campaigns: Campaign[];
  isLoading?: boolean;
}

export function RecentCampaigns({ campaigns, isLoading }: RecentCampaignsProps) {


  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
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
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Campaigns</CardTitle>
          <CardDescription>
            Your latest campaign performance
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/campaigns">
            View All
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No campaigns found</p>
            <Button asChild>
              <Link to="/contacts">Create Your First Campaign</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.slice(0, 5).map((campaign) => {
              const successRate = calculateSuccessRate(
                campaign.successful_calls || 0, 
                campaign.total_numbers || 0
              );
              
              return (
                <div 
                  key={campaign.id} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h4 className="font-medium text-foreground truncate">
                        {campaign.campaign_name}
                      </h4>
                      <div className="flex items-center gap-1">
                        {successRate >= 50 ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className={`text-xs font-medium ${successRate >= 50 ? 'text-success' : 'text-destructive'}`}>
                          {successRate >= 50 ? 'Success' : 'Failed'}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <span className="bg-muted px-2 py-1 rounded">{campaign.total_numbers || 0} total</span>
                      <span className="bg-success/10 text-success px-2 py-1 rounded">{campaign.successful_calls || 0} successful</span>
                      <span className="font-medium text-primary">{successRate}% rate</span>
                      <span className="hidden sm:inline">
                        {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full sm:w-auto" asChild>
                    <Link to="/campaigns">
                      View Details
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}