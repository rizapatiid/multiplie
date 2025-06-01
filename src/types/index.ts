
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

export type ReleaseStatus = "Upload" | "Pending Rilis" | "Takedown";

export interface ReleaseEntry {
  idRilis: string;
  judulRilisan: string;
  artist: string;
  upc?: string;
  isrc?: string;
  tanggalTayang: Date;
  status: ReleaseStatus;
}
