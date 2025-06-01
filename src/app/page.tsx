
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CsvImporter } from '@/components/core/csv-importer';
import { DataTable } from '@/components/core/data-table';
import { PlatformSummaries } from '@/components/core/platform-summaries';
import { RevenueInsightsGenerator } from '@/components/core/revenue-insights-generator';
import type { DistributionDataEntry } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { FileSpreadsheet, ShieldAlert } from 'lucide-react';

export default function HomePage() {
  const [data, setData] = useState<DistributionDataEntry[]>([]);
  const [isLoadingCsv, setIsLoadingCsv] = useState(false);
  const { toast } = useToast();
  const [showDataSections, setShowDataSections] = useState(false);

  useEffect(() => {
    // Check if running on client before accessing localStorage
    if (typeof window !== 'undefined') {
      const storedData = localStorage.getItem('trackStackData');
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            setData(parsedData);
            setShowDataSections(true);
            toast({
              title: "Data Loaded",
              description: "Previously imported data has been loaded from local storage.",
            });
          }
        } catch (error) {
          console.error("Failed to parse data from localStorage", error);
          localStorage.removeItem('trackStackData');
        }
      }
    }
  }, [toast]);

  const handleCsvImport = (parsedData: DistributionDataEntry[], error?: string) => {
    setIsLoadingCsv(false);
    if (error) {
      toast({
        variant: "destructive",
        title: "CSV Import Error",
        description: error,
      });
      setData([]);
      setShowDataSections(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('trackStackData');
      }
    } else if (parsedData.length > 0) {
      setData(parsedData);
      setShowDataSections(true);
      toast({
        title: "CSV Imported Successfully",
        description: `Imported ${parsedData.length} records.`,
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('trackStackData', JSON.stringify(parsedData));
      }
    } else {
       toast({
        title: "No Data Imported",
        description: "The CSV file was empty or contained no valid data rows.",
      });
      setData([]);
      setShowDataSections(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('trackStackData');
      }
    }
  };
  
  const handleClearData = () => {
    setData([]);
    setShowDataSections(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trackStackData');
    }
    toast({
      title: "Data Cleared",
      description: "All imported data has been removed.",
    });
  };


  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-3xl font-bold font-headline tracking-tight text-primary">
            TrackStack
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
        <section id="csv-importer-section" className="mb-12 flex flex-col items-center">
          <CsvImporter onImport={handleCsvImport} isLoading={isLoadingCsv} />
          {data.length > 0 && (
            <Button onClick={handleClearData} variant="outline" size="sm" className="mt-4">
              Clear Imported Data
            </Button>
          )}
        </section>

        {isLoadingCsv && (
          <div className="flex justify-center items-center py-10">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="ml-3 text-muted-foreground">Loading CSV data...</p>
          </div>
        )}

        {!isLoadingCsv && data.length === 0 && (
           <div className="text-center py-16 bg-card rounded-lg shadow-md">
            <FileSpreadsheet className="mx-auto h-16 w-16 text-primary opacity-50 mb-4" />
            <h2 className="text-2xl font-headline font-semibold mb-2">Welcome to TrackStack</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Import your music distribution CSV file to get started. View your data, analyze platform performance, and get AI-powered insights.
            </p>
          </div>
        )}

        {showDataSections && data.length > 0 && (
          <>
            <section id="platform-summaries-section" className="mb-12">
              <PlatformSummaries data={data} />
            </section>

            <section id="data-table-section" className="mb-12">
              <DataTable data={data} />
            </section>

            <section id="revenue-insights-section" className="mb-12">
              <RevenueInsightsGenerator data={data} />
            </section>
          </>
        )}
      </main>

      <footer className="py-6 border-t">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground">
          <p className="font-headline">&copy; {new Date().getFullYear()} TrackStack. All rights reserved.</p>
          <p className="mt-1">
            <ShieldAlert className="inline h-3 w-3 mr-1" />
            Revenue insights are AI-generated and provided for informational purposes only. Verify critical information and use at your own risk.
          </p>
        </div>
      </footer>
    </div>
  );
}
