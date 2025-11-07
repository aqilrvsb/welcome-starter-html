import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, BarChart3, Calendar, Users, Phone, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { CampaignDetails } from "./CampaignDetails";
import { CampaignFilters, CampaignFilters as CampaignFiltersType } from "./CampaignFilters";
import { CampaignActions } from "./CampaignActions";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { isCallSuccessful, isCallFailed, calculateSuccessRate } from "@/lib/statusUtils";
import { Link } from "react-router-dom";

export function CampaignsList() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<CampaignFiltersType>({
    search: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
    callStatus: 'all',
    stage: ''
  });
  const itemsPerPage = 10;
  const { user } = useCustomAuth();

  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ["campaigns", user?.id, filters],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      // Build query with comprehensive filtering
      let query = supabase
        .from('campaigns')
        .select(`
          *,
          prompts:prompt_id (
            prompt_name
          )
        `)
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

      // Sorting
      query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' });

      const { data: campaignsData, error: campaignsError } = await query;
      if (campaignsError) throw campaignsError;

      // Get call logs for each campaign to calculate stage statistics
      const campaignsWithStats = await Promise.all(
        campaignsData.map(async (campaign) => {
          const { data: callLogs } = await supabase
            .from('call_logs')
            .select('status, metadata')
            .eq('campaign_id', campaign.id);

          const totalCalls = callLogs?.length || 0;
          
          // Calculate stage distribution
          const normalizeStage = (stage: string): string => {
            const stageLower = stage.toLowerCase();
            if (stageLower.includes('intro')) return 'Introduction';
            if (stageLower.includes('fact') || stageLower.includes('finding') || stageLower.includes('masalah')) return 'Fact Finding Masalah';
            if (stageLower.includes('present') || stageLower.includes('product') || stageLower.includes('produk')) return 'Present Produk';
            if (stageLower.includes('harga') || stageLower.includes('price')) return 'Harga';
            if (stageLower.includes('confirm') || stageLower.includes('close') || stageLower.includes('order')) return 'Confirmation Order';
            return 'Introduction';
          };

          const stageStats = callLogs?.reduce((acc, log) => {
            const metadata = log.metadata as any;
            const rawStage = metadata?.stage_reached;
            
            // Skip calls without stage_reached
            if (!rawStage) return acc;
            
            const normalizedStage = normalizeStage(rawStage);
            acc[normalizedStage] = (acc[normalizedStage] || 0) + 1;
            return acc;
          }, {} as Record<string, number>) || {};

          // Get the most reached stage for this campaign
          const stages = ['Introduction', 'Fact Finding Masalah', 'Present Produk', 'Harga', 'Confirmation Order'];
          const topStage = stages.find(stage => stageStats[stage] > 0) || 'Introduction';

          return {
            ...campaign,
            // Use actual call logs count instead of stored value
            total_numbers: totalCalls,
            actual_calls: totalCalls,
            stage_stats: stageStats,
            top_stage: topStage
          };
        })
      );

      return campaignsWithStats;
    },
    enabled: !!user,
  });

  // Apply search and status filters
  const filteredCampaigns = useMemo(() => {
    if (!campaignsData) return [];
    
    return campaignsData.filter(campaign => {
      const matchesSearch = !filters.search || 
        campaign.campaign_name.toLowerCase().includes(filters.search.toLowerCase()) ||
        campaign.prompts?.prompt_name?.toLowerCase().includes(filters.search.toLowerCase());
      
      // Apply call status filter
      const matchesStatus = async () => {
        if (filters.callStatus === 'all') return true;
        
        // Check if campaign has any answered calls
        const { data: answeredCalls } = await supabase
          .from('call_logs')
          .select('id')
          .eq('campaign_id', campaign.id)
          .eq('status', 'answered')
          .limit(1);
        
        const hasAnsweredCalls = answeredCalls && answeredCalls.length > 0;
        
        return filters.callStatus === 'has_answered' ? hasAnsweredCalls : !hasAnsweredCalls;
      };

      // For now, we'll use a simpler approach based on successful_calls
      const matchesStatusSync = 
        filters.callStatus === 'all' ? true :
        filters.callStatus === 'has_answered' ? (campaign.successful_calls || 0) > 0 :
        (campaign.successful_calls || 0) === 0;
      
      // Apply stage filter - check if campaign has calls with matching stage
      const matchesStage = !filters.stage || 
        (campaign.top_stage && campaign.top_stage.toLowerCase().includes(filters.stage.toLowerCase()));
      
      return matchesSearch && matchesStatusSync && matchesStage;
    });
  }, [campaignsData, filters.search, filters.callStatus]);

  const totalCount = campaignsData?.length || 0;
  const filteredCount = filteredCampaigns.length;

  if (selectedCampaignId) {
    return (
      <CampaignDetails 
        campaignId={selectedCampaignId} 
        onBack={() => setSelectedCampaignId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <CampaignFilters
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
              Senarai Kempen Batch Call
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredCount === totalCount ? 
                `${totalCount} total campaigns` : 
                `${filteredCount} of ${totalCount} campaigns`
              }
            </p>
          </div>
        </CardHeader>
        <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <p>Memuat senarai kempen...</p>
          </div>
        ) : !filteredCampaigns || filteredCampaigns.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
            {filters.search || filters.dateFrom || filters.dateTo ? 
                "No campaigns match your filters." : 
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
                    <TableHead>Prompt</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => setFilters({...filters, sortBy: 'total_numbers', sortOrder: filters.sortBy === 'total_numbers' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                      >
                        Jumlah Numbers
                        {filters.sortBy === 'total_numbers' && (
                          filters.sortOrder === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => setFilters({...filters, sortBy: 'created_at', sortOrder: filters.sortBy === 'created_at' && filters.sortOrder === 'asc' ? 'desc' : 'asc'})}
                      >
                        Tarikh
                        {filters.sortBy === 'created_at' && (
                          filters.sortOrder === 'asc' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Tindakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((campaign, index) => {
                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="text-center font-medium">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>
                            <p className="font-semibold">{campaign.campaign_name}</p>
                            {campaign.actual_calls !== campaign.total_numbers && (
                              <p className="text-xs text-muted-foreground">
                                Actual calls: {campaign.actual_calls}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-32">
                            <p className="text-sm font-medium truncate">
                              {campaign.prompts?.prompt_name || "Prompt deleted"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{campaign.total_numbers || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {new Date(campaign.created_at).toLocaleDateString('ms-MY', {
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
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedCampaignId(campaign.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <CampaignActions campaign={campaign} />
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
              {filteredCampaigns.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((campaign, index) => (
                <Card key={campaign.id} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-muted px-2 py-1 rounded">
                          #{(currentPage - 1) * itemsPerPage + index + 1}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm">{campaign.campaign_name}</h3>
                      {campaign.actual_calls !== campaign.total_numbers && (
                        <p className="text-xs text-muted-foreground">
                          Actual calls: {campaign.actual_calls}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCampaignId(campaign.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <CampaignActions campaign={campaign} />
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Prompt:</span>
                      <span className="font-medium truncate ml-2">
                        {campaign.prompts?.prompt_name || "Prompt deleted"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Numbers:</span>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{campaign.total_numbers || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {new Date(campaign.created_at).toLocaleDateString('ms-MY', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          
          {filteredCampaigns.length > itemsPerPage && (
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
                  
                  {Array.from({ length: Math.ceil(filteredCampaigns.length / itemsPerPage) }, (_, i) => i + 1).map((page) => (
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
                        if (currentPage < Math.ceil(filteredCampaigns.length / itemsPerPage)) setCurrentPage(currentPage + 1);
                      }}
                      className={currentPage === Math.ceil(filteredCampaigns.length / itemsPerPage) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
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
    </div>
  );
}