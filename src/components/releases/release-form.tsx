
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { CalendarIcon, FileAudio, ImageIcon, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { ReleaseEntry, ReleaseStatus, ReleaseFormValues as ReleaseFormSchemaTypes } from '@/types';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const releaseStatusOptions: ReleaseStatus[] = ["Upload", "Pending", "Rilis", "Takedown"];

// Skema Zod untuk validasi form di sisi klien
// Tidak lagi menyertakan coverArtFile dan audioFile karena akan ditangani sebagai File object
const clientReleaseFormSchema = z.object({
  idRilis: z.string().optional(),
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
  coverArtUrl: z.string().optional(), // Menyimpan URL yang sudah ada atau preview
  audioFileName: z.string().optional(), // Menyimpan nama file yang sudah ada
});

// Type untuk nilai form yang digunakan oleh react-hook-form
type ClientFormValues = z.infer<typeof clientReleaseFormSchema>;

interface ReleaseFormProps {
  onSubmitAction: (formData: FormData) => Promise<any>; // Menerima FormData
  initialData?: Partial<ReleaseEntry>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ReleaseForm({ onSubmitAction, initialData, onCancel, isSubmitting }: ReleaseFormProps) {
  const [coverArtPreview, setCoverArtPreview] = useState<string | null>(initialData?.coverArtUrl || null);
  const [selectedAudioFileName, setSelectedAudioFileName] = useState<string | null>(initialData?.audioFileName || null);
  
  const coverArtFileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientReleaseFormSchema),
    defaultValues: {
      idRilis: initialData?.idRilis || '',
      judulRilisan: initialData?.judulRilisan || '',
      artist: initialData?.artist || '',
      upc: initialData?.upc || '',
      isrc: initialData?.isrc || '',
      tanggalTayang: initialData?.tanggalTayang ? new Date(initialData.tanggalTayang) : new Date(),
      status: initialData?.status || "Pending",
      coverArtUrl: initialData?.coverArtUrl || '',
      audioFileName: initialData?.audioFileName || '',
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        idRilis: initialData.idRilis || '',
        judulRilisan: initialData.judulRilisan || '',
        artist: initialData.artist || '',
        upc: initialData.upc || '',
        isrc: initialData.isrc || '',
        tanggalTayang: initialData.tanggalTayang ? new Date(initialData.tanggalTayang) : new Date(),
        status: initialData.status || "Pending",
        coverArtUrl: initialData.coverArtUrl || '',
        audioFileName: initialData.audioFileName || '',
      });
      setCoverArtPreview(initialData.coverArtUrl || null);
      setSelectedAudioFileName(initialData.audioFileName || null);
    } else {
      form.reset({
        idRilis: '',
        judulRilisan: '',
        artist: '',
        upc: '',
        isrc: '',
        tanggalTayang: new Date(),
        status: "Pending",
        coverArtUrl: '',
        audioFileName: '',
      });
      setCoverArtPreview(null);
      setSelectedAudioFileName(null);
    }
  }, [initialData, form]);
  
  const idRilisDisplay = initialData?.idRilis || "Otomatis (dari Server)";

  const handleCoverArtChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverArtPreview(reader.result as string);
        form.setValue('coverArtUrl', reader.result as string); // Untuk preview
      };
      reader.readAsDataURL(file);
    } else {
      setCoverArtPreview(initialData?.coverArtUrl || null); // Kembali ke URL awal jika batal pilih
      form.setValue('coverArtUrl', initialData?.coverArtUrl || '');
    }
  };

  const handleAudioFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedAudioFileName(file.name);
      form.setValue('audioFileName', file.name); // Untuk tampilan nama file
    } else {
      setSelectedAudioFileName(initialData?.audioFileName || null);
      form.setValue('audioFileName', initialData?.audioFileName || '');
    }
  };

  const handleSubmit = async (values: ClientFormValues) => {
    const formData = new FormData();
    
    // Append all form fields
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'tanggalTayang' && value instanceof Date) {
        formData.append(key, value.toISOString());
      } else if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    // Append files if selected
    if (coverArtFileRef.current?.files?.[0]) {
      formData.append('coverArtFile', coverArtFileRef.current.files[0]);
    } else if (!values.coverArtUrl && initialData?.coverArtUrl) {
      // Jika URL cover art dihapus (preview jadi null) dan ada URL awal,
      // ini bisa diartikan sebagai permintaan menghapus gambar.
      // Server action perlu menangani ini (misalnya, dengan mengirim flag khusus)
      // Untuk saat ini, jika tidak ada file baru, server action akan menggunakan yang lama jika ada.
    }
     if (initialData?.coverArtUrl) {
      formData.append('existingCoverArtUrl', initialData.coverArtUrl);
    }


    if (audioFileRef.current?.files?.[0]) {
      formData.append('audioFile', audioFileRef.current.files[0]);
    }
     if (initialData?.audioFileName) {
      formData.append('existingAudioFileName', initialData.audioFileName);
    }


    await onSubmitAction(formData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {initialData?.idRilis && (
          <div className="space-y-2">
            <Label htmlFor="idRilisDisplay">ID Rilis</Label>
            <Input id="idRilisDisplay" value={idRilisDisplay} disabled className="bg-muted/50" />
            {/* Hidden input untuk mengirim idRilis yang sebenarnya */}
            <input type="hidden" {...form.register("idRilis")} />
          </div>
        )}

        <FormField
          control={form.control}
          name="judulRilisan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Judul Rilisan</FormLabel>
              <FormControl>
                <Input placeholder="Masukkan judul rilisan" {...field} disabled={isSubmitting} />
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
                <Input placeholder="Masukkan nama artis" {...field} disabled={isSubmitting} />
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
                  <Input placeholder="Masukkan UPC (opsional)" {...field} value={field.value || ''} disabled={isSubmitting} />
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
                  <Input placeholder="Masukkan ISRC (opsional)" {...field} value={field.value || ''} disabled={isSubmitting} />
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
                      disabled={isSubmitting}
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
                    disabled={isSubmitting || ((date) => date < new Date("1900-01-01"))}
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
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
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
          <FormLabel htmlFor="coverArtFile">Gambar Sampul (Cover Art)</FormLabel>
          <Input id="coverArtFile" type="file" accept="image/*" onChange={handleCoverArtChange} className="h-auto p-2" ref={coverArtFileRef} disabled={isSubmitting}/>
          {coverArtPreview ? (
            <div className="mt-2">
              <Image 
                src={coverArtPreview} 
                alt="Cover art preview" 
                width={100} 
                height={100} 
                className="rounded-md object-cover" 
                data-ai-hint="album cover" 
                unoptimized={coverArtPreview.includes('drive.google.com') || coverArtPreview.startsWith('blob:')}
              />
            </div>
          ) : (
             <div className="mt-2 w-[100px] h-[100px] bg-muted rounded-md flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
             </div>
          )}
          {/* <FormMessage>{form.formState.errors.coverArtFile?.message}</FormMessage> */}
        </FormItem>

        <FormItem>
          <FormLabel htmlFor="audioFile">File Audio</FormLabel>
          <Input id="audioFile" type="file" accept="audio/*" onChange={handleAudioFileChange} className="h-auto p-2" ref={audioFileRef} disabled={isSubmitting}/>
          {selectedAudioFileName && (
            <p className="text-sm text-muted-foreground mt-2 flex items-center">
              <FileAudio className="mr-2 h-4 w-4" /> {selectedAudioFileName}
            </p>
          )}
           {/* <FormMessage>{form.formState.errors.audioFile?.message}</FormMessage> */}
        </FormItem>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan...</> : (initialData?.idRilis ? "Simpan Perubahan" : "Tambah Rilisan")}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Export type for external use if needed
export type { ClientFormValues as ReleaseFormValues };
