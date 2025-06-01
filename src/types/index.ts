
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

export type ReleaseStatus = "Upload" | "Pending" | "Rilis" | "Takedown";

export interface ReleaseEntry {
  idRilis: string; // Sebaiknya ini ID unik dari spreadsheet atau yang digenerate server
  judulRilisan: string;
  artist: string;
  upc?: string;
  isrc?: string;
  tanggalTayang: Date;
  status: ReleaseStatus;
  coverArtUrl?: string; // Ini akan menjadi URL ke Google Drive atau ID file Drive
  audioFileName?: string; // Bisa nama file asli, atau ID file Drive
  // idInternalSpreadsheet?: string; // Jika Anda memiliki ID unik di Spreadsheet
}

// Digunakan oleh form, sebelum file diupload dan mendapatkan URL/ID
export interface ReleaseFormValues {
  idRilis?: string; // Opsional saat membuat, ada saat mengedit
  judulRilisan: string;
  artist: string;
  upc?: string;
  isrc?: string;
  tanggalTayang: Date;
  status: ReleaseStatus;
  coverArtUrl?: string; // URL yang ada (untuk edit) atau string kosong
  audioFileName?: string; // Nama file yang ada (untuk edit)
  // File object untuk upload baru/penggantian
  coverArtFile?: File | null;
  audioFile?: File | null;
}
