import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, Calendar } from "lucide-react";

export interface FailedCallsFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
}

interface FailedCallsFiltersProps {
  filters: FailedCallsFilters;
  onFiltersChange: (filters: FailedCallsFilters) => void;
  totalCalls?: number;
}

export function FailedCallsFilters({ 
  filters, 
  onFiltersChange, 
  totalCalls = 0
}: FailedCallsFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = (key: keyof FailedCallsFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilters = () => {
    const today = new Date().toISOString().split('T')[0];
    onFiltersChange({
      search: '',
      dateFrom: '',
      dateTo: today
    });
  };

  const hasActiveFilters = filters.search || 
    filters.dateFrom || 
    (filters.dateTo && filters.dateTo !== new Date().toISOString().split('T')[0]);

  const activeFiltersCount = [
    filters.search,
    filters.dateFrom || filters.dateTo
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
                placeholder="Cari nama atau nombor telefon..."
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Dari Tarikh
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
                Hingga Tarikh
              </label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Results Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-muted-foreground pt-2 border-t">
          <div>
            <span className="font-medium">
              {totalCalls} panggilan gagal
            </span>
          </div>
          
          {hasActiveFilters && (
            <Button variant="link" size="sm" onClick={clearFilters} className="h-auto p-0">
              Clear all filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
