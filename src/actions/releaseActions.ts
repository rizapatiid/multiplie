
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
function mapRowToReleaseEntry(row: any[], rowIndex: number, idFromSheet?: string): ReleaseEntry | null {
  try {
    // Kolom 0: Judul Rilisan
    // Kolom 1: Artist
    // Kolom 2: UPC
    // Kolom 3: ISRC
    // Kolom 4: Tanggal Tayang (format YYYY-MM-DD)
    // Kolom 5: Status
    // Kolom 6: CoverArtFileID (dari Google Drive)
    // Kolom 7: AudioFileID (dari Google Drive)
    // Kolom 8: idRilis (ID unik yang dibuat aplikasi, disimpan di spreadsheet)

    const idRilis = idFromSheet || `row-${rowIndex + 2}`; // Fallback ID jika kolom idRilis kosong

    if (!row[0] && !row[1]) { // Anggap baris kosong jika judul dan artis tidak ada
      console.warn(`Skipping empty or incomplete row at spreadsheet index ${rowIndex + 2}.`);
      return null;
    }
    
    let tanggalTayang;
    if (row[4]) {
      try {
        tanggalTayang = parseISO(row[4]);
         if (isNaN(tanggalTayang.getTime())) {
          console.warn(`Invalid date format in row ${rowIndex + 2}, column E: "${row[4]}". Using current date as fallback.`);
          tanggalTayang = new Date();
        }
      } catch (dateError) {
        console.warn(`Error parsing date in row ${rowIndex + 2}, column E: "${row[4]}". Using current date as fallback. Error: ${dateError}`);
        tanggalTayang = new Date();
      }
    } else {
      console.warn(`Missing date in row ${rowIndex + 2}, column E. Using current date as fallback.`);
      tanggalTayang = new Date();
    }

    return {
      idRilis: idRilis,
      judulRilisan: row[0] || 'Tanpa Judul',
      artist: row[1] || 'Tanpa Artis',
      upc: row[2] || '',
      isrc: row[3] || '',
      tanggalTayang: tanggalTayang,
      status: row[5] || 'Pending',
      coverArtUrl: row[6] ? `https://drive.google.com/uc?id=${row[6]}` : undefined,
      audioFileName: row[7] ? `File ID: ${row[7]}` : undefined,
    };
  } catch (error: any) {
    console.error(`Error mapping row at spreadsheet index ${rowIndex + 2}:`, error.message, 'Row data:', row);
    return null; // Skip this row if there's a critical error mapping it
  }
}


export async function getReleases(): Promise<ReleaseEntry[]> {
  console.log("🚀 [getReleases] Attempting to fetch releases...");
  if (!SPREADSHEET_ID) {
    const errorMessage = "🔴 FATAL: GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly (e.g., GOOGLE_SPREADSHEET_ID=\"your_sheet_id\") and restart your server.";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  console.log(`📄 [getReleases] Using SPREADSHEET_ID: ${SPREADSHEET_ID} and SHEET_NAME: ${SHEET_NAME}`);

  try {
    const sheets = await getSheetsClient();
    console.log("🔧 [getReleases] Google Sheets client obtained. Fetching values...");
    const range = `${SHEET_NAME}!A2:I`; // Ambil dari A2 sampai kolom I (idRilis)
    console.log(`🔍 [getReleases] Requesting range: ${range}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });

    const rows = response.data.values;

    if (rows && rows.length > 0) {
      console.log(`✅ [getReleases] Successfully fetched ${rows.length} rows from Google Sheets.`);
      const mappedReleases = rows.map((row, index) => {
        const idFromSheet = row[8]; // Kolom I untuk idRilis
        return mapRowToReleaseEntry(row, index, idFromSheet);
      }).filter(release => release !== null) as ReleaseEntry[]; // Filter out nulls (skipped rows)
      
      console.log(`ℹ️ [getReleases] Mapped ${mappedReleases.length} valid release entries.`);
      if (mappedReleases.length === 0 && rows.length > 0) {
        console.warn(`⚠️ [getReleases] All ${rows.length} rows from sheet were filtered out or invalid after mapping. Check mapping logic and sheet data.`);
      }
      return mappedReleases;
    } else if (rows && rows.length === 0) {
      console.log("ℹ️ [getReleases] No data rows found in the specified range (A2:I). The sheet might be empty after the header row.");
      return [];
    } else {
      console.log("🤔 [getReleases] 'response.data.values' is null or undefined. The sheet might be completely empty or the range is incorrect.");
      return [];
    }
  } catch (error: any) {
    console.error('🔴 [getReleases] Error fetching releases from Google Sheets:');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details:', JSON.stringify(error.response.data.error, null, 2));
      const apiError = error.response.data.error;
      if (apiError.code === 403) {
        console.error("🚫 [getReleases] Permission Denied (403). Check if the Google Sheets API is enabled, OAuth consent screen has correct scopes, and the authenticated user has access to the spreadsheet.");
      } else if (apiError.code === 401) {
        console.error("🔑 [getReleases] Authentication Issue (401). OAuth token might be missing, invalid, or expired. Ensure `getAuthenticatedClient` in `src/lib/google-clients.ts` is correctly implemented and provides valid tokens.");
      }
    } else {
      console.error('Error Stack:', error.stack);
    }
    return []; 
  }
}

export async function getReleaseById(idRilis: string): Promise<ReleaseEntry | null> {
  console.log(`🚀 [getReleaseById] Attempting to fetch release by ID: ${idRilis}...`);
  if (!SPREADSHEET_ID) {
     const errorMessage = "🔴 FATAL: GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server.";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  try {
    const releases = await getReleases(); 
    const release = releases.find(r => r.idRilis === idRilis);
    if (release) {
      console.log(`✅ [getReleaseById] Release with ID ${idRilis} found.`);
    } else {
      console.log(`🤔 [getReleaseById] Release with ID ${idRilis} not found after fetching all releases.`);
    }
    return release || null;
  } catch (error: any) {
    console.error(`🔴 [getReleaseById] Error fetching release by ID ${idRilis}:`);
    console.error('Error message:', error.message);
    return null;
  }
}

async function uploadFileToDrive(file: File, fileName: string): Promise<string | null> {
  console.log(`🚀 [uploadFileToDrive] Attempting to upload file "${fileName}" to Google Drive...`);
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
      body: Readable.from(buffer),
    };
    
    console.log(`☁️ [uploadFileToDrive] Calling Google Drive API to create file: ${fileName} in folder ${DRIVE_FOLDER_ID}`);
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [DRIVE_FOLDER_ID],
      },
      media: media,
      fields: 'id',
    });
    const fileId = response.data.id;
    if (fileId) {
      console.log(`✅ [uploadFileToDrive] File "${fileName}" uploaded successfully to Google Drive with ID: ${fileId}`);
    } else {
      console.warn(`⚠️ [uploadFileToDrive] File "${fileName}" upload to Google Drive did not return an ID.`);
    }
    return fileId || null;
  } catch (error: any) {
    console.error(`🔴 [uploadFileToDrive] Error uploading file "${fileName}" to Google Drive:`);
    console.error('Error Message:', error.message);
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Drive Upload:', JSON.stringify(error.response.data.error, null, 2));
       const apiError = error.response.data.error;
      if (apiError.code === 403) {
        console.error("🚫 [uploadFileToDrive] Permission Denied (403). Check if the Google Drive API is enabled, OAuth consent screen has correct scopes (drive.file or drive), and the authenticated user has write access to the target folder.");
      } else if (apiError.code === 401) {
         console.error("🔑 [uploadFileToDrive] Authentication Issue (401). OAuth token might be missing, invalid, or expired.");
      }
    } else {
       console.error('Error Stack:', error.stack);
    }
    return null;
  }
}

export async function addRelease(formData: FormData): Promise<ReleaseEntry | { error: string }> {
  console.log("🚀 [addRelease] Attempting to add new release...");
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
  console.log("📝 [addRelease] Raw form data received:", rawData);
  
  const coverArtFile = formData.get('coverArtFile') as File | null;
  const audioFile = formData.get('audioFile') as File | null;

  let coverArtFileId: string | null = null;
  let audioFileId: string | null = null;

  try {
    if (coverArtFile && coverArtFile.size > 0) {
      console.log(`🖼️ [addRelease] Cover art file present: ${coverArtFile.name}, size: ${coverArtFile.size}`);
      coverArtFileId = await uploadFileToDrive(coverArtFile, `cover_${Date.now()}_${coverArtFile.name}`);
      if (!coverArtFileId) return { error: "Gagal mengupload gambar sampul ke Google Drive." };
    } else {
      console.log("ℹ️ [addRelease] No new cover art file provided for upload.");
    }
    if (audioFile && audioFile.size > 0) {
      console.log(`🎵 [addRelease] Audio file present: ${audioFile.name}, size: ${audioFile.size}`);
      audioFileId = await uploadFileToDrive(audioFile, `audio_${Date.now()}_${audioFile.name}`);
      if (!audioFileId) return { error: "Gagal mengupload file audio ke Google Drive." };
    } else {
       console.log("ℹ️ [addRelease] No new audio file provided for upload.");
    }
  } catch (e: any) {
    console.error("🔴 [addRelease] Error during file upload to Drive:", e);
    return { error: `Gagal mengupload file: ${e.message}` };
  }

  const newIdRilis = `VT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`🆔 [addRelease] Generated new release ID: ${newIdRilis}`);

  const releaseData: ReleaseFormValues & { idRilis: string } = {
    idRilis: newIdRilis,
    judulRilisan: rawData.judulRilisan as string,
    artist: rawData.artist as string,
    upc: rawData.upc as string | undefined,
    isrc: rawData.isrc as string | undefined,
    tanggalTayang: new Date(rawData.tanggalTayang as string),
    status: rawData.status as ReleaseFormValues['status'],
    coverArtUrl: coverArtFileId ? `https://drive.google.com/uc?id=${coverArtFileId}` : undefined, 
    audioFileName: audioFileId ? `File ID: ${audioFileId}` : undefined,
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
    console.log("➕ [addRelease] Appending new release to Google Sheets:", valuesToAppend);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:I`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [valuesToAppend],
      },
    });
    console.log("✅ [addRelease] New release added to Google Sheets successfully.");
    revalidatePath('/');
    return releaseData as ReleaseEntry;
  } catch (error: any) {
    console.error('🔴 [addRelease] Error adding release to Google Sheets:');
    console.error('Error Message:', error.message);
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Sheets Append:', JSON.stringify(error.response.data.error, null, 2));
    }
    return { error: `Gagal menambahkan rilisan ke Google Sheets: ${error.message || 'Unknown error'}` };
  }
}

export async function updateRelease(idRilis: string, formData: FormData): Promise<ReleaseEntry | { error: string }> {
  console.log(`🚀 [updateRelease] Attempting to update release with ID: ${idRilis}...`);
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
    console.log(`🔍 [updateRelease] Fetching all rows to find row for ID ${idRilis} for update...`);
    const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:I`,
    });
    const rows = getResponse.data.values;
    if (rows) {
        rowIndexToUpdate = rows.findIndex(row => row[8] === idRilis); 
        if (rowIndexToUpdate !== -1) {
          existingRowData = rows[rowIndexToUpdate];
          console.log(`Found existing data for ID ${idRilis} at row index ${rowIndexToUpdate}:`, existingRowData);
        } else {
          console.log(`ID ${idRilis} not found in column I of the sheet.`);
        }
    } else {
      console.log(`No rows returned from sheet when searching for ID ${idRilis}.`);
    }
  } catch (e: any) {
      console.error('🔴 [updateRelease] Error fetching rows for update:', e.message);
      return { error: `Gagal mengambil data untuk update: ${e.message}` };
  }

  if (rowIndexToUpdate === -1) {
    const errorMsg = `Rilisan dengan ID ${idRilis} tidak ditemukan di spreadsheet untuk diperbarui.`;
    console.error(errorMsg);
    return { error: errorMsg };
  }
  const actualRowNumber = rowIndexToUpdate + 2;
  console.log(`ℹ️ [updateRelease] Found release to update at sheet row ${actualRowNumber}.`);

  const rawData = Object.fromEntries(formData.entries());
  console.log("📝 [updateRelease] Raw form data for update:", rawData);

  const coverArtFile = formData.get('coverArtFile') as File | null;
  const audioFile = formData.get('audioFile') as File | null;
  
  let coverArtFileId = existingRowData[6] || null;
  let audioFileId = existingRowData[7] || null;    

  try {
    if (coverArtFile && coverArtFile.size > 0) {
      console.log(`🖼️ [updateRelease] New cover art file provided: ${coverArtFile.name}. Uploading...`);
      coverArtFileId = await uploadFileToDrive(coverArtFile, `cover_${Date.now()}_${coverArtFile.name}`);
      if (!coverArtFileId) return { error: "Gagal mengupload gambar sampul baru ke Google Drive." };
    } else {
      console.log("ℹ️ [updateRelease] No new cover art file for update. Using existing if available:", coverArtFileId);
    }
    if (audioFile && audioFile.size > 0) {
      console.log(`🎵 [updateRelease] New audio file provided: ${audioFile.name}. Uploading...`);
      audioFileId = await uploadFileToDrive(audioFile, `audio_${Date.now()}_${audioFile.name}`);
       if (!audioFileId) return { error: "Gagal mengupload file audio baru ke Google Drive." };
    } else {
      console.log("ℹ️ [updateRelease] No new audio file for update. Using existing if available:", audioFileId);
    }
  } catch (e: any) {
    console.error("🔴 [updateRelease] Error during file upload to Drive for update:", e);
    return { error: `Gagal mengupload file saat update: ${e.message}` };
  }
  
  const updatedData: ReleaseFormValues = {
    judulRilisan: rawData.judulRilisan as string,
    artist: rawData.artist as string,
    upc: rawData.upc as string | undefined,
    isrc: rawData.isrc as string | undefined,
    tanggalTayang: new Date(rawData.tanggalTayang as string),
    status: rawData.status as ReleaseFormValues['status'],
    coverArtUrl: coverArtFileId ? `https://drive.google.com/uc?id=${coverArtFileId}` : undefined,
    audioFileName: audioFileId ? `File ID: ${audioFileId}` : undefined,
  };

  const valuesToUpdate = [
    updatedData.judulRilisan,
    updatedData.artist,
    updatedData.upc || '',
    updatedData.isrc || '',
    format(updatedData.tanggalTayang, 'yyyy-MM-dd'),
    updatedData.status,
    coverArtFileId || '',
    audioFileId || '',
    idRilis,
  ];

  try {
    console.log(`💾 [updateRelease] Updating row ${actualRowNumber} in Google Sheets with values:`, valuesToUpdate);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${actualRowNumber}:I${actualRowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [valuesToUpdate],
      },
    });
    console.log(`✅ [updateRelease] Release with ID ${idRilis} updated in Google Sheets successfully.`);
    revalidatePath('/');
    revalidatePath(`/releases/${idRilis}`);
    return { ...updatedData, idRilis } as ReleaseEntry;
  } catch (error: any) {
    console.error(`🔴 [updateRelease] Error updating release ID ${idRilis} in Google Sheets:`);
     console.error('Error message:', error.message);
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Sheets Update:', JSON.stringify(error.response.data.error, null, 2));
    }
    return { error: `Gagal memperbarui rilisan di Google Sheets: ${error.message || 'Unknown error'}` };
  }
}

export async function deleteRelease(idRilis: string): Promise<{ success: boolean; error?: string }> {
  console.log(`🚀 [deleteRelease] Attempting to delete release with ID: ${idRilis}...`);
  if (!SPREADSHEET_ID) {
    const errorMsg = "GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server.";
    console.error("🔴 FATAL:", errorMsg);
    return { success: false, error: errorMsg };
  }
  
  const sheets = await getSheetsClient();
  let rowIndexToDelete = -1;
  let sheetIdForDeletion: number | null | undefined = null;

  try {
    console.log(`🔍 [deleteRelease] Fetching all rows to find row for ID ${idRilis} for deletion...`);
    const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:I`,
    });
    const rows = getResponse.data.values;
    if (rows) {
        rowIndexToDelete = rows.findIndex(row => row[8] === idRilis);
        if (rowIndexToDelete !== -1) {
           console.log(`Found row to delete for ID ${idRilis} at spreadsheet data index ${rowIndexToDelete} (0-based from A2).`);
        } else {
          console.log(`ID ${idRilis} not found in column I of the sheet for deletion.`);
        }
    } else {
      console.log(`No rows returned from sheet when searching for ID ${idRilis} for deletion.`);
    }
  } catch (e: any) {
      console.error('🔴 [deleteRelease] Error fetching rows for deletion:', e.message);
      return { success: false, error: `Gagal mengambil data untuk penghapusan: ${e.message}` };
  }

  if (rowIndexToDelete === -1) {
     const errorMsg = `Rilisan dengan ID ${idRilis} tidak ditemukan di spreadsheet untuk dihapus.`;
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
  const actualRowNumberInSheet = rowIndexToDelete + 2; 
  const zeroBasedStartIndex = actualRowNumberInSheet - 1; 
  console.log(`ℹ️ [deleteRelease] Release to delete is at sheet row ${actualRowNumberInSheet} (0-based sheet index ${zeroBasedStartIndex}).`);

  try {
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadsheetInfo.data.sheets?.find(s => s.properties?.title === SHEET_NAME);
    sheetIdForDeletion = sheet?.properties?.sheetId;

    if (typeof sheetIdForDeletion !== 'number') { // sheetId can be 0, so check for number type
        const errorMsg = `Sheet dengan nama "${SHEET_NAME}" tidak ditemukan atau tidak memiliki sheetId di spreadsheet.`;
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }
    console.log(`🛡️ [deleteRelease] Sheet ID for "${SHEET_NAME}" is ${sheetIdForDeletion}. Proceeding with deletion.`);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetIdForDeletion,
                dimension: 'ROWS',
                startIndex: zeroBasedStartIndex, 
                endIndex: zeroBasedStartIndex + 1,
              },
            },
          },
        ],
      },
    });
    console.log(`✅ [deleteRelease] Release with ID ${idRilis} (row ${actualRowNumberInSheet}) deleted from Google Sheets successfully.`);
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error(`🔴 [deleteRelease] Error deleting release ID ${idRilis} from Google Sheets:`);
    console.error('Error Message:', error.message);
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Sheets Batch Update (Delete):', JSON.stringify(error.response.data.error, null, 2));
    }
    return { success: false, error: `Gagal menghapus rilisan dari Google Sheets: ${error.message || 'Unknown error'}` };
  }
}

