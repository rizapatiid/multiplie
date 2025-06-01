
'use server';

import { revalidatePath } from 'next/cache';
import { getSheetsClient, getDriveClient } from '@/lib/google-clients';
import type { ReleaseEntry, ReleaseFormValues } from '@/types';
import { format, parseISO } from 'date-fns';
import { Readable } from 'stream';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = 'Releases'; // Sesuaikan dengan nama sheet Anda
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Helper function to map spreadsheet rows to ReleaseEntry
function mapRowToReleaseEntry(row: any[], id: string | number): ReleaseEntry {
  // Asumsi urutan kolom: Judul, Artis, UPC, ISRC, TanggalTayang (YYYY-MM-DD), Status, CoverArtID, AudioFileID, OriginalID (dari spreadsheet, jika ada)
  // Kolom 0: Judul Rilisan
  // Kolom 1: Artist
  // Kolom 2: UPC
  // Kolom 3: ISRC
  // Kolom 4: Tanggal Tayang (format YYYY-MM-DD)
  // Kolom 5: Status
  // Kolom 6: CoverArtFileID (dari Google Drive)
  // Kolom 7: AudioFileID (dari Google Drive)
  // Kolom 8: idRilis (ID unik yang dibuat aplikasi, disimpan di spreadsheet)
  return {
    idRilis: id.toString(), 
    judulRilisan: row[0] || '',
    artist: row[1] || '',
    upc: row[2] || '',
    isrc: row[3] || '',
    tanggalTayang: row[4] ? parseISO(row[4]) : new Date(), // Pastikan format tanggal di spreadsheet adalah YYYY-MM-DD
    status: row[5] || 'Pending',
    coverArtUrl: row[6] ? `https://drive.google.com/uc?id=${row[6]}` : undefined, 
    audioFileName: row[7] ? `File ID: ${row[7]}` : undefined, // Mengindikasikan ini adalah ID file
    // idInternalSpreadsheet: row[8] || null // Ini sebenarnya idRilis kita
  };
}


export async function getReleases(): Promise<ReleaseEntry[]> {
  console.log("Attempting to fetch releases...");
  if (!SPREADSHEET_ID) {
    const errorMessage = "🔴 FATAL: GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly (e.g., GOOGLE_SPREADSHEET_ID=\"your_sheet_id\") and restart your server.";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  console.log(`Using SPREADSHEET_ID: ${SPREADSHEET_ID} and SHEET_NAME: ${SHEET_NAME}`);

  try {
    const sheets = await getSheetsClient();
    console.log("Google Sheets client obtained. Fetching values...");
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:I`, // Ambil dari A2 sampai kolom I (idRilis)
    });

    const rows = response.data.values;
    if (rows && rows.length) {
      console.log(`Successfully fetched ${rows.length} rows from Google Sheets.`);
      return rows.map((row, index) => {
        // Gunakan kolom ke-9 (index 8) sebagai ID jika ada, jika tidak fallback ke nomor baris
        const idForRow = row[8] || (index + 2).toString(); 
        return mapRowToReleaseEntry(row, idForRow);
      });
    }
    console.log("No rows found in Google Sheets or 'response.data.values' is empty/null.");
    return [];
  } catch (error: any) {
    console.error('🔴 Error fetching releases from Google Sheets:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details:', JSON.stringify(error.response.data.error, null, 2));
    }
    // Daripada melempar error langsung yang bisa menghentikan render halaman,
    // kita kembalikan array kosong dan log errornya.
    // Di tahap produksi, Anda mungkin ingin menangani ini secara berbeda (misalnya, halaman error khusus).
    return []; 
  }
}

export async function getReleaseById(idRilis: string): Promise<ReleaseEntry | null> {
  console.log(`Attempting to fetch release by ID: ${idRilis}...`);
  if (!SPREADSHEET_ID) {
     const errorMessage = "🔴 FATAL: GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server.";
    console.error(errorMessage);
    // Melempar error di sini mungkin lebih sesuai karena ini adalah operasi spesifik
    throw new Error(errorMessage);
  }
  try {
    // Cara yang lebih efisien adalah dengan mencari langsung di spreadsheet jika memungkinkan,
    // tetapi untuk saat ini kita akan mengambil semua dan memfilter.
    // Jika dataset besar, pertimbangkan query yang lebih spesifik jika API mendukung.
    const releases = await getReleases(); 
    const release = releases.find(r => r.idRilis === idRilis);
    if (release) {
      console.log(`Release with ID ${idRilis} found.`);
    } else {
      console.log(`Release with ID ${idRilis} not found after fetching all releases.`);
    }
    return release || null;
  } catch (error: any) {
    console.error(`🔴 Error fetching release by ID ${idRilis}:`);
    console.error('Error message:', error.message);
    // Tidak melempar error agar halaman detail bisa menampilkan "tidak ditemukan"
    return null;
  }
}

async function uploadFileToDrive(file: File, fileName: string): Promise<string | null> {
  console.log(`Attempting to upload file "${fileName}" to Google Drive...`);
  if (!DRIVE_FOLDER_ID) {
     const errorMessage = "🔴 FATAL: GOOGLE_DRIVE_FOLDER_ID is not configured in your .env.local file for file uploads. Please ensure it is set correctly and restart your server.";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  try {
    const drive = await getDriveClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    
    const media = {
      mimeType: file.type,
      body: Readable.from(buffer), // Gunakan Readable stream
    };
    
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [DRIVE_FOLDER_ID],
      },
      media: media,
      fields: 'id', // Hanya minta ID file yang dibuat
    });
    const fileId = response.data.id;
    if (fileId) {
      console.log(`File "${fileName}" uploaded successfully to Google Drive with ID: ${fileId}`);
    } else {
      console.warn(`File "${fileName}" upload to Google Drive did not return an ID.`);
    }
    return fileId || null;
  } catch (error: any) {
    console.error(`🔴 Error uploading file "${fileName}" to Google Drive:`);
    console.error('Error message:', error.message);
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Drive Upload:', JSON.stringify(error.response.data.error, null, 2));
    }
    return null; // Kembalikan null jika upload gagal
  }
}

export async function addRelease(formData: FormData): Promise<ReleaseEntry | { error: string }> {
  console.log("Attempting to add new release...");
  if (!SPREADSHEET_ID) {
    const errorMsg = "GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server.";
    console.error("🔴 FATAL:", errorMsg);
    return { error: errorMsg };
  }
  if (!DRIVE_FOLDER_ID) {
    const errorMsg = "GOOGLE_DRIVE_FOLDER_ID is not configured in your .env.local file for file uploads. Please ensure it is set correctly and restart your server.";
     console.error("🔴 FATAL:", errorMsg);
    return { error: errorMsg };
  }

  const rawData = Object.fromEntries(formData.entries());
  
  const coverArtFile = formData.get('coverArtFile') as File | null;
  const audioFile = formData.get('audioFile') as File | null;

  let coverArtFileId: string | null = null;
  let audioFileId: string | null = null;

  try {
    if (coverArtFile && coverArtFile.size > 0) {
      coverArtFileId = await uploadFileToDrive(coverArtFile, `cover_${Date.now()}_${coverArtFile.name}`);
      if (!coverArtFileId) return { error: "Gagal mengupload gambar sampul ke Google Drive." };
    }
    if (audioFile && audioFile.size > 0) {
      audioFileId = await uploadFileToDrive(audioFile, `audio_${Date.now()}_${audioFile.name}`);
      if (!audioFileId) return { error: "Gagal mengupload file audio ke Google Drive." };
    }
  } catch (e: any) {
    console.error("🔴 Error during file upload to Drive for addRelease:", e);
    return { error: `Gagal mengupload file: ${e.message}` };
  }

  // Buat ID unik baru untuk rilisan ini
  const newIdRilis = `VT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

  const releaseData: ReleaseFormValues & { idRilis: string } = {
    idRilis: newIdRilis,
    judulRilisan: rawData.judulRilisan as string,
    artist: rawData.artist as string,
    upc: rawData.upc as string | undefined,
    isrc: rawData.isrc as string | undefined,
    tanggalTayang: new Date(rawData.tanggalTayang as string),
    status: rawData.status as ReleaseFormValues['status'],
    coverArtUrl: coverArtFileId ? `https://drive.google.com/uc?id=${coverArtFileId}` : undefined, 
    audioFileName: audioFileId ? `File ID: ${audioFileId}` : undefined, // Simpan ID file audio
  };
  
  // Data untuk ditambahkan ke spreadsheet
  // Pastikan urutannya sesuai dengan kolom di spreadsheet Anda
  // Kolom I adalah untuk idRilis yang baru dibuat
  const valuesToAppend = [
    releaseData.judulRilisan,
    releaseData.artist,
    releaseData.upc || '',
    releaseData.isrc || '',
    format(releaseData.tanggalTayang, 'yyyy-MM-dd'), // Format tanggal untuk spreadsheet
    releaseData.status,
    coverArtFileId || '', // Simpan ID file cover art
    audioFileId || '',   // Simpan ID file audio
    releaseData.idRilis, // Simpan ID unik rilisan
  ];

  try {
    const sheets = await getSheetsClient();
    console.log("Appending new release to Google Sheets:", valuesToAppend);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:I`, // Tambahkan ke semua kolom yang relevan
      valueInputOption: 'USER_ENTERED', // Atau 'RAW' jika Anda tidak ingin Google Sheets menginterpretasi nilai
      requestBody: {
        values: [valuesToAppend],
      },
    });
    console.log("New release added to Google Sheets successfully.");
    revalidatePath('/'); // Revalidasi path untuk memuat ulang data di halaman utama
    return releaseData as ReleaseEntry;
  } catch (error: any) {
    console.error('🔴 Error adding release to Google Sheets:');
    console.error('Error message:', error.message);
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Sheets Append:', JSON.stringify(error.response.data.error, null, 2));
    }
    return { error: `Gagal menambahkan rilisan ke Google Sheets: ${error.message || 'Unknown error'}` };
  }
}

// Untuk update, kita perlu menemukan baris yang sesuai berdasarkan idRilis
export async function updateRelease(idRilis: string, formData: FormData): Promise<ReleaseEntry | { error: string }> {
  console.log(`Attempting to update release with ID: ${idRilis}...`);
  if (!SPREADSHEET_ID) {
     const errorMsg = "GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server.";
    console.error("🔴 FATAL:", errorMsg);
    return { error: errorMsg };
  }
   if (!DRIVE_FOLDER_ID) { 
    const errorMsg = "GOOGLE_DRIVE_FOLDER_ID is not configured in your .env.local file for file uploads. Please ensure it is set correctly and restart your server.";
    console.error("🔴 FATAL:", errorMsg);
    return { error: errorMsg };
  }
  
  const sheets = await getSheetsClient();
  let rowIndexToUpdate = -1;
  let existingRowData: any[] = [];

  try {
    // Dapatkan semua data untuk menemukan baris yang cocok dengan idRilis di kolom I (index 8)
    console.log(`Fetching all rows to find row for ID ${idRilis} for update...`);
    const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:I`, // Asumsi data dari baris 2, dan idRilis ada di kolom I
    });
    const rows = getResponse.data.values;
    if (rows) {
        // Cari baris yang memiliki idRilis di kolom ke-9 (index 8)
        rowIndexToUpdate = rows.findIndex(row => row[8] === idRilis); 
        if (rowIndexToUpdate !== -1) {
          existingRowData = rows[rowIndexToUpdate];
        }
    }
  } catch (e: any) {
      console.error('🔴 Error fetching rows for update:', e.message);
      return { error: `Gagal mengambil data untuk update: ${e.message}` };
  }


  if (rowIndexToUpdate === -1) {
    const errorMsg = `Rilisan dengan ID ${idRilis} tidak ditemukan di spreadsheet untuk diperbarui.`;
    console.error(errorMsg);
    return { error: errorMsg };
  }
  const actualRowNumber = rowIndexToUpdate + 2; // Karena data dimulai dari baris 2
  console.log(`Found release to update at sheet row ${actualRowNumber}. Existing data:`, existingRowData);

  const rawData = Object.fromEntries(formData.entries());
  const coverArtFile = formData.get('coverArtFile') as File | null;
  const audioFile = formData.get('audioFile') as File | null;
  
  // Ambil ID file yang sudah ada dari data spreadsheet jika ada
  let coverArtFileId = existingRowData[6] || null; // Kolom G (index 6) untuk CoverArtFileID
  let audioFileId = existingRowData[7] || null;    // Kolom H (index 7) untuk AudioFileID

  try {
    if (coverArtFile && coverArtFile.size > 0) {
      console.log("New cover art file provided for update. Uploading...");
      coverArtFileId = await uploadFileToDrive(coverArtFile, `cover_${Date.now()}_${coverArtFile.name}`);
      if (!coverArtFileId) return { error: "Gagal mengupload gambar sampul baru ke Google Drive." };
    }
    if (audioFile && audioFile.size > 0) {
      console.log("New audio file provided for update. Uploading...");
      audioFileId = await uploadFileToDrive(audioFile, `audio_${Date.now()}_${audioFile.name}`);
       if (!audioFileId) return { error: "Gagal mengupload file audio baru ke Google Drive." };
    }
  } catch (e: any) {
    console.error("🔴 Error during file upload to Drive for update:", e);
    return { error: `Gagal mengupload file saat update: ${e.message}` };
  }
  
  const updatedData: ReleaseFormValues = {
    judulRilisan: rawData.judulRilisan as string,
    artist: rawData.artist as string,
    upc: rawData.upc as string | undefined,
    isrc: rawData.isrc as string | undefined,
    tanggalTayang: new Date(rawData.tanggalTayang as string),
    status: rawData.status as ReleaseFormValues['status'],
    // URL dan nama file di-construct berdasarkan ID file dari Drive
    coverArtUrl: coverArtFileId ? `https://drive.google.com/uc?id=${coverArtFileId}` : undefined,
    audioFileName: audioFileId ? `File ID: ${audioFileId}` : undefined,
  };

  // Data untuk diupdate di spreadsheet
  const valuesToUpdate = [
    updatedData.judulRilisan,
    updatedData.artist,
    updatedData.upc || '',
    updatedData.isrc || '',
    format(updatedData.tanggalTayang, 'yyyy-MM-dd'),
    updatedData.status,
    coverArtFileId || '', // Simpan ID file cover art (baru atau lama)
    audioFileId || '',    // Simpan ID file audio (baru atau lama)
    idRilis,              // idRilis tidak berubah
  ];

  try {
    console.log(`Updating row ${actualRowNumber} in Google Sheets with values:`, valuesToUpdate);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${actualRowNumber}:I${actualRowNumber}`, // Update dari kolom A sampai I
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [valuesToUpdate],
      },
    });
    console.log(`Release with ID ${idRilis} updated in Google Sheets successfully.`);
    revalidatePath('/');
    revalidatePath(`/releases/${idRilis}`);
    return { ...updatedData, idRilis } as ReleaseEntry;
  } catch (error: any) {
    console.error(`🔴 Error updating release ID ${idRilis} in Google Sheets:`);
     console.error('Error message:', error.message);
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Sheets Update:', JSON.stringify(error.response.data.error, null, 2));
    }
    return { error: `Gagal memperbarui rilisan di Google Sheets: ${error.message || 'Unknown error'}` };
  }
}

export async function deleteRelease(idRilis: string): Promise<{ success: boolean; error?: string }> {
  console.log(`Attempting to delete release with ID: ${idRilis}...`);
  if (!SPREADSHEET_ID) {
    const errorMsg = "GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server.";
    console.error("🔴 FATAL:", errorMsg);
    return { success: false, error: errorMsg };
  }
  
  const sheets = await getSheetsClient();
  let rowIndexToDelete = -1;

  try {
    console.log(`Fetching all rows to find row for ID ${idRilis} for deletion...`);
    const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:I`, // Cari idRilis di kolom I
    });
    const rows = getResponse.data.values;
    if (rows) {
        rowIndexToDelete = rows.findIndex(row => row[8] === idRilis);
    }
  } catch (e: any) {
      console.error('🔴 Error fetching rows for deletion:', e.message);
      return { success: false, error: `Gagal mengambil data untuk penghapusan: ${e.message}` };
  }


  if (rowIndexToDelete === -1) {
     const errorMsg = `Rilisan dengan ID ${idRilis} tidak ditemukan di spreadsheet untuk dihapus.`;
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
  const actualRowNumberInSheet = rowIndexToDelete + 2; // Karena data kita mulai dari baris 2 di sheet
  // Indeks untuk batchUpdate adalah 0-based dari awal sheet, jadi (actualRowNumberInSheet - 1)
  const zeroBasedStartIndex = actualRowNumberInSheet - 1; 
  console.log(`Found release to delete at sheet row ${actualRowNumberInSheet} (0-based index ${zeroBasedStartIndex}).`);


  try {
    // Dapatkan sheetId yang diperlukan untuk permintaan batchUpdate
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadsheetInfo.data.sheets?.find(s => s.properties?.title === SHEET_NAME);
    if (!sheet?.properties?.sheetId) {
        const errorMsg = `Sheet dengan nama "${SHEET_NAME}" tidak ditemukan di spreadsheet.`;
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }
    const sheetId = sheet.properties.sheetId;
    console.log(`Sheet ID for "${SHEET_NAME}" is ${sheetId}. Proceeding with deletion.`);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: zeroBasedStartIndex, 
                endIndex: zeroBasedStartIndex + 1, // Hanya hapus satu baris
              },
            },
          },
        ],
      },
    });
    console.log(`Release with ID ${idRilis} (row ${actualRowNumberInSheet}) deleted from Google Sheets successfully.`);
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error(`🔴 Error deleting release ID ${idRilis} from Google Sheets:`);
    console.error('Error message:', error.message);
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Sheets Batch Update (Delete):', JSON.stringify(error.response.data.error, null, 2));
    }
    return { success: false, error: `Gagal menghapus rilisan dari Google Sheets: ${error.message || 'Unknown error'}` };
  }
}


    