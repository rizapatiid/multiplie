
"use client";

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CalendarIcon, FileAudio, ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { ReleaseEntry, ReleaseStatus } from '@/types';
import { cn } from '@/lib/utils';
import Image from 'next/image'; // Using next/image for placeholder

const releaseStatusOptions: ReleaseStatus[] = ["Upload", "Pending", "Rilis", "Takedown"];

const releaseFormSchema = z.object({
  judulRilisan: z.string().min(1, "Judul rilisan tidak boleh kosong"),
  artist: z.string().min(1, "Nama artis tidak boleh kosong"),
  upc: z.string().optional(),
  isrc: z.string().optional(),
  tanggalTayang: z.date({
    required_error: "Tanggal tayang harus diisi.",
  }),
  status: z.enum(releaseStatusOptions, {
    required_error: "Status harus dipilih.",
  }),
  coverArtUrl: z.string().optional(),
  audioFileName: z.string().optional(),
});

export type ReleaseFormValues = z.infer<typeof releaseFormSchema>;

interface ReleaseFormProps {
  onSubmit: (data: ReleaseFormValues) => void;
  initialData?: Partial<ReleaseEntry>;
  onCancel: () => void;
}

export function ReleaseForm({ onSubmit, initialData, onCancel }: ReleaseFormProps) {
  const [coverArtPreview, setCoverArtPreview] = useState<string | null>(initialData?.coverArtUrl || null);
  const [selectedAudioFileName, setSelectedAudioFileName] = useState<string | null>(initialData?.audioFileName || null);

  const form = useForm<ReleaseFormValues>({
    resolver: zodResolver(releaseFormSchema),
    defaultValues: {
      judulRilisan: initialData?.judulRilisan || '',
      artist: initialData?.artist || '',
      upc: initialData?.upc || '',
      isrc: initialData?.isrc || '',
      tanggalTayang: initialData?.tanggalTayang ? new Date(initialData.tanggalTayang) : undefined,
      status: initialData?.status || undefined,
      coverArtUrl: initialData?.coverArtUrl || '',
      audioFileName: initialData?.audioFileName || '',
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        judulRilisan: initialData.judulRilisan || '',
        artist: initialData.artist || '',
        upc: initialData.upc || '',
        isrc: initialData.isrc || '',
        tanggalTayang: initialData.tanggalTayang ? new Date(initialData.tanggalTayang) : undefined,
        status: initialData.status || undefined,
        coverArtUrl: initialData.coverArtUrl || '',
        audioFileName: initialData.audioFileName || '',
      });
      setCoverArtPreview(initialData.coverArtUrl || null);
      setSelectedAudioFileName(initialData.audioFileName || null);
    } else {
      form.reset({ 
        judulRilisan: '',
        artist: '',
        upc: '',
        isrc: '',
        tanggalTayang: undefined,
        status: undefined,
        coverArtUrl: '',
        audioFileName: '',
      });
      setCoverArtPreview(null);
      setSelectedAudioFileName(null);
    }
  }, [initialData, form]);
  
  const idRilisDisplay = initialData?.idRilis || "Otomatis";

  const handleCoverArtChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setCoverArtPreview(result);
        form.setValue('coverArtUrl', result);
      };
      reader.readAsDataURL(file);
    } else {
      setCoverArtPreview(null);
      form.setValue('coverArtUrl', '');
    }
  };

  const handleAudioFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedAudioFileName(file.name);
      form.setValue('audioFileName', file.name);
    } else {
      setSelectedAudioFileName(null);
      form.setValue('audioFileName', '');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {initialData && (
          <div className="space-y-2">
            <Label htmlFor="idRilis">ID Rilis</Label>
            <Input id="idRilis" value={idRilisDisplay} disabled className="bg-muted/50" />
          </div>
        )}

        <FormField
          control={form.control}
          name="judulRilisan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Judul Rilisan</FormLabel>
              <FormControl>
                <Input placeholder="Masukkan judul rilisan" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="artist"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Artis</FormLabel>
              <FormControl>
                <Input placeholder="Masukkan nama artis" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="upc"
            render={({ field }) => (
              <FormItem>
                <FormLabel>UPC</FormLabel>
                <FormControl>
                  <Input placeholder="Masukkan UPC (opsional)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isrc"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ISRC</FormLabel>
                <FormControl>
                  <Input placeholder="Masukkan ISRC (opsional)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="tanggalTayang"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Tanggal Tayang</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span>Pilih tanggal</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih status rilisan" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {releaseStatusOptions.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel htmlFor="coverArt">Gambar Sampul (Cover Art)</FormLabel>
          <Input id="coverArt" type="file" accept="image/*" onChange={handleCoverArtChange} className="h-auto p-2"/>
          {coverArtPreview && (
            <div className="mt-2">
              <Image src={coverArtPreview} alt="Cover art preview" width={100} height={100} className="rounded-md object-cover" data-ai-hint="album cover" />
            </div>
          )}
          {!coverArtPreview && (
             <div className="mt-2 w-[100px] h-[100px] bg-muted rounded-md flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
             </div>
          )}
          <FormMessage>{form.formState.errors.coverArtUrl?.message}</FormMessage>
        </FormItem>

        <FormItem>
          <FormLabel htmlFor="audioFile">File Audio</FormLabel>
          <Input id="audioFile" type="file" accept="audio/*" onChange={handleAudioFileChange} className="h-auto p-2" />
          {selectedAudioFileName && (
            <p className="text-sm text-muted-foreground mt-2 flex items-center">
              <FileAudio className="mr-2 h-4 w-4" /> {selectedAudioFileName}
            </p>
          )}
          <FormMessage>{form.formState.errors.audioFileName?.message}</FormMessage>
        </FormItem>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Batal
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Menyimpan..." : (initialData ? "Simpan Perubahan" : "Tambah Rilisan")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
