
"use client";

import React from 'react';
import type { ReleaseEntry } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { List, Music } from 'lucide-react';
import { format } from 'date-fns';

interface LatestReleasesProps {
  releases: ReleaseEntry[];
}

export function LatestReleases({ releases }: LatestReleasesProps) {
  if (!releases || releases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <List className="mr-2 h-6 w-6 text-primary" />
            Rilisan Terbaru
          </CardTitle>
          <CardDescription>10 rilisan yang baru saja atau akan segera tayang.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Belum ada data rilisan.</p>
        </CardContent>
      </Card>
    );
  }

  const sortedReleases = [...releases]
    .sort((a, b) => new Date(b.tanggalTayang).getTime() - new Date(a.tanggalTayang).getTime())
    .slice(0, 10);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline flex items-center">
          <List className="mr-2 h-6 w-6 text-primary" />
          Rilisan Terbaru (Top 10)
        </CardTitle>
        <CardDescription>10 rilisan yang baru saja atau akan segera tayang.</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedReleases.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Tidak ada rilisan untuk ditampilkan.</p>
        ) : (
          <ul className="space-y-3">
            {sortedReleases.map((release) => (
              <li key={release.idRilis} className="flex items-center justify-between p-3 bg-secondary/30 rounded-md shadow-sm hover:bg-secondary/60 transition-colors">
                <div className="flex items-center">
                  <Music className="h-5 w-5 mr-3 text-primary opacity-70" />
                  <div>
                    <p className="font-semibold text-sm">{release.judulRilisan}</p>
                    <p className="text-xs text-muted-foreground">{release.artist}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{format(new Date(release.tanggalTayang), "dd MMM yyyy")}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
