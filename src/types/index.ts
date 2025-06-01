export interface DistributionDataEntry {
  id: string;
  trackName: string;
  artistName: string;
  platform: string;
  streamCount: number;
  revenue: number;
  date: string; // Keep as string for simplicity, can be Date object if needed
  [key: string]: any; // For any other columns
}

export interface PlatformSummaryStats {
  platform: string;
  totalRevenue: number;
  totalStreams: number;
  trackCount: number;
}
