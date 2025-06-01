
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { PlusCircle, Search, Trash2, Music, FileAudio, Edit } from 'lucide-react';
import type { ReleaseEntry, ReleaseStatus } from '@/types';
import { ReleaseForm, type ReleaseFormValues } from '@/components/releases/release-form';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format } from 'date-fns';
import Image from 'next/image';

const LOCAL_STORAGE_KEY = 'trackStackReleases';

export default function ReleasesPage() {
  const [releases, setReleases] = useState<ReleaseEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingRelease, setEditingRelease] = useState<ReleaseEntry | null>(null);
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedReleases = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedReleases) {
        try {
          const parsedReleases = JSON.parse(storedReleases).map((r: any) => ({
            ...r,
            tanggalTayang: new Date(r.tanggalTayang),
          }));
          setReleases(parsedReleases);
        } catch (error) {
          console.error("Gagal memuat data rilisan dari localStorage", error);
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(releases));
    }
  }, [releases]);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  const handleAddRelease = (data: ReleaseFormValues) => {
    if (editingRelease) {
      setReleases(prevReleases =>
        prevReleases.map(r => r.idRilis === editingRelease.idRilis ? { ...editingRelease, ...data, tanggalTayang: new Date(data.tanggalTayang) } : r)
      );
      toast({ title: "Rilisan Diperbarui", description: `Rilisan "${data.judulRilisan}" telah berhasil diperbarui.` });
      setEditingRelease(null);
    } else {
      let newIdRilis: string;
      if (releases.length === 0) {
        newIdRilis = '1';
      } else {
        const numericIds = releases
          .map(r => parseInt(r.idRilis, 10))
          .filter(id => !isNaN(id));

        if (numericIds.length === 0) {
          newIdRilis = '1';
        } else {
          newIdRilis = (Math.max(0, ...numericIds) + 1).toString();
        }
      }

      const newRelease: ReleaseEntry = {
        ...data,
        idRilis: newIdRilis,
        tanggalTayang: new Date(data.tanggalTayang),
      };
      setReleases(prevReleases => [newRelease, ...prevReleases]);
      toast({ title: "Rilisan Ditambahkan", description: `Rilisan "${data.judulRilisan}" telah berhasil ditambahkan.` });
    }
    setIsAddDialogOpen(false);
  };

  const handleDeleteRelease = (idRilis: string) => {
    setReleases(prevReleases => prevReleases.filter(r => r.idRilis !== idRilis));
    toast({ title: "Rilisan Dihapus", description: "Rilisan telah berhasil dihapus.", variant: "destructive" });
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
      release.judulRilisan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      release.artist.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => {
      const idA = parseInt(a.idRilis, 10);
      const idB = parseInt(b.idRilis, 10);
      if (!isNaN(idA) && !isNaN(idB)) {
        return idB - idA;
      }
      if (!isNaN(idA)) return -1;
      if (!isNaN(idB)) return 1;
      return new Date(b.tanggalTayang).getTime() - new Date(a.tanggalTayang).getTime();
    });
  }, [releases, searchTerm]);

  const getStatusColor = (status: ReleaseStatus) => {
    switch (status) {
      case 'Upload':
        return 'bg-blue-100 text-blue-700';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'Rilis':
        return 'bg-green-100 text-green-700';
      case 'Takedown':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-xl sm:text-2xl font-bold font-headline tracking-tight text-primary">
            VortexTunes Digital
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
          </div>
        </div>
      </header>

      <main className="flex-grow container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <h2 className="text-2xl font-bold font-headline">Manajemen Rilisan</h2>
        </div>

        {filteredReleases.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-lg shadow-md">
            <Music className="mx-auto h-16 w-16 text-primary opacity-50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Tidak Ada Rilisan</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Tidak ada rilisan yang cocok dengan pencarian Anda." : "Belum ada rilisan yang ditambahkan. Klik tombol '+' untuk memulai."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredReleases.map((release) => (
              <Card key={release.idRilis} className="w-full overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex flex-col sm:flex-row">
                  <Link href={`/releases/${release.idRilis}`} className="flex-grow p-4 block hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring rounded-t-lg sm:rounded-l-lg sm:rounded-tr-none">
                    <div className="flex flex-col sm:flex-row items-start gap-4 w-full">
                      <div className="w-full sm:w-20 h-auto sm:h-20 flex-shrink-0 relative aspect-square">
                        {release.coverArtUrl ? (
                          <Image src={release.coverArtUrl} alt={release.judulRilisan} fill className="rounded-md object-cover" data-ai-hint="album cover" />
                        ) : (
                          <Image src="https://placehold.co/80x80.png" alt="Placeholder" fill className="rounded-md object-cover" data-ai-hint="album cover" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1 min-w-0 mt-2 sm:mt-0">
                        <p className="text-xs text-muted-foreground truncate" title={release.idRilis}>ID: {release.idRilis}</p>
                        <h3 className="text-base sm:text-lg font-semibold leading-tight truncate" title={release.judulRilisan}>
                          {release.judulRilisan}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate" title={release.artist}>
                          {release.artist}
                        </p>
                        <p className="text-sm mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(release.status)}`}>
                            {release.status}
                          </span>
                        </p>
                      </div>
                    </div>
                  </Link>
                  <div className="p-3 sm:p-4 border-t sm:border-t-0 sm:border-l flex flex-row sm:flex-col items-center justify-end sm:justify-center gap-2 bg-muted/20 rounded-b-lg sm:rounded-r-lg sm:rounded-bl-none">
                    <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(release)} className="h-8 px-3 text-xs sm:text-sm">
                      <Edit className="h-3 w-3 sm:mr-1" /> <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteRelease(release.idRilis)} className="h-8 px-3">
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
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
          >
            <PlusCircle className="h-7 w-7" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRelease ? "Edit Rilisan" : "Tambah Rilisan Baru"}</DialogTitle>
          </DialogHeader>
          <ReleaseForm
            onSubmit={handleAddRelease}
            initialData={editingRelease || undefined}
            onCancel={() => {
              setIsAddDialogOpen(false);
              setEditingRelease(null);
            }}
          />
        </DialogContent>
      </Dialog>

       <footer className="py-6 border-t">
        <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground">
          <p className="font-headline">
            &copy; {currentYear !== null ? currentYear : new Date().getFullYear()} VortexTunes Digital. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
    
