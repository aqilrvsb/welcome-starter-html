import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SortableColumn {
  key: string
  label: string
  sortable?: boolean
  render?: (value: any, row: any) => React.ReactNode
  className?: string
}

export interface SortableTableProps {
  columns: SortableColumn[]
  data: any[]
  sortKey?: string
  sortOrder?: 'asc' | 'desc'
  onSort?: (key: string, order: 'asc' | 'desc') => void
  className?: string
}

export function SortableTable({
  columns,
  data,
  sortKey,
  sortOrder,
  onSort,
  className
}: SortableTableProps) {
  const [internalSortKey, setInternalSortKey] = useState<string>('')
  const [internalSortOrder, setInternalSortOrder] = useState<'asc' | 'desc'>('asc')

  const currentSortKey = sortKey ?? internalSortKey
  const currentSortOrder = sortOrder ?? internalSortOrder

  const handleSort = (key: string) => {
    const newOrder = currentSortKey === key && currentSortOrder === 'asc' ? 'desc' : 'asc'
    
    if (onSort) {
      onSort(key, newOrder)
    } else {
      setInternalSortKey(key)
      setInternalSortOrder(newOrder)
    }
  }

  const sortedData = !onSort ? [...data].sort((a, b) => {
    if (!currentSortKey) return 0
    
    const aValue = a[currentSortKey]
    const bValue = b[currentSortKey]
    
    if (aValue === null || aValue === undefined) return 1
    if (bValue === null || bValue === undefined) return -1
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return currentSortOrder === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue)
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return currentSortOrder === 'asc' ? aValue - bValue : bValue - aValue
    }
    
    // For dates
    const aDate = new Date(aValue)
    const bDate = new Date(bValue)
    if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
      return currentSortOrder === 'asc' 
        ? aDate.getTime() - bDate.getTime()
        : bDate.getTime() - aDate.getTime()
    }
    
    return 0
  }) : data

  const getSortIcon = (columnKey: string) => {
    if (!currentSortKey || currentSortKey !== columnKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    
    return currentSortOrder === 'asc' 
      ? <ChevronUp className="ml-2 h-4 w-4" />
      : <ChevronDown className="ml-2 h-4 w-4" />
  }

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} className={column.className}>
              {column.sortable !== false ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-semibold text-left hover:bg-transparent"
                  onClick={() => handleSort(column.key)}
                >
                  {column.label}
                  {getSortIcon(column.key)}
                </Button>
              ) : (
                column.label
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedData.map((row, index) => (
          <TableRow key={row.id || index}>
            {columns.map((column) => (
              <TableCell key={column.key} className={column.className}>
                {column.render 
                  ? column.render(row[column.key], row)
                  : row[column.key]
                }
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}