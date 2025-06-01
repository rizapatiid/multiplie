"use client";

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { DistributionDataEntry } from '@/types';
import { getPlatformIcon } from '@/lib/platform-icons';

interface DataTableProps {
  data: DistributionDataEntry[];
}

type SortConfig = {
  key: keyof DistributionDataEntry | null;
  direction: 'ascending' | 'descending';
};

const ITEMS_PER_PAGE = 10;

export function DataTable({ data }: DataTableProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'descending' });
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  const uniquePlatforms = useMemo(() => {
    const platforms = new Set(data.map(item => item.platform));
    return ['all', ...Array.from(platforms)];
  }, [data]);

  const filteredData = useMemo(() => {
    let
     items = data;
    if (searchTerm) {
      items = items.filter(item =>
        item.trackName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.artistName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (platformFilter !== 'all') {
      items = items.filter(item => item.platform === platformFilter);
    }
    return items;
  }, [data, searchTerm, platformFilter]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key!] < b[sortConfig.key!]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key!] > b[sortConfig.key!]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);
  
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);

  const requestSort = (key: keyof DistributionDataEntry) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const renderSortIcon = (columnKey: keyof DistributionDataEntry) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortConfig.direction === 'ascending' ? '🔼' : '🔽';
  };

  if (data.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No data to display.</p>;
  }

  const columns: { key: keyof DistributionDataEntry; label: string; sortable?: boolean, format?: (value: any) => React.ReactNode }[] = [
    { key: 'trackName', label: 'Track Name', sortable: true },
    { key: 'artistName', label: 'Artist Name', sortable: true },
    { 
      key: 'platform', 
      label: 'Platform', 
      sortable: true, 
      format: (value) => {
        const Icon = getPlatformIcon(value as string);
        return <div className="flex items-center"><Icon className="mr-2 h-4 w-4" /> {value}</div>;
      }
    },
    { key: 'streamCount', label: 'Streams', sortable: true, format: (value) => (value as number).toLocaleString() },
    { key: 'revenue', label: 'Revenue', sortable: true, format: (value) => `$${(value as number).toFixed(2)}` },
    { key: 'date', label: 'Date', sortable: true },
  ];

  return (
    <div className="w-full bg-card p-4 sm:p-6 rounded-lg shadow-lg animate-fade-in">
      <h2 className="text-2xl font-headline font-semibold mb-6">Distribution Data</h2>
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tracks or artists..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="pl-10"
          />
        </div>
        <Select value={platformFilter} onValueChange={(value) => { setPlatformFilter(value); setCurrentPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by platform" />
          </SelectTrigger>
          <SelectContent>
            {uniquePlatforms.map(platform => (
              <SelectItem key={platform} value={platform}>
                {platform === 'all' ? 'All Platforms' : platform}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={col.key} className={col.sortable ? "cursor-pointer hover:bg-muted" : ""} onClick={() => col.sortable && requestSort(col.key)}>
                  <div className="flex items-center">
                    {col.label}
                    {col.sortable && renderSortIcon(col.key)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((item) => (
              <TableRow key={item.id}>
                {columns.map(col => (
                  <TableCell key={col.key}>
                    {col.format ? col.format(item[col.key]) : item[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
