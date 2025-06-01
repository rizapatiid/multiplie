
"use client";

import React, { useMemo } from 'react';
import type { ReleaseEntry } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Award } from 'lucide-react';

interface TopArtistsProps {
  releases: ReleaseEntry[];
}

interface ArtistReleaseCount {
  artist: string;
  count: number;
}

export function TopArtists({ releases }: TopArtistsProps) {
  const topArtists = useMemo(() => {
    if (!releases || releases.length === 0) {
      return [];
    }

    const artistCounts: Record<string, number> = {};
    releases.forEach(release => {
      artistCounts[release.artist] = (artistCounts[release.artist] || 0) + 1;
    });

    return Object.entries(artistCounts)
      .map(([artist, count]) => ({ artist, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Display top 10 artists
  }, [releases]);

  if (!releases || releases.length === 0) {
    return (
       <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <Users className="mr-2 h-6 w-6 text-primary" />
            Artis Teratas
          </CardTitle>
          <CardDescription>Artis dengan jumlah rilisan terbanyak.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Belum ada data rilisan untuk menampilkan artis teratas.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline flex items-center">
          <Users className="mr-2 h-6 w-6 text-primary" />
          Artis Teratas (Berdasarkan Jumlah Rilisan)
        </CardTitle>
        <CardDescription>Artis dengan jumlah rilisan terbanyak (hingga 10 teratas).</CardDescription>
      </CardHeader>
      <CardContent>
        {topArtists.length === 0 ? (
           <p className="text-muted-foreground text-center py-4">Tidak ada data artis untuk ditampilkan.</p>
        ) : (
          <ul className="space-y-3">
            {topArtists.map((artistData, index) => (
              <li key={artistData.artist} className="flex items-center justify-between p-3 bg-secondary/30 rounded-md shadow-sm hover:bg-secondary/60 transition-colors">
                <div className="flex items-center">
                  {index < 3 && <Award className={`h-5 w-5 mr-3 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-orange-400'}`} />}
                  {index >=3 && <span className="mr-3 text-sm font-medium text-muted-foreground w-5 text-center">{index+1}.</span>}
                  <div>
                    <p className="font-semibold text-sm">{artistData.artist}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{artistData.count} rilisan</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
