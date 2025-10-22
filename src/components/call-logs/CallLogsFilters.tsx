import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, SortAsc, SortDesc, Calendar, Phone } from "lucide-react";

export interface CallLogsFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  callStatus: 'all' | 'answered' | 'not_answered';
  stage: string;
}

interface CallLogsFiltersProps {
  filters: CallLogsFilters;
  onFiltersChange: (filters: CallLogsFilters) => void;
  totalCount?: number;
  filteredCount?: number;
  totalCost?: number;
}

export function CallLogsFilters({ 
  filters, 
  onFiltersChange, 
  totalCount = 0, 
  filteredCount = 0,
  totalCost = 0
}: CallLogsFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = (key: keyof CallLogsFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      dateFrom: '',
      dateTo: '',
      sortBy: 'created_at',
      sortOrder: 'desc',
      callStatus: 'all',
      stage: ''
    });
  };

  const hasActiveFilters = filters.search || 
    filters.dateFrom || 
    filters.dateTo ||
    filters.callStatus !== 'all' ||
    filters.stage;

  const activeFiltersCount = [
    filters.search,
    filters.dateFrom || filters.dateTo,
    filters.callStatus !== 'all',
    filters.stage
  ].filter(Boolean).length;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Search and Toggle */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by nama, caller, or prompt..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
            
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                From Date
              </label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                To Date
              </label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Call Status
              </label>
              <Select value={filters.callStatus} onValueChange={(value) => updateFilter('callStatus', value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All calls" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Panggilan</SelectItem>
                  <SelectItem value="answered">Customer Angkat</SelectItem>
                  <SelectItem value="not_answered">Customer Tak Angkat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Stage
              </label>
              <Input
                placeholder="e.g. confirmation"
                value={filters.stage}
                onChange={(e) => updateFilter('stage', e.target.value)}
                className="w-full"
              />
            </div>

          </div>
        )}

        {/* Results Summary */}
        {(hasActiveFilters || totalCount > 0) && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-muted-foreground pt-2 border-t">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span>
                {hasActiveFilters ? (
                  <>Showing {filteredCount} of {totalCount} call logs</>
                ) : (
                  <>Total: {totalCount} call logs</>
                )}
              </span>
              
              {totalCost > 0 && (
                <span className="font-medium">
                  Total VAPI Cost: ${totalCost.toFixed(4)}
                </span>
              )}
            </div>
            
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={clearFilters} className="h-auto p-0">
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}