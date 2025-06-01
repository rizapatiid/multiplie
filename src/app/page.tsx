
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CsvImporter } from '@/components/core/csv-importer';
import { DataTable } from '@/components/core/data-table';
import { PlatformSummaries } from '@/components/core/platform-summaries';
import { RevenueInsightsGenerator } from '@/components/core/revenue-insights-generator';
import { LatestReleases } from '@/components/dashboard/latest-releases';
import { TopArtists } from '@/components/dashboard/top-artists';
import type { DistributionDataEntry, ReleaseEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, ShieldAlert, MusicNote, User } from 'lucide-react';

const DISTRIBUTION_DATA_KEY = 'trackStackData';
const RELEASES_DATA_KEY = 'trackStackReleases';

export default function HomePage() {
  const [distributionData, setDistributionData] = useState<DistributionDataEntry[]>([]);
  const [releaseData, setReleaseData] = useState<ReleaseEntry[]>([]);
  const [isLoadingCsv, setIsLoadingCsv] = useState(false);
  const { toast } = useToast();
  const [showDistributionDataSections, setShowDistributionDataSections] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load distribution data
      const storedDistributionData = localStorage.getItem(DISTRIBUTION_DATA_KEY);
      if (storedDistributionData) {
        try {
          const parsedData = JSON.parse(storedDistributionData);
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            setDistributionData(parsedData);
            setShowDistributionDataSections(true);
            toast({
              title: "Data Distribusi Dimuat",
              description: "Data impor sebelumnya telah dimuat dari local storage.",
            });
          }
        } catch (error) {
          console.error("Gagal memuat data distribusi dari localStorage", error);
          localStorage.removeItem(DISTRIBUTION_DATA_KEY);
        }
      }

      // Load release data
      const storedReleaseData = localStorage.getItem(RELEASES_DATA_KEY);
      if (storedReleaseData) {
        try {
          const parsedReleases = JSON.parse(storedReleaseData).map((r: any) => ({
            ...r,
            tanggalTayang: new Date(r.tanggalTayang),
          }));
          if (Array.isArray(parsedReleases) && parsedReleases.length > 0) {
            setReleaseData(parsedReleases);
             toast({
              title: "Data Rilisan Dimuat",
              description: "Data rilisan sebelumnya telah dimuat dari local storage.",
            });
          }
        } catch (error) {
          console.error("Gagal memuat data rilisan dari localStorage", error);
          localStorage.removeItem(RELEASES_DATA_KEY);
        }
      }
    }
  }, [toast]);

  const handleCsvImport = (parsedData: DistributionDataEntry[], error?: string) => {
    setIsLoadingCsv(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "Kesalahan Impor CSV",
        description: error,
      });
      setDistributionData([]);
      setShowDistributionDataSections(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(DISTRIBUTION_DATA_KEY);
      }
    } else if (parsedData.length > 0) {
      setDistributionData(parsedData);
      setShowDistributionDataSections(true);
      toast({
        title: "CSV Berhasil Diimpor",
        description: `Berhasil mengimpor ${parsedData.length} rekaman.`,
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem(DISTRIBUTION_DATA_KEY, JSON.stringify(parsedData));
      }
    } else {
       toast({
        title: "Tidak Ada Data Diimpor",
        description: "File CSV kosong atau tidak berisi baris data yang valid.",
      });
      setDistributionData([]);
      setShowDistributionDataSections(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(DISTRIBUTION_DATA_KEY);
      }
    }
  };
  
  const handleClearDistributionData = () => {
    setDistributionData([]);
    setShowDistributionDataSections(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(DISTRIBUTION_DATA_KEY);
    }
    toast({
      title: "Data Distribusi Dihapus",
      description: "Semua data impor telah dihapus.",
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-3xl font-bold font-headline tracking-tight text-primary">
            VortexTunes Digital
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/" passHref>
              <Button variant="outline" size="sm" className="border-primary text-primary">Dashboard</Button>
            </Link>
            <Link href="/releases" passHref>
              <Button variant="ghost" size="sm">Manajemen Rilisan</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-grow container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Release Management Data Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <section id="latest-releases-section">
            <LatestReleases releases={releaseData} />
          </section>
          <section id="top-artists-section">
            <TopArtists releases={releaseData} />
          </section>
        </div>
        
        {/* CSV Importer and Distribution Data Sections */}
        <section id="csv-importer-section" className="mb-12 flex flex-col items-center">
          <CsvImporter onImport={handleCsvImport} isLoading={isLoadingCsv} />
          {distributionData.length > 0 && (
            <Button onClick={handleClearDistributionData} variant="outline" size="sm" className="mt-4">
              Hapus Data Impor CSV
            </Button>
          )}
        </section>

        {isLoadingCsv && (
          <div className="flex justify-center items-center py-10">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="ml-3 text-muted-foreground">Memuat data CSV...</p>
          </div>
        )}

        {!isLoadingCsv && distributionData.length === 0 && (
           <div className="text-center py-16 bg-card rounded-lg shadow-md mb-12">
            <FileSpreadsheet className="mx-auto h-16 w-16 text-primary opacity-50 mb-4" />
            <h2 className="text-2xl font-headline font-semibold mb-2">Selamat Datang di VortexTunes Digital</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Impor file CSV distribusi musik Anda untuk memulai. Lihat data Anda, analisis kinerja platform, dan dapatkan wawasan berbasis AI. Jika Anda sudah menambahkan rilisan, data rilisan terbaru dan artis teratas akan muncul di atas.
            </p>
          </div>
        )}

        {showDistributionDataSections && distributionData.length > 0 && (
          <>
            <section id="platform-summaries-section" className="mb-12">
              <PlatformSummaries data={distributionData} />
            </section>

            <section id="data-table-section" className="mb-12">
              <DataTable data={distributionData} />
            </section>

            <section id="revenue-insights-section" className="mb-12">
              <RevenueInsightsGenerator data={distributionData} />
            </section>
          </>
        )}
      </main>

      <footer className="py-6 border-t">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground">
          <p className="font-headline">&copy; {new Date().getFullYear()} VortexTunes Digital. All rights reserved.</p>
          <p className="mt-1">
            <ShieldAlert className="inline h-3 w-3 mr-1" />
            Wawasan pendapatan dihasilkan oleh AI dan disediakan hanya untuk tujuan informasi. Verifikasi informasi penting dan gunakan dengan risiko Anda sendiri.
          </p>
        </div>
      </footer>
    </div>
  );
}
