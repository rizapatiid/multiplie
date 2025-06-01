
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
    idRilis: id.toString(), 
    judulRilisan: row[0] || '',
    artist: row[1] || '',
    upc: row[2] || '',
    isrc: row[3] || '',
    tanggalTayang: row[4] ? parseISO(row[4]) : new Date(),
    status: row[5] || 'Pending',
    coverArtUrl: row[6] ? `https://drive.google.com/uc?id=${row[6]}` : undefined, 
    audioFileName: row[7] ? `File ID: ${row[7]}` : undefined, 
    // idInternalSpreadsheet: row[8] || null 
  };
}


export async function getReleases(): Promise<ReleaseEntry[]> {
  if (!SPREADSHEET_ID) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server.");
  }
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:I`, 
    });

    const rows = response.data.values;
    if (rows && rows.length) {
      return rows.map((row, index) => mapRowToReleaseEntry(row, row[8] || (index + 2).toString() )); 
    }
    return [];
  } catch (error) {
    console.error('Error fetching releases from Google Sheets:', error);
    return []; 
  }
}

export async function getReleaseById(idRilis: string): Promise<ReleaseEntry | null> {
  if (!SPREADSHEET_ID) {
    throw new Error("GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server.");
  }
  try {
    const releases = await getReleases(); 
    const release = releases.find(r => r.idRilis === idRilis);
    return release || null;
  } catch (error) {
    console.error(`Error fetching release by ID ${idRilis}:`, error);
    return null;
  }
}

async function uploadFileToDrive(file: File, fileName: string): Promise<string | null> {
  if (!DRIVE_FOLDER_ID) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server.");
  }
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
        body: require('stream').Readable.from(buffer),
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
  if (!SPREADSHEET_ID) {
    return { error: "GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server." };
  }
  if (!DRIVE_FOLDER_ID) { // Check for Drive folder ID as well for uploads
    return { error: "GOOGLE_DRIVE_FOLDER_ID is not configured in your .env.local file for file uploads. Please ensure it is set correctly and restart your server." };
  }

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

  const newIdRilis = Date.now().toString(); 

  const releaseData: ReleaseFormValues & { idRilis: string } = {
    idRilis: newIdRilis,
    judulRilisan: rawData.judulRilisan as string,
    artist: rawData.artist as string,
    upc: rawData.upc as string | undefined,
    isrc: rawData.isrc as string | undefined,
    tanggalTayang: new Date(rawData.tanggalTayang as string),
    status: rawData.status as ReleaseFormValues['status'],
    coverArtUrl: coverArtFileId ? `https://drive.google.com/uc?id=${coverArtFileId}` : undefined, 
    audioFileName: audioFile ? audioFile.name : undefined, 
  };
  
  const valuesToAppend = [
    releaseData.judulRilisan,
    releaseData.artist,
    releaseData.upc || '',
    releaseData.isrc || '',
    format(releaseData.tanggalTayang, 'yyyy-MM-dd'),
    releaseData.status,
    coverArtFileId || '', 
    audioFileId || '',   
    releaseData.idRilis, 
  ];

  try {
    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:I`, 
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
  if (!SPREADSHEET_ID) {
    return { error: "GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server." };
  }
   if (!DRIVE_FOLDER_ID) { 
    return { error: "GOOGLE_DRIVE_FOLDER_ID is not configured in your .env.local file for file uploads. Please ensure it is set correctly and restart your server." };
  }
  
  const sheets = await getSheetsClient();
  const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:I`, 
  });
  const rows = getResponse.data.values;
  let rowIndexToUpdate = -1;
  if (rows) {
      rowIndexToUpdate = rows.findIndex(row => row[8] === idRilis); 
  }

  if (rowIndexToUpdate === -1) {
    return { error: `Rilisan dengan ID ${idRilis} tidak ditemukan untuk diperbarui.` };
  }
  const actualRowNumber = rowIndexToUpdate + 2; 

  const rawData = Object.fromEntries(formData.entries());
  const coverArtFile = formData.get('coverArtFile') as File | null;
  const audioFile = formData.get('audioFile') as File | null;
  
  const existingRelease = await getReleaseById(idRilis);
  let coverArtFileId = existingRelease?.coverArtUrl?.split('id=')[1] || null;
  let audioFileId = existingRelease?.audioFileName?.startsWith('File ID: ') ? existingRelease.audioFileName.split('File ID: ')[1] : null;


  try {
    if (coverArtFile && coverArtFile.size > 0) {
      coverArtFileId = await uploadFileToDrive(coverArtFile, `cover_${Date.now()}_${coverArtFile.name}`);
    }
    if (audioFile && audioFile.size > 0) {
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
    audioFileId || '', 
    idRilis, 
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
  if (!SPREADSHEET_ID) {
    return { success: false, error: "GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server." };
  }
  
  const sheets = await getSheetsClient();
   const getResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:I`, 
  });
  const rows = getResponse.data.values;
  let rowIndexToDelete = -1;
  if (rows) {
      rowIndexToDelete = rows.findIndex(row => row[8] === idRilis); 
  }

  if (rowIndexToDelete === -1) {
    return { success: false, error: `Rilisan dengan ID ${idRilis} tidak ditemukan untuk dihapus.` };
  }
  const actualRowNumber = rowIndexToDelete + 2; 

  try {
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
                startIndex: actualRowNumber - 1, 
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
