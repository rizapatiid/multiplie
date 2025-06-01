"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PlatformSummaryStats } from '@/types';
import { getPlatformIcon } from '@/lib/platform-icons';
import {TrendingUp, Music, DollarSign } from 'lucide-react';

interface PlatformSummaryCardProps {
  summary: PlatformSummaryStats;
}

export function PlatformSummaryCard({ summary }: PlatformSummaryCardProps) {
  const PlatformIcon = getPlatformIcon(summary.platform);

  return (
    <Card className="w-full transform transition-all duration-300 hover:shadow-xl hover:scale-105">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium font-headline flex items-center">
          <PlatformIcon className="mr-3 h-6 w-6 text-primary" />
          {summary.platform}
        </CardTitle>
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center">
            <DollarSign className="mr-1.5 h-4 w-4" /> Total Revenue
          </span>
          <span className="font-semibold text-primary">
            ${summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 h-4 w-4 lucide lucide-bar-chart-3"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            Total Streams
          </span>
          <span className="font-semibold">
            {summary.totalStreams.toLocaleString()}
          </span>
        </div>
         <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center">
            <Music className="mr-1.5 h-4 w-4" /> Unique Tracks
          </span>
          <span className="font-semibold">
            {summary.trackCount.toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
