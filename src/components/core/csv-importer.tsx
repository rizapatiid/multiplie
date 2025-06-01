"use client";

import type { ChangeEvent } from 'react';
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud, FileText } from 'lucide-react';
import type { DistributionDataEntry } from '@/types';

interface CsvImporterProps {
  onImport: (data: DistributionDataEntry[], error?: string) => void;
  isLoading: boolean;
}

export function CsvImporter({ onImport, isLoading }: CsvImporterProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          parseCsvData(text);
        } else {
          onImport([], 'Failed to read file content.');
        }
      };
      reader.onerror = () => {
        onImport([], 'Error reading file.');
      };
      reader.readAsText(file);
    } else {
      setFileName(null);
      onImport([]); // Clear data if no file selected
    }
  };

  const parseCsvData = (csvText: string) => {
    try {
      const lines = csvText.trim().split(/\r\n|\n/);
      if (lines.length < 2) {
        onImport([], 'CSV must have a header row and at least one data row.');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredHeaders = ['track name', 'artist name', 'platform', 'streams', 'revenue', 'date'];
      const missingHeaders = requiredHeaders.filter(rh => !headers.includes(rh));

      if (missingHeaders.length > 0) {
        onImport([], `Missing required CSV headers: ${missingHeaders.join(', ')}. Ensure headers are: Track Name, Artist Name, Platform, Streams, Revenue, Date.`);
        return;
      }
      
      const data = lines.slice(1).map((line, index) => {
        const values = line.split(',');
        const entry: Partial<DistributionDataEntry> = { id: `row-${index}` };
        headers.forEach((header, i) => {
          const value = values[i]?.trim() || '';
          switch(header) {
            case 'track name': entry.trackName = value; break;
            case 'artist name': entry.artistName = value; break;
            case 'platform': entry.platform = value; break;
            case 'streams': entry.streamCount = parseInt(value, 10) || 0; break;
            case 'revenue': entry.revenue = parseFloat(value) || 0; break;
            case 'date': entry.date = value; break; // Keep as string, or parse new Date(value).toISOString().split('T')[0]
            default: entry[header.replace(/\s+/g, '')] = value; // camelCase other headers
          }
        });
        if (!entry.trackName || !entry.platform) {
            throw new Error(`Row ${index + 1} is missing essential data (Track Name or Platform).`);
        }
        return entry as DistributionDataEntry;
      });

      onImport(data);
    } catch (error: any) {
      onImport([], `Error parsing CSV: ${error.message}. Please check file format and content.`);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-md p-6 space-y-4 bg-card rounded-lg shadow-md">
      <h2 className="text-xl font-headline font-semibold text-center">Import Music Data</h2>
      <Input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
        ref={fileInputRef}
        id="csv-upload"
      />
      <Button onClick={triggerFileInput} disabled={isLoading} className="w-full">
        <UploadCloud className="mr-2 h-5 w-5" />
        {isLoading ? 'Processing...' : 'Select CSV File'}
      </Button>
      {fileName && (
        <div className="flex items-center justify-center text-sm text-muted-foreground pt-2">
          <FileText className="mr-2 h-4 w-4" />
          <span>{fileName}</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground text-center">
        Required headers: Track Name, Artist Name, Platform, Streams, Revenue, Date.
      </p>
    </div>
  );
}
