
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Search, Trash2, Music, FileAudio } from 'lucide-react';
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
      // Fallback sort by date if IDs are not numeric (should not happen with new logic, but good for safety)
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
          <Link href="/" className="text-3xl font-bold font-headline tracking-tight text-primary">
            VortexTunes Digital
          </Link>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari rilisan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64 h-9"
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
          <div className="flex flex-col gap-6">
            {filteredReleases.map((release) => (
              <Card key={release.idRilis} className="w-full flex flex-col sm:flex-row">
                <CardHeader className="p-4 sm:p-6 flex-shrink-0 sm:w-1/4 flex flex-col sm:flex-row items-start gap-4">
                   <div className="w-full sm:w-auto flex-shrink-0 mb-2 sm:mb-0">
                    {release.coverArtUrl ? (
                      <Image src={release.coverArtUrl} alt={release.judulRilisan} width={80} height={80} className="rounded-md object-cover aspect-square mx-auto sm:mx-0" data-ai-hint="album cover" />
                    ) : (
                      <Image src="https://placehold.co/80x80.png" alt="Placeholder" width={80} height={80} className="rounded-md object-cover aspect-square mx-auto sm:mx-0" data-ai-hint="album cover" />
                    )}
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <CardTitle className="text-base sm:text-lg leading-tight" title={release.judulRilisan}>{release.judulRilisan}</CardTitle>
                    <CardDescription className="text-sm">{release.artist}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 flex-grow space-y-1 text-sm">
                  <p><span className="font-medium">ID Rilis:</span> {release.idRilis}</p>
                  {release.upc && <p><span className="font-medium">UPC:</span> {release.upc}</p>}
                  {release.isrc && <p><span className="font-medium">ISRC:</span> {release.isrc}</p>}
                  <p><span className="font-medium">Tgl Tayang:</span> {format(new Date(release.tanggalTayang), "dd MMM yyyy")}</p>
                  <p><span className="font-medium">Status:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(release.status)}`}>{release.status}</span></p>
                  {release.audioFileName && (
                    <p className="flex items-center text-muted-foreground text-xs truncate">
                      <FileAudio className="mr-1.5 h-3 w-3 flex-shrink-0" />
                      <span className="font-medium mr-1">Audio:</span> 
                      <span className="truncate" title={release.audioFileName}>{release.audioFileName}</span>
                    </p>
                  )}
                </CardContent>
                <CardFooter className="p-4 sm:p-6 flex flex-row sm:flex-col justify-end sm:justify-center items-center gap-2 border-t sm:border-t-0 sm:border-l">
                  <Button variant="outline" size="sm" onClick={() => handleOpenEditDialog(release)} className="w-full sm:w-auto">Edit</Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteRelease(release.idRilis)} className="w-full sm:w-auto">
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                </CardFooter>
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

    