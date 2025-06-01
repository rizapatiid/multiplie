
'use server';

import { revalidatePath } from 'next/cache';
import { getSheetsClient, getDriveClient } from '@/lib/google-clients';
import type { ReleaseEntry, ReleaseFormValues } from '@/types';
import { format, parseISO } from 'date-fns';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = 'Releases'; // Sesuaikan dengan nama sheet Anda
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Helper function to map spreadsheet rows to ReleaseEntry
// Anda perlu menyesuaikan ini berdasarkan urutan kolom di spreadsheet Anda
function mapRowToReleaseEntry(row: any[], id: string | number): ReleaseEntry {
  // Asumsi urutan kolom: Judul, Artis, UPC, ISRC, TanggalTayang (YYYY-MM-DD), Status, CoverArtID, AudioFileID, OriginalID (dari spreadsheet, jika ada)
  return {
    idRilis: id.toString(), // Menggunakan row index + 2 sebagai ID sementara jika tidak ada ID khusus
    judulRilisan: row[0] || '',
    artist: row[1] || '',
    upc: row[2] || '',
    isrc: row[3] || '',
    tanggalTayang: row[4] ? parseISO(row[4]) : new Date(),
    status: row[5] || 'Pending',
    coverArtUrl: row[6] ? `https://drive.google.com/uc?id=${row[6]}` : undefined, // Tautan langsung ke file Drive
    audioFileName: row[7] ? `File ID: ${row[7]}` : undefined, // Atau nama file asli jika Anda menyimpannya
    // idInternalSpreadsheet: row[8] || null // jika Anda punya kolom ID unik di spreadsheet
  };
}


export async function getReleases(): Promise<ReleaseEntry[]> {
  if (!SPREADSHEET_ID) throw new Error("SPREADSHEET_ID is not configured.");
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:I`, // Asumsi data mulai dari baris 2, kolom A sampai I
    });

    const rows = response.data.values;
    if (rows && rows.length) {
      return rows.map((row, index) => mapRowToReleaseEntry(row, row[8] || (index + 2).toString() )); // Gunakan ID dari spreadsheet jika ada, atau row index
    }
    return [];
  } catch (error) {
    console.error('Error fetching releases from Google Sheets:', error);
    // Mengembalikan array kosong atau throw error tergantung kebutuhan
    // Untuk UI yang lebih baik, mungkin lebih baik mengembalikan array kosong dan menampilkan pesan error di UI
    return []; 
  }
}

export async function getReleaseById(idRilis: string): Promise<ReleaseEntry | null> {
  if (!SPREADSHEET_ID) throw new Error("SPREADSHEET_ID is not configured.");
  // Ini akan lebih kompleks. Anda mungkin perlu membaca semua baris dan mencari
  // atau jika Anda memiliki kolom ID unik di spreadsheet, Anda bisa mencoba memfilter.
  // Untuk kesederhanaan, kita fetch semua dan filter di sini.
  // Dalam aplikasi nyata, pertimbangkan cara yang lebih efisien jika datanya besar.
  try {
    const releases = await getReleases(); // Memanfaatkan fungsi yang sudah ada
    const release = releases.find(r => r.idRilis === idRilis);
    return release || null;
  } catch (error) {
    console.error(`Error fetching release by ID ${idRilis}:`, error);
    return null;
  }
}

async function uploadFileToDrive(file: File, fileName: string): Promise<string | null> {
  if (!DRIVE_FOLDER_ID) throw new Error("DRIVE_FOLDER_ID is not configured.");
  try {
    const drive = await getDriveClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [DRIVE_FOLDER_ID],
      },
      media: {
        mimeType: file.type,
        body: require('stream').Readable.from(buffer), // Convert Buffer to ReadableStream
      },
      fields: 'id',
    });
    return response.data.id || null;
  } catch (error) {
    console.error('Error uploading file to Google Drive:', error);
    return null;
  }
}

export async function addRelease(formData: FormData): Promise<ReleaseEntry | { error: string }> {
  if (!SPREADSHEET_ID) return { error: "SPREADSHEET_ID is not configured." };

  const rawData = Object.fromEntries(formData.entries());
  
  const coverArtFile = formData.get('coverArtFile') as File | null;
  const audioFile = formData.get('audioFile') as File | null;

  let coverArtFileId: string | null = null;
  let audioFileId: string | null = null;

  try {
    if (coverArtFile && coverArtFile.size > 0) {
      coverArtFileId = await uploadFileToDrive(coverArtFile, `cover_${Date.now()}_${coverArtFile.name}`);
    }
    if (audioFile && audioFile.size > 0) {
      audioFileId = await uploadFileToDrive(audioFile, `audio_${Date.now()}_${audioFile.name}`);
    }
  } catch (e: any) {
    console.error("Error during file upload to Drive:", e);
    return { error: `Gagal mengupload file: ${e.message}` };
  }

  const newIdRilis = Date.now().toString(); // Atau generate ID yang lebih baik

  const releaseData: ReleaseFormValues & { idRilis: string } = {
    idRilis: newIdRilis,
    judulRilisan: rawData.judulRilisan as string,
    artist: rawData.artist as string,
    upc: rawData.upc as string | undefined,
    isrc: rawData.isrc as string | undefined,
    tanggalTayang: new Date(rawData.tanggalTayang as string),
    status: rawData.status as ReleaseFormValues['status'],
    // URL atau ID akan disimpan di spreadsheet, bukan data URI lagi
    coverArtUrl: coverArtFileId ? `https://drive.google.com/uc?id=${coverArtFileId}` : undefined, 
    audioFileName: audioFile ? audioFile.name : undefined, // Nama file asli
  };
  
  // Simpan ID file Drive, bukan nama file, untuk referensi
  const valuesToAppend = [
    releaseData.judulRilisan,
    releaseData.artist,
    releaseData.upc || '',
    releaseData.isrc || '',
    format(releaseData.tanggalTayang, 'yyyy-MM-dd'),
    releaseData.status,
    coverArtFileId || '', // Simpan ID file Drive
    audioFileId || '',   // Simpan ID file Drive
    releaseData.idRilis, // Kolom ID unik
  ];

  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:I`, // Append ke kolom A sampai I
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [valuesToAppend],
      },
    });
    revalidatePath('/');
    return releaseData as ReleaseEntry;
  } catch (error: any) {
    console.error('Error adding release to Google Sheets:', error);
    return { error: `Gagal menambahkan rilisan: ${error.message || 'Unknown error'}` };
  }
}

export async function updateRelease(idRilis: string, formData: FormData): Promise<ReleaseEntry | { error: string }> {
  if (!SPREADSHEET_ID) return { error: "SPREADSHEET_ID is not configured." };

  // Cari baris yang sesuai dengan idRilis
  // Ini bagian yang paling tricky dengan Sheets API tanpa database-like queries.
  // Anda perlu menemukan nomor baris (row index) dari rilisan yang akan diupdate.
  // Salah satu cara: fetch semua, cari index, lalu update.
  // Cara lain: jika Anda menyimpan row index saat pertama kali load, atau memiliki ID unik di spreadsheet.
  
  // Placeholder logic - Anda perlu implementasi pencarian row index yang benar
  const sheets = await getSheetsClient();
  const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:I`, // Asumsi ada kolom ID di I
  });
  const rows = getResponse.data.values;
  let rowIndexToUpdate = -1;
  if (rows) {
      rowIndexToUpdate = rows.findIndex(row => row[8] === idRilis); // Kolom ke-9 (index 8) adalah idRilis
  }

  if (rowIndexToUpdate === -1) {
    return { error: `Rilisan dengan ID ${idRilis} tidak ditemukan untuk diperbarui.` };
  }
  const actualRowNumber = rowIndexToUpdate + 2; // +2 karena data mulai dari baris 2 dan index 0-based

  const rawData = Object.fromEntries(formData.entries());
  const coverArtFile = formData.get('coverArtFile') as File | null;
  const audioFile = formData.get('audioFile') as File | null;
  
  // Dapatkan data rilisan yang ada untuk file ID
  const existingRelease = await getReleaseById(idRilis);
  let coverArtFileId = existingRelease?.coverArtUrl?.split('id=')[1] || null;
  let audioFileId = existingRelease?.audioFileName?.startsWith('File ID: ') ? existingRelease.audioFileName.split('File ID: ')[1] : null;


  try {
    if (coverArtFile && coverArtFile.size > 0) {
      // TODO: Hapus file lama di Drive jika ada dan jika perlu
      coverArtFileId = await uploadFileToDrive(coverArtFile, `cover_${Date.now()}_${coverArtFile.name}`);
    }
    if (audioFile && audioFile.size > 0) {
      // TODO: Hapus file lama di Drive jika ada dan jika perlu
      audioFileId = await uploadFileToDrive(audioFile, `audio_${Date.now()}_${audioFile.name}`);
    }
  } catch (e: any) {
    console.error("Error during file upload to Drive for update:", e);
    return { error: `Gagal mengupload file saat update: ${e.message}` };
  }
  
  const updatedData: ReleaseFormValues = {
    judulRilisan: rawData.judulRilisan as string,
    artist: rawData.artist as string,
    upc: rawData.upc as string | undefined,
    isrc: rawData.isrc as string | undefined,
    tanggalTayang: new Date(rawData.tanggalTayang as string),
    status: rawData.status as ReleaseFormValues['status'],
    coverArtUrl: coverArtFileId ? `https://drive.google.com/uc?id=${coverArtFileId}` : (rawData.existingCoverArtUrl as string || undefined),
    audioFileName: audioFile ? audioFile.name : (rawData.existingAudioFileName as string || undefined),
  };

  const valuesToUpdate = [
    updatedData.judulRilisan,
    updatedData.artist,
    updatedData.upc || '',
    updatedData.isrc || '',
    format(updatedData.tanggalTayang, 'yyyy-MM-dd'),
    updatedData.status,
    coverArtFileId || (updatedData.coverArtUrl?.includes('id=') ? updatedData.coverArtUrl.split('id=')[1] : ''),
    audioFileId || '', // Anda mungkin perlu menyimpan nama file asli jika hanya ID yang disimpan sebelumnya
    idRilis, // ID Rilis untuk referensi
  ];

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${actualRowNumber}:I${actualRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [valuesToUpdate],
      },
    });
    revalidatePath('/');
    revalidatePath(`/releases/${idRilis}`);
    return { ...updatedData, idRilis } as ReleaseEntry;
  } catch (error: any) {
    console.error('Error updating release in Google Sheets:', error);
    return { error: `Gagal memperbarui rilisan: ${error.message || 'Unknown error'}` };
  }
}

export async function deleteRelease(idRilis: string): Promise<{ success: boolean; error?: string }> {
  if (!SPREADSHEET_ID) return { success: false, error: "SPREADSHEET_ID is not configured." };

  // Sama seperti update, Anda perlu menemukan row index untuk menghapus baris.
  // API Sheets tidak memiliki 'delete row by ID' secara langsung.
  // Anda bisa menggunakan batchUpdate dengan permintaan deleteDimension.
  
  // Placeholder logic - Anda perlu implementasi pencarian row index yang benar
  const sheets = await getSheetsClient();
   const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:I`, // Asumsi ada kolom ID di I
  });
  const rows = getResponse.data.values;
  let rowIndexToDelete = -1;
  if (rows) {
      rowIndexToDelete = rows.findIndex(row => row[8] === idRilis); // Kolom ke-9 (index 8) adalah idRilis
  }

  if (rowIndexToDelete === -1) {
    return { success: false, error: `Rilisan dengan ID ${idRilis} tidak ditemukan untuk dihapus.` };
  }
  const actualRowNumber = rowIndexToDelete + 2; // +2 karena data mulai dari baris 2 dan index 0-based

  // TODO: Hapus file terkait dari Google Drive jika perlu. Ini memerlukan penyimpanan file ID.

  try {
    // Untuk menghapus baris, Anda perlu tahu sheetId (bukan nama sheet).
    // Anda bisa mendapatkannya dengan `spreadsheets.get`.
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadsheetInfo.data.sheets?.find(s => s.properties?.title === SHEET_NAME);
    if (!sheet?.properties?.sheetId) {
        return { success: false, error: `Sheet dengan nama ${SHEET_NAME} tidak ditemukan.` };
    }
    const sheetId = sheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: actualRowNumber - 1, // 0-indexed
                endIndex: actualRowNumber,
              },
            },
          },
        ],
      },
    });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting release from Google Sheets:', error);
    return { success: false, error: `Gagal menghapus rilisan: ${error.message || 'Unknown error'}` };
  }
}

