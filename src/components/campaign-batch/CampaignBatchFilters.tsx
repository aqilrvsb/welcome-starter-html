import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Calendar as CalendarIcon, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface CampaignBatchFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  sortBy: 'campaign_name' | 'total_batches' | 'total_calls' | 'latest_created_at';
  sortOrder: 'asc' | 'desc';
  stage: string;
}

interface CampaignBatchFiltersProps {
  filters: CampaignBatchFilters;
  onFiltersChange: (filters: CampaignBatchFilters) => void;
  totalCount: number;
  filteredCount: number;
}

export function CampaignBatchFilters({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
}: CampaignBatchFiltersProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search" className="flex items-center gap-2 text-sm font-medium">
              <Search className="h-4 w-4" />
              Cari Nama Kempen
            </Label>
            <Input
              id="search"
              placeholder="Taipkan untuk cari..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            />
          </div>

          {/* Date From */}
          <div className="space-y-2">
            <Label htmlFor="dateFrom" className="flex items-center gap-2 text-sm font-medium">
              <CalendarIcon className="h-4 w-4" />
              Dari Tarikh
            </Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
            />
          </div>

          {/* Date To */}
          <div className="space-y-2">
            <Label htmlFor="dateTo" className="flex items-center gap-2 text-sm font-medium">
              <CalendarIcon className="h-4 w-4" />
              Hingga Tarikh
            </Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
            />
          </div>

          {/* Stage Filter */}
          <div className="space-y-2">
            <Label htmlFor="stage" className="flex items-center gap-2 text-sm font-medium">
              <Search className="h-4 w-4" />
              Stage
            </Label>
            <Input
              id="stage"
              placeholder="e.g. confirmation"
              value={filters.stage}
              onChange={(e) => onFiltersChange({ ...filters, stage: e.target.value })}
            />
          </div>

          {/* Sort By */}
          <div className="space-y-2">
            <Label htmlFor="sortBy" className="flex items-center gap-2 text-sm font-medium">
              <Filter className="h-4 w-4" />
              Susun Mengikut
            </Label>
            <Select
              value={filters.sortBy}
              onValueChange={(value) => onFiltersChange({ ...filters, sortBy: value as CampaignBatchFilters['sortBy'] })}
            >
              <SelectTrigger id="sortBy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest_created_at">Tarikh</SelectItem>
                <SelectItem value="campaign_name">Nama Kempen</SelectItem>
                <SelectItem value="total_batches">Jumlah Batch</SelectItem>
                <SelectItem value="total_calls">Jumlah Panggilan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Summary */}
        {filteredCount !== totalCount && (
          <div className="mt-4 text-sm text-muted-foreground">
            Menunjukkan {filteredCount} daripada {totalCount} kempen
          </div>
        )}
      </CardContent>
    </Card>
  );
}
