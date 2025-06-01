
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { PlusCircle, Search, Trash2, Music, Edit, Loader2, AlertTriangle } from 'lucide-react';
import type { ReleaseEntry, ReleaseStatus } from '@/types';
import { ReleaseForm, type ReleaseFormValues } from '@/components/releases/release-form';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggleButton } from '@/components/theme-toggle-button';
import VortexTunesLogo from '@/components/icons/VortexTunesLogo';
import { getReleases, deleteRelease, addRelease, updateRelease } from '@/actions/releaseActions';

export default function ReleasesPage() {
  const [releases, setReleases] = useState<ReleaseEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<ReleaseEntry | null>(null);
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
    fetchReleases();
  }, []);

  const fetchReleases = async () => {
    setIsLoading(true);
    setLoadingError(null);
    try {
      console.log("[ReleasesPage] Calling getReleases action...");
      const data = await getReleases();
      console.log("[ReleasesPage] getReleases returned:", data);
      setReleases(data);
    } catch (error: any) {
      console.error("[ReleasesPage] Gagal memuat data rilisan:", error);
      const errorMessage = error.message || "Gagal memuat data rilisan dari server. Periksa koneksi dan konfigurasi.";
      setLoadingError(errorMessage);
      toast({ title: "Error Memuat Data", description: errorMessage, variant: "destructive" });
      setReleases([]); 
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (formData: FormData) => {
    setIsLoading(true);
    // Optimistic: clear previous form submission errors
    // setLoadingError(null); // Or handle form-specific errors differently
    try {
      let result;
      if (editingRelease && editingRelease.idRilis) {
        result = await updateRelease(editingRelease.idRilis, formData);
      } else {
        result = await addRelease(formData);
      }

      if ('error' in result) {
        toast({ title: "Gagal", description: result.error, variant: "destructive" });
      } else {
        toast({ 
          title: editingRelease ? "Rilisan Diperbarui" : "Rilisan Ditambahkan", 
          description: `Rilisan "${result.judulRilisan}" telah berhasil ${editingRelease ? 'diperbarui' : 'ditambahkan'}.` 
        });
        setEditingRelease(null);
        setIsAddDialogOpen(false);
        fetchReleases(); 
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Terjadi kesalahan pada server.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRelease = async (idRilis: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus rilisan ini?")) return;
    setIsLoading(true);
    try {
      const result = await deleteRelease(idRilis);
      if (result.success) {
        toast({ title: "Rilisan Dihapus", description: "Rilisan telah berhasil dihapus.", variant: "destructive" });
        fetchReleases(); 
      } else {
        toast({ title: "Gagal", description: result.error || "Gagal menghapus rilisan.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Terjadi kesalahan saat menghapus.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditDialog = (release: ReleaseEntry) => {
    setEditingRelease(release);
    setIsAddDialogOpen(true);
  };

  const handleOpenAddDialog = () => {
    setEditingRelease(null);
    setIsAddDialogOpen(true);
  };

  const filteredReleases = useMemo(() => {
    return releases.filter(release =>
      (release.judulRilisan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (release.artist || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
      const dateA = a.tanggalTayang ? new Date(a.tanggalTayang).getTime() : 0;
      const dateB = b.tanggalTayang ? new Date(b.tanggalTayang).getTime() : 0;
      const dateComparison = dateB - dateA;
      if (dateComparison !== 0) return dateComparison;
      return (b.idRilis || "").localeCompare(a.idRilis || "");
    });
  }, [releases, searchTerm]);

  const getStatusColor = (status?: ReleaseStatus) => {
    switch (status) {
      case 'Upload':
        return 'bg-blue-500 text-white';
      case 'Pending':
        return 'bg-yellow-500 text-black';
      case 'Rilis':
        return 'bg-green-500 text-white';
      case 'Takedown':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center">
            <VortexTunesLogo className="h-7 sm:h-8 w-auto" fallbackText="VortexTunes Digital" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari rilisan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-40 sm:w-64 h-9 text-sm"
              />
            </div>
            <ThemeToggleButton />
          </div>
        </div>
      </header>

      <main className="flex-grow container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading && (
          <div className="text-center py-16">
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Memuat data rilisan...</p>
            <p className="text-xs text-muted-foreground mt-2">Pastikan server memiliki koneksi dan izin ke Google Sheets.</p>
          </div>
        )}

        {!isLoading && loadingError && (
          <div className="text-center py-16 bg-destructive/10 p-6 rounded-lg">
            <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-destructive">Gagal Memuat Rilisan</h3>
            <p className="text-destructive/80 mb-1">Terjadi kesalahan saat mencoba mengambil data dari Google Sheets.</p>
            <p className="text-xs text-muted-foreground bg-background/50 p-2 rounded inline-block">Detail: {loadingError}</p>
            <p className="text-sm text-muted-foreground mt-4">
              Mohon periksa koneksi internet Anda, konfigurasi variabel lingkungan (terutama `GOOGLE_SPREADSHEET_ID`),
              dan pastikan aplikasi memiliki izin yang benar untuk mengakses spreadsheet.
              Cek juga log di konsol server untuk detail teknis.
            </p>
            <Button onClick={fetchReleases} variant="outline" className="mt-6">
              Coba Lagi
            </Button>
          </div>
        )}
        
        {!isLoading && !loadingError && filteredReleases.length === 0 && (
           <div className="text-center py-16">
            <Music className="mx-auto h-16 w-16 text-primary opacity-50 mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-foreground">Tidak Ada Rilisan</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Tidak ada rilisan yang cocok dengan pencarian Anda." : 
              (releases.length === 0 ? "Belum ada rilisan di spreadsheet atau data tidak dapat diparsing. Klik tombol '+' untuk memulai atau periksa spreadsheet." : "Belum ada rilisan yang ditambahkan. Klik tombol '+' untuk memulai.")}
            </p>
             {releases.length === 0 && !searchTerm && <p className="text-xs text-muted-foreground mt-2">Pastikan sheet 'Releases' di Google Sheets Anda tidak kosong dan datanya sesuai format.</p>}
          </div>
        )}
        
        {!isLoading && !loadingError && filteredReleases.length > 0 && (
          <div className="flex flex-col gap-4">
            {filteredReleases.map((release) => (
              <Card key={release.idRilis} className="w-full overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200 dark:border-slate-700">
                <div className="flex flex-row items-stretch">
                  <Link 
                    href={`/releases/${release.idRilis}`} 
                    className="flex-grow p-3 block hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring rounded-l-lg"
                  >
                    <div className="flex flex-row items-center gap-3 h-full">
                      <div className="w-20 h-20 flex-shrink-0 relative aspect-square">
                        {release.coverArtUrl ? (
                          <Image src={release.coverArtUrl} alt={release.judulRilisan || 'Cover Art'} fill className="rounded-md object-cover" data-ai-hint="album cover" unoptimized={release.coverArtUrl.includes('drive.google.com')} />
                        ) : (
                           <Image src="https://placehold.co/80x80.png" alt="Placeholder" fill className="rounded-md object-cover" data-ai-hint="album cover"/>
                        )}
                      </div>
                      <div className="flex-1 space-y-0.5 min-w-0">
                        <p className="text-xs text-muted-foreground truncate" title={release.idRilis}>ID: {release.idRilis}</p>
                        <h3 className="text-base font-semibold leading-tight truncate text-foreground" title={release.judulRilisan}>
                          {release.judulRilisan || "Tanpa Judul"}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate" title={release.artist}>
                          {release.artist || "Tanpa Artis"}
                        </p>
                        <p className="text-xs mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(release.status)}`}>
                            {release.status || "Unknown"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-col items-center justify-center gap-2 p-3 border-l bg-muted/25 dark:bg-slate-800/50 dark:border-slate-700 rounded-r-lg">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleOpenEditDialog(release)}
                      className="px-3 h-9"
                      disabled={isLoading} // Bisa juga dikontrol oleh status loading form individual
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      onClick={() => handleDeleteRelease(release.idRilis)}
                      className="h-9 w-9"
                      disabled={isLoading} // Bisa juga dikontrol oleh status loading form individual
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) setEditingRelease(null);
      }}>
        <DialogTrigger asChild>
          <Button
            onClick={handleOpenAddDialog}
            variant="default"
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center p-0"
            aria-label="Tambah Rilisan"
            disabled={isLoading && !releases.length} // Disable if initial load is happening
          >
            <PlusCircle className="h-7 w-7" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRelease ? "Edit Rilisan" : "Tambah Rilisan Baru"}</DialogTitle>
          </DialogHeader>
          <ReleaseForm
            onSubmitAction={handleFormSubmit}
            initialData={editingRelease || undefined}
            onCancel={() => {
              setIsAddDialogOpen(false);
              setEditingRelease(null);
            }}
            isSubmitting={isLoading} // Ini bisa diganti dengan state loading spesifik untuk form
          />
        </DialogContent>
      </Dialog>

       <footer className="py-6 border-t">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground">
          <p className="font-headline">
            &copy; {currentYear !== null ? currentYear : new Date().getFullYear()} VortexTunes. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

