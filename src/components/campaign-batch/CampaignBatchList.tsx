import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, BarChart3, Calendar, Users, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { CampaignBatchDetail } from './CampaignBatchDetail';
import { CampaignBatchFilters, CampaignBatchFilters as CampaignBatchFiltersType } from './CampaignBatchFilters';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface CampaignGroup {
  campaign_name: string;
  total_batches: number;
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  latest_created_at: string;
}

export function CampaignBatchList() {
  const { user } = useCustomAuth();
  const queryClient = useQueryClient();
  const [selectedCampaignName, setSelectedCampaignName] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<CampaignBatchFiltersType>({
    search: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'latest_created_at',
    sortOrder: 'desc',
    stage: ''
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignName: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Delete all campaigns with this name
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('user_id', user.id)
        .eq('campaign_name', campaignName);
      
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['campaign-groups'] });
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    },
  });

  const handleDeleteClick = (campaignName: string) => {
    setCampaignToDelete(campaignName);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (campaignToDelete) {
      deleteCampaignMutation.mutate(campaignToDelete);
    }
  };

  // Fetch grouped campaigns
  const { data: campaignGroups, isLoading } = useQuery({
    queryKey: ['campaign-groups', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) return [];

      let query = supabase
        .from('campaigns')
        .select('campaign_name, total_numbers, successful_calls, failed_calls, created_at, id')
        .eq('user_id', user.id);

      // Date range filter
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        query = query.gte('created_at', fromDate.toISOString());
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', toDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // If stage filter is applied, filter campaigns by stage
      let filteredData = data;
      if (filters.stage) {
        const campaignsWithStage = await Promise.all(
          data.map(async (campaign) => {
            const { data: callLogs } = await supabase
              .from('call_logs')
              .select('stage_reached')
              .eq('campaign_id', campaign.id)
              .not('stage_reached', 'is', null);
            
            const hasMatchingStage = callLogs?.some(log => 
              log.stage_reached?.toLowerCase().includes(filters.stage.toLowerCase())
            );
            
            return hasMatchingStage ? campaign : null;
          })
        );
        filteredData = campaignsWithStage.filter(c => c !== null) as typeof data;
      }

      // Group by campaign_name
      const grouped = filteredData.reduce((acc, campaign) => {
        const name = campaign.campaign_name;
        if (!acc[name]) {
          acc[name] = {
            campaign_name: name,
            total_batches: 0,
            total_calls: 0,
            successful_calls: 0,
            failed_calls: 0,
            latest_created_at: campaign.created_at,
          };
        }
        acc[name].total_batches += 1;
        acc[name].total_calls += campaign.total_numbers || 0;
        acc[name].successful_calls += campaign.successful_calls || 0;
        acc[name].failed_calls += campaign.failed_calls || 0;
        
        // Keep the latest date
        if (new Date(campaign.created_at) > new Date(acc[name].latest_created_at)) {
          acc[name].latest_created_at = campaign.created_at;
        }
        
        return acc;
      }, {} as Record<string, CampaignGroup>);

      return Object.values(grouped);
    },
    enabled: !!user,
  });

  // Apply search and sorting filters
  const filteredGroups = useMemo(() => {
    if (!campaignGroups) return [];
    
    let filtered = campaignGroups.filter(group =>
      !filters.search || 
      group.campaign_name.toLowerCase().includes(filters.search.toLowerCase())
    );

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[filters.sortBy];
      let bValue: any = b[filters.sortBy];

      if (filters.sortBy === 'latest_created_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (filters.sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [campaignGroups, filters]);

  const totalCount = campaignGroups?.length || 0;
  const filteredCount = filteredGroups.length;

  if (selectedCampaignName) {
    return (
      <CampaignBatchDetail
        campaignName={selectedCampaignName}
        onBack={() => setSelectedCampaignName(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <CampaignBatchFilters
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={totalCount}
        filteredCount={filteredCount}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Senarai Kempen Batch
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredCount === totalCount ? 
                `${totalCount} total campaign groups` : 
                `${filteredCount} of ${totalCount} campaign groups`
              }
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p>Memuat senarai kempen...</p>
            </div>
          ) : !filteredGroups || filteredGroups.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {filters.search || filters.dateFrom || filters.dateTo ? 
                  "No campaign groups match your filters." : 
                  "Tiada kempen dijumpai. Mulakan kempen batch call pertama anda di halaman Contacts."
                }
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">No</TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 font-semibold hover:bg-transparent"
                          onClick={() => setFilters({...filters, sortBy: 'campaign_name', sortOrder: filters.sortBy === 'campaign_name' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                        >
                          Nama Kempen
                          {filters.sortBy === 'campaign_name' && (
                            filters.sortOrder === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 font-semibold hover:bg-transparent"
                          onClick={() => setFilters({...filters, sortBy: 'total_batches', sortOrder: filters.sortBy === 'total_batches' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                        >
                          Jumlah Batch
                          {filters.sortBy === 'total_batches' && (
                            filters.sortOrder === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 font-semibold hover:bg-transparent"
                          onClick={() => setFilters({...filters, sortBy: 'total_calls', sortOrder: filters.sortBy === 'total_calls' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                        >
                          Jumlah Panggilan
                          {filters.sortBy === 'total_calls' && (
                            filters.sortOrder === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 font-semibold hover:bg-transparent"
                          onClick={() => setFilters({...filters, sortBy: 'latest_created_at', sortOrder: filters.sortBy === 'latest_created_at' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                        >
                          Tarikh Terakhir
                          {filters.sortBy === 'latest_created_at' && (
                            filters.sortOrder === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />
                          )}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Tindakan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((group, index) => {
                      return (
                        <TableRow key={group.campaign_name}>
                          <TableCell className="text-center font-medium">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            <p className="font-semibold">{group.campaign_name}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{group.total_batches}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{group.total_calls}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {new Date(group.latest_created_at).toLocaleDateString('ms-MY', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedCampaignName(group.campaign_name)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(group.campaign_name)}
                                disabled={deleteCampaignMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-4">
                {filteredGroups.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((group, index) => {
                  return (
                    <Card key={group.campaign_name} className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs bg-muted px-2 py-1 rounded">
                              #{(currentPage - 1) * itemsPerPage + index + 1}
                            </span>
                          </div>
                          <h3 className="font-semibold text-sm">{group.campaign_name}</h3>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCampaignName(group.campaign_name)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(group.campaign_name)}
                            disabled={deleteCampaignMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Jumlah Batch:</span>
                          <span className="font-medium">{group.total_batches}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Jumlah Panggilan:</span>
                          <span className="font-medium">{group.total_calls}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Tarikh Terakhir:</span>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {new Date(group.latest_created_at).toLocaleDateString('ms-MY', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {filteredGroups.length > itemsPerPage && (
                <div className="flex justify-center mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) setCurrentPage(currentPage - 1);
                          }}
                          className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.ceil(filteredGroups.length / itemsPerPage) }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(page);
                            }}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      
                      <PaginationItem>
                        <PaginationNext 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < Math.ceil(filteredGroups.length / itemsPerPage)) setCurrentPage(currentPage + 1);
                          }}
                          className={currentPage === Math.ceil(filteredGroups.length / itemsPerPage) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Padam Kempen Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Adakah anda pasti mahu padam semua batch untuk "{campaignToDelete}"? Tindakan ini tidak boleh dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Padam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
