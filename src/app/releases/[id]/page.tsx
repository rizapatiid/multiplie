
"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { ArrowLeft, Music, FileAudio, CalendarDays, Tag, Key, ListChecks } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ReleaseEntry, ReleaseStatus } from '@/types';
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import VortexTunesLogo from '@/components/icons/VortexTunesLogo';

const LOCAL_STORAGE_KEY = 'trackStackReleases';

export default function ReleaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const releaseId = params.id as string;
  const [release, setRelease] = useState<ReleaseEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
    if (releaseId && typeof window !== 'undefined') {
      const storedReleases = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedReleases) {
        try {
          const parsedReleases: ReleaseEntry[] = JSON.parse(storedReleases).map((r: any) => ({
            ...r,
            tanggalTayang: new Date(r.tanggalTayang),
          }));
          const foundRelease = parsedReleases.find(r => r.idRilis === releaseId);
          setRelease(foundRelease || null);
        } catch (error) {
          console.error("Gagal memuat data rilisan dari localStorage", error);
        }
      }
    }
    setLoading(false);
  }, [releaseId]);

  const getStatusVariant = (status?: ReleaseStatus) => {
    switch (status) {
      case 'Upload':
        return 'default';
      case 'Pending':
        return 'secondary';
      case 'Rilis':
        return 'default'; 
      case 'Takedown':
        return 'destructive';
      default:
        return 'outline';
    }
  };
  
  const getStatusColorClass = (status?: ReleaseStatus) => {
    switch (status) {
      case 'Upload':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'Pending':
        return 'bg-yellow-500 hover:bg-yellow-600 text-black'; 
      case 'Rilis':
        return 'bg-green-500 hover:bg-green-600';
      case 'Takedown':
        return 'bg-red-500 hover:bg-red-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };


  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold font-headline tracking-tight text-primary">
              Detail Rilisan
            </h1>
            <div className="w-10"><ThemeToggleButton /></div>
          </div>
        </header>
        <main className="flex-grow container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-10 text-muted-foreground">Memuat detail rilisan...</div>
        </main>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
             <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-muted">
                <ArrowLeft className="h-5 w-5" />
             </Button>
            <h1 className="text-xl font-bold font-headline tracking-tight text-primary">
              Detail Rilisan
            </h1>
            <div className="w-10"><ThemeToggleButton /></div>
          </div>
        </header>
        <main className="flex-grow container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="shadow-lg dark:border-slate-700">
            <CardHeader>
              <CardTitle className="text-center text-destructive">Rilisan Tidak Ditemukan</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-6">
                Rilisan dengan ID "{releaseId}" tidak dapat ditemukan. Mungkin telah dihapus atau ID tidak valid.
              </p>
              <Button asChild variant="outline">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
       <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 text-center px-2">
              {release.judulRilisan ? (
                <h1 className="text-lg sm:text-xl font-bold font-headline tracking-tight text-primary truncate" title={release.judulRilisan}>
                  {release.judulRilisan}
                </h1>
              ) : (
                <VortexTunesLogo className="h-7 sm:h-8 w-auto inline-block" />
              )}
            </div>
           <div className="w-10"><ThemeToggleButton /></div>
        </div>
      </header>

      <main className="flex-grow container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="shadow-xl overflow-hidden dark:border-slate-700">
          <div className="relative w-full aspect-[2/1] sm:aspect-[3/1] md:aspect-[4/1] bg-muted">
            {release.coverArtUrl ? (
              <Image 
                src={release.coverArtUrl} 
                alt={`Cover art for ${release.judulRilisan}`} 
                fill
                className="object-cover"
                priority
                data-ai-hint="album cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Music className="w-16 h-16 text-muted-foreground" />
              </div>
            )}
             <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                <h2 className="text-2xl sm:text-3xl font-bold text-white shadow-lg truncate" title={release.judulRilisan}>
                  {release.judulRilisan}
                </h2>
                <p className="text-lg text-gray-200 shadow-md truncate" title={release.artist}>{release.artist}</p>
              </div>
          </div>
          
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <div className="flex items-center space-x-3">
                <Key className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">ID Rilis</p>
                  <p className="font-medium text-foreground">{release.idRilis}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <ListChecks className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                   <Badge variant={getStatusVariant(release.status)} className={`text-sm ${getStatusColorClass(release.status)} ${release.status === 'Pending' ? 'text-black' : 'text-white'}`}>
                    {release.status}
                  </Badge>
                </div>
              </div>
              
              {release.upc && (
                <div className="flex items-center space-x-3">
                  <Tag className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">UPC</p>
                    <p className="font-medium break-all text-foreground">{release.upc}</p>
                  </div>
                </div>
              )}

              {release.isrc && (
                <div className="flex items-center space-x-3">
                  <Tag className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">ISRC</p>
                    <p className="font-medium break-all text-foreground">{release.isrc}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <CalendarDays className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Tanggal Tayang</p>
                  <p className="font-medium text-foreground">{format(new Date(release.tanggalTayang), "dd MMMM yyyy")}</p>
                </div>
              </div>

              {release.audioFileName && (
                <div className="flex items-center space-x-3 sm:col-span-2">
                  <FileAudio className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">File Audio</p>
                    <p className="font-medium truncate text-foreground" title={release.audioFileName}>{release.audioFileName}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="pt-6 text-center">
              <Button asChild variant="outline" size="lg">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke Daftar Rilisan
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <footer className="py-6 border-t">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground">
          <p className="font-headline">
             &copy; {currentYear !== null ? currentYear : new Date().getFullYear()} VortexTunes. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
