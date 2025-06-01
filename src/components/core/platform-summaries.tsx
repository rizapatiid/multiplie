"use client";

import React, { useMemo } from 'react';
import type { DistributionDataEntry, PlatformSummaryStats } from '@/types';
import { PlatformSummaryCard } from './platform-summary-card';

interface PlatformSummariesProps {
  data: DistributionDataEntry[];
}

export function PlatformSummaries({ data }: PlatformSummariesProps) {
  const summaries = useMemo(() => {
    if (!data || data.length === 0) return [];

    const platformMap: { [key: string]: { totalRevenue: number; totalStreams: number; tracks: Set<string> } } = {};

    data.forEach(item => {
      if (!platformMap[item.platform]) {
        platformMap[item.platform] = { totalRevenue: 0, totalStreams: 0, tracks: new Set() };
      }
      platformMap[item.platform].totalRevenue += item.revenue;
      platformMap[item.platform].totalStreams += item.streamCount;
      platformMap[item.platform].tracks.add(item.trackName);
    });

    return Object.entries(platformMap)
      .map(([platform, stats]) => ({
        platform,
        totalRevenue: stats.totalRevenue,
        totalStreams: stats.totalStreams,
        trackCount: stats.tracks.size,
      } as PlatformSummaryStats))
      .sort((a, b) => b.totalRevenue - a.totalRevenue); // Sort by revenue descending
  }, [data]);

  if (summaries.length === 0) {
    return null; // Or some placeholder if needed when data exists but no summaries can be made
  }

  return (
    <div className="w-full mb-8 animate-fade-in">
      <h2 className="text-2xl font-headline font-semibold mb-6 text-center sm:text-left">Platform Performance</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {summaries.map(summary => (
          <PlatformSummaryCard key={summary.platform} summary={summary} />
        ))}
      </div>
    </div>
  );
}
