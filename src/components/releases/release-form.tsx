
"use client";

import React, { useEffect } from 'react';
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
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { ReleaseEntry, ReleaseStatus } from '@/types';
import { cn } from '@/lib/utils';

const releaseStatusOptions: ReleaseStatus[] = ["Pending", "Published", "Archived"];

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
});

export type ReleaseFormValues = z.infer<typeof releaseFormSchema>;

interface ReleaseFormProps {
  onSubmit: (data: ReleaseFormValues) => void;
  initialData?: Partial<ReleaseEntry>;
  onCancel: () => void;
}

export function ReleaseForm({ onSubmit, initialData, onCancel }: ReleaseFormProps) {
  const form = useForm<ReleaseFormValues>({
    resolver: zodResolver(releaseFormSchema),
    defaultValues: {
      judulRilisan: initialData?.judulRilisan || '',
      artist: initialData?.artist || '',
      upc: initialData?.upc || '',
      isrc: initialData?.isrc || '',
      tanggalTayang: initialData?.tanggalTayang ? new Date(initialData.tanggalTayang) : undefined,
      status: initialData?.status || undefined,
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
      });
    } else {
      form.reset({ // Reset to empty for new form
        judulRilisan: '',
        artist: '',
        upc: '',
        isrc: '',
        tanggalTayang: undefined,
        status: undefined,
      });
    }
  }, [initialData, form]);
  
  const idRilisDisplay = initialData?.idRilis || "Otomatis";

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
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
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
