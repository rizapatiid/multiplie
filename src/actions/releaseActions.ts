
'use server';

import { revalidatePath } from 'next/cache';
import { getSheetsClient, getDriveClient } from '@/lib/google-clients';
import type { ReleaseEntry, ReleaseFormValues } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import { Readable } from 'stream';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = 'Releases'; // Pastikan nama sheet ini 'Releases' sesuai di spreadsheet Anda
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Helper function to extract Google Drive File ID from various URL formats
function extractDriveIdFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  let id = null;
  // Try to match common Google Drive URL patterns
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/, // /file/d/ID/...
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/, // /open?id=ID
    /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/,   // /uc?id=ID (direct download)
    /([a-zA-Z0-9_-]{25,})/, // Match a string that looks like a file ID (e.g., if just ID is pasted)
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      id = match[1];
      break;
    }
  }
  // If no pattern matched but it's not a URL (could be a raw ID)
  if (!id && !url.startsWith('http') && url.length > 20 && !url.includes(" ")) { // Basic check for a potential ID string
    console.log(`[extractDriveIdFromUrl] Input "${url}" treated as a raw ID.`);
    return url;
  }
  if (id) {
    console.log(`[extractDriveIdFromUrl] Extracted ID "${id}" from URL "${url}".`);
  } else {
    console.log(`[extractDriveIdFromUrl] No ID extracted from URL "${url}".`);
  }
  return id;
}


// Helper function to map spreadsheet rows to ReleaseEntry based on user's sheet structure
function mapRowToReleaseEntry(row: any[], rowIndex: number): ReleaseEntry | null {
  console.log(`[mapRowToReleaseEntry] Processing spreadsheet row index ${rowIndex + 2}, data:`, JSON.stringify(row));
  try {
    // User's Spreadsheet Structure:
    // A (idx 0): ID RILIS
    // B (idx 1): Timestamp (ignored by app for now)
    // C (idx 2): JUDUL RILISAN
    // D (idx 3): ARTIS
    // E (idx 4): GAMBAR RILISAN (URL/ID)
    // F (idx 5): FILE AUDIO (URL/ID)
    // G (idx 6): UPC CODE
    // H (idx 7): ISRC CODE
    // I (idx 8): TANGGAL TAYANG (text, needs parsing)
    // J (idx 9): STATUS

    const idRilis = row[0] || `auto-gen-${Date.now()}-${rowIndex}`; // ID RILIS from Column A

    // Skip if essential fields like ID Rilis or Judul Rilisan are missing
    if (!row[0] && !row[2]) {
      console.warn(`[mapRowToReleaseEntry] SKIPPING row at spreadsheet index ${rowIndex + 2}. Lacking ID Rilis (Col A) AND Judul Rilisan (Col C). Row data:`, row);
      return null;
    }
     if (!row[0]) {
      console.warn(`[mapRowToReleaseEntry] Row at spreadsheet index ${rowIndex + 2} is missing ID Rilis (Col A). Using auto-generated ID: ${idRilis}. Row data:`, row);
    }
    if (!row[2]) {
      console.warn(`[mapRowToReleaseEntry] Row at spreadsheet index ${rowIndex + 2} is missing Judul Rilisan (Col C). Using "Tanpa Judul". Row data:`, row);
    }
    
    let tanggalTayang;
    const dateString = row[8]; // TANGGAL TAYANG from Column I
    if (dateString) {
      let parsedDate = parseISO(dateString); // Handles "yyyy-MM-dd"
      if (!isValid(parsedDate)) {
         // Attempt to parse "dd MonthName yyyy" - this part is tricky with date-fns without more specific locale/format knowledge
         // For now, log and fallback. A more robust solution might involve a date parsing library with format guessing or specific format.
         console.warn(`[mapRowToReleaseEntry] Invalid or non-ISO date format in row ${rowIndex + 2}, column I: "${dateString}". Trying to parse common formats. Original: ${dateString}`);
         // Example: new Date(dateString) can sometimes work for simple formats, but is unreliable.
         // We'll stick to parseISO for consistency and log if it fails.
         // If your dates are "11 April 2025", you'll need a custom parser or ensure they are "yyyy-MM-dd".
         // For now, if parseISO fails, let's try a direct Date constructor as a last resort, but be wary.
         parsedDate = new Date(dateString);
         if (!isValid(parsedDate)) {
            console.error(`[mapRowToReleaseEntry] CRITICAL: Could not parse date "${dateString}" for row ${rowIndex + 2}. Using current date as fallback.`);
            parsedDate = new Date();
         } else {
            console.log(`[mapRowToReleaseEntry] Successfully parsed date "${dateString}" using new Date() for row ${rowIndex + 2}.`);
         }
      }
      tanggalTayang = parsedDate;
    } else {
      console.warn(`[mapRowToReleaseEntry] Missing date in row ${rowIndex + 2}, column I. Using current date as fallback.`);
      tanggalTayang = new Date();
    }

    const coverArtLinkOrId = row[4]; // GAMBAR RILISAN from Column E
    const coverArtFileId = extractDriveIdFromUrl(coverArtLinkOrId);
    
    const audioLinkOrId = row[5]; // FILE AUDIO from Column F
    const audioFileId = extractDriveIdFromUrl(audioLinkOrId);

    const releaseEntry: ReleaseEntry = {
      idRilis: idRilis,
      judulRilisan: row[2] || 'Tanpa Judul', // JUDUL RILISAN from Column C
      artist: row[3] || 'Tanpa Artis',     // ARTIS from Column D
      upc: row[6] || '',                   // UPC CODE from Column G
      isrc: row[7] || '',                  // ISRC CODE from Column H
      tanggalTayang: tanggalTayang,
      status: row[9] || 'Pending',         // STATUS from Column J
      coverArtUrl: coverArtFileId ? `https://drive.google.com/uc?id=${coverArtFileId}` : undefined,
      audioFileName: audioFileId ? `File ID: ${audioFileId}` : undefined, // Or construct a view/download link
    };
    console.log(`[mapRowToReleaseEntry] Successfully mapped row ${rowIndex + 2} to entry:`, JSON.stringify(releaseEntry));
    return releaseEntry;

  } catch (error: any) {
    console.error(`🔴 [mapRowToReleaseEntry] CRITICAL ERROR mapping row at spreadsheet index ${rowIndex + 2}:`, error.message, 'Row data:', JSON.stringify(row), 'Stack:', error.stack);
    return null; // Skip this row if there's a critical error mapping it
  }
}


export async function getReleases(): Promise<ReleaseEntry[]> {
  console.log("🚀 [getReleases] Attempting to fetch releases...");
  if (!SPREADSHEET_ID) {
    const errorMessage = "🔴 FATAL: GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly (e.g., GOOGLE_SPREADSHEET_ID=\"your_sheet_id\") and restart your server.";
    console.error(errorMessage);
    // throw new Error(errorMessage); // Throwing here stops the app, let's return empty for now so UI can show error
    return Promise.reject(new Error(errorMessage));
  }
  console.log(`📄 [getReleases] Using SPREADSHEET_ID: ${SPREADSHEET_ID} and SHEET_NAME: ${SHEET_NAME}`);

  try {
    const sheets = await getSheetsClient();
    console.log("🔧 [getReleases] Google Sheets client obtained. Fetching values...");
    // User's sheet has relevant data up to column J (STATUS)
    const range = `${SHEET_NAME}!A2:J`; 
    console.log(`🔍 [getReleases] Requesting range: ${range}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });

    const rows = response.data.values;

    if (rows && rows.length > 0) {
      console.log(`✅ [getReleases] Successfully fetched ${rows.length} rows from Google Sheets.`);
      const mappedReleases = rows.map((row, index) => {
        return mapRowToReleaseEntry(row, index); // Pass full row and index
      }).filter(release => release !== null) as ReleaseEntry[];
      
      console.log(`ℹ️ [getReleases] Mapped ${mappedReleases.length} valid release entries.`);
      if (mappedReleases.length === 0 && rows.length > 0) {
        console.warn(`⚠️ [getReleases] All ${rows.length} rows from sheet were filtered out or invalid after mapping. Check mapping logic and sheet data. Ensure 'ID RILIS' and 'JUDUL RILISAN' are present or mapping logic can handle their absence.`);
      }
      return mappedReleases;
    } else if (rows && rows.length === 0) {
      console.log(`ℹ️ [getReleases] No data rows found in the specified range (${range}). The sheet might be empty after the header row, or the range is incorrect for data.`);
      return [];
    } else {
      console.log(`🤔 [getReleases] 'response.data.values' is null or undefined. The sheet might be completely empty, or the range is incorrect, or there was an issue with the API call that didn't throw an error but returned no values for SPREADSHEET_ID: ${SPREADSHEET_ID}. Response status: ${response.status}, Response data: ${JSON.stringify(response.data)}`);
      return [];
    }
  } catch (error: any) {
    console.error('🔴 [getReleases] CRITICAL ERROR fetching releases from Google Sheets:');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details:', JSON.stringify(error.response.data.error, null, 2));
      const apiError = error.response.data.error;
      let specificMessage = `Google API Error: ${apiError.message} (Code: ${apiError.code})`;
      if (apiError.code === 403) {
        specificMessage = "🚫 Permission Denied (403). Check if Google Sheets API is enabled, OAuth consent screen has correct scopes (spreadsheets.readonly or spreadsheets), and the authenticated user has read access to the spreadsheet.";
        console.error(specificMessage);
      } else if (apiError.code === 401) {
        specificMessage = "🔑 Authentication Issue (401). OAuth token might be missing, invalid, or expired. Ensure `getAuthenticatedClient` in `src/lib/google-clients.ts` is correctly implemented and provides valid tokens.";
        console.error(specificMessage);
      }  else if (apiError.code === 404) {
        specificMessage = `❓ Spreadsheet Not Found (404). Ensure SPREADSHEET_ID "${SPREADSHEET_ID}" is correct and the sheet named "${SHEET_NAME}" exists.`;
        console.error(specificMessage);
      }
      return Promise.reject(new Error(specificMessage));
    } else {
      console.error('Error Stack:', error.stack);
    }
    // return []; // Return empty array on error to prevent UI crash, error will be handled by calling function
    return Promise.reject(new Error(error.message || "Unknown error fetching releases."));
  }
}

export async function getReleaseById(idRilis: string): Promise<ReleaseEntry | null> {
  console.log(`🚀 [getReleaseById] Attempting to fetch release by ID: ${idRilis}...`);
  if (!SPREADSHEET_ID) {
     const errorMessage = "🔴 FATAL: GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly and restart your server.";
    console.error(errorMessage);
    // throw new Error(errorMessage);
    return Promise.reject(new Error(errorMessage));
  }
  try {
    const releases = await getReleases(); 
    const release = releases.find(r => r.idRilis === idRilis);
    if (release) {
      console.log(`✅ [getReleaseById] Release with ID ${idRilis} found.`);
    } else {
      console.log(`🤔 [getReleaseById] Release with ID ${idRilis} not found after fetching all releases. Total releases checked: ${releases.length}.`);
    }
    return release || null;
  } catch (error: any) {
    console.error(`🔴 [getReleaseById] Error fetching release by ID ${idRilis}:`);
    console.error('Error message:', error.message);
    // return null;
    return Promise.reject(new Error(error.message || `Error fetching release by ID ${idRilis}`));
  }
}

async function uploadFileToDrive(file: File, fileName: string): Promise<string | null> {
  console.log(`🚀 [uploadFileToDrive] Attempting to upload file "${fileName}" to Google Drive...`);
  if (!DRIVE_FOLDER_ID) {
     const errorMessage = "🔴 FATAL: GOOGLE_DRIVE_FOLDER_ID is not configured in your .env.local file for file uploads. Please ensure it is set correctly and restart your server.";
    console.error(errorMessage);
    // throw new Error(errorMessage);
    return Promise.reject(new Error(errorMessage));
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
      fields: 'id', // Request only the file ID
    });
    const fileId = response.data.id;
    if (fileId) {
      console.log(`✅ [uploadFileToDrive] File "${fileName}" uploaded successfully to Google Drive with ID: ${fileId}`);
    } else {
      console.warn(`⚠️ [uploadFileToDrive] File "${fileName}" upload to Google Drive did not return an ID. Response:`, response.data);
    }
    return fileId || null;
  } catch (error: any) {
    console.error(`🔴 [uploadFileToDrive] Error uploading file "${fileName}" to Google Drive:`);
    console.error('Error Message:', error.message);
    let specificMessage = error.message || `Error uploading ${fileName} to Drive.`;
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Drive Upload:', JSON.stringify(error.response.data.error, null, 2));
       const apiError = error.response.data.error;
      if (apiError.code === 403) {
        specificMessage = `🚫 Permission Denied (403) for Drive upload. Check API scopes (drive.file or drive) and folder permissions for ${DRIVE_FOLDER_ID}.`;
        console.error(specificMessage);
      } else if (apiError.code === 401) {
         specificMessage = "🔑 Authentication Issue (401) for Drive upload. OAuth token might be invalid.";
         console.error(specificMessage);
      } else if (apiError.code === 404) {
         specificMessage = `❓ Drive Folder Not Found (404). Ensure DRIVE_FOLDER_ID "${DRIVE_FOLDER_ID}" is correct and accessible.`;
         console.error(specificMessage);
      }
    } else {
       console.error('Error Stack:', error.stack);
    }
    // return null;
    return Promise.reject(new Error(specificMessage));
  }
}

export async function addRelease(formData: FormData): Promise<ReleaseEntry | { error: string }> {
  console.log("🚀 [addRelease] Attempting to add new release...");
  if (!SPREADSHEET_ID) {
    const errorMsg = "GOOGLE_SPREADSHEET_ID is not configured. Check .env.local and restart server.";
    console.error("🔴 FATAL:", errorMsg);
    return { error: errorMsg };
  }
  if (!DRIVE_FOLDER_ID) {
    const errorMsg = "GOOGLE_DRIVE_FOLDER_ID is not configured for file uploads. Check .env.local and restart server.";
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
      if (!coverArtFileId) return { error: "Gagal mengupload gambar sampul ke Google Drive. Periksa log server untuk detail." };
    }
    if (audioFile && audioFile.size > 0) {
      console.log(`🎵 [addRelease] Audio file present: ${audioFile.name}, size: ${audioFile.size}`);
      audioFileId = await uploadFileToDrive(audioFile, `audio_${Date.now()}_${audioFile.name}`);
      if (!audioFileId) return { error: "Gagal mengupload file audio ke Google Drive. Periksa log server untuk detail." };
    }
  } catch (e: any) {
    console.error("🔴 [addRelease] Error during file upload to Drive:", e);
    return { error: `Gagal mengupload file: ${e.message}. Periksa log server.` };
  }

  const newIdRilis = `VT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  console.log(`🆔 [addRelease] Generated new release ID: ${newIdRilis}`);
  
  const releaseDataForSheet = {
    idRilis: newIdRilis, // Column A
    timestamp: new Date().toISOString(), // Column B: Timestamp
    judulRilisan: rawData.judulRilisan as string, // Column C
    artist: rawData.artist as string, // Column D
    coverArtFinalId: coverArtFileId || '', // Column E: GAMBAR RILISAN (ID)
    audioFinalId: audioFileId || '', // Column F: FILE AUDIO (ID)
    upc: rawData.upc as string | undefined, // Column G
    isrc: rawData.isrc as string | undefined, // Column H
    tanggalTayang: new Date(rawData.tanggalTayang as string), // Column I
    status: rawData.status as ReleaseFormValues['status'], // Column J
  };
  
  const valuesToAppend = [
    releaseDataForSheet.idRilis,             // A
    releaseDataForSheet.timestamp,           // B
    releaseDataForSheet.judulRilisan,        // C
    releaseDataForSheet.artist,              // D
    releaseDataForSheet.coverArtFinalId,     // E
    releaseDataForSheet.audioFinalId,        // F
    releaseDataForSheet.upc || '',           // G
    releaseDataForSheet.isrc || '',          // H
    format(releaseDataForSheet.tanggalTayang, 'yyyy-MM-dd'), // I (Pastikan format tanggal sesuai untuk Sheets)
    releaseDataForSheet.status,              // J
  ];

  try {
    const sheets = await getSheetsClient();
    console.log(`➕ [addRelease] Appending new release to Google Sheets (Range: ${SHEET_NAME}!A:J):`, valuesToAppend);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:J`, // Append to all columns A-J, sheets API will find the first empty row
      valueInputOption: 'USER_ENTERED', // Or 'RAW' if you don't want Sheets to parse dates etc.
      requestBody: {
        values: [valuesToAppend],
      },
    });
    console.log("✅ [addRelease] New release added to Google Sheets successfully.");
    revalidatePath('/');
    // Return ReleaseEntry structure
    return {
        idRilis: releaseDataForSheet.idRilis,
        judulRilisan: releaseDataForSheet.judulRilisan,
        artist: releaseDataForSheet.artist,
        upc: releaseDataForSheet.upc,
        isrc: releaseDataForSheet.isrc,
        tanggalTayang: releaseDataForSheet.tanggalTayang,
        status: releaseDataForSheet.status,
        coverArtUrl: releaseDataForSheet.coverArtFinalId ? `https://drive.google.com/uc?id=${releaseDataForSheet.coverArtFinalId}` : undefined,
        audioFileName: releaseDataForSheet.audioFinalId ? `File ID: ${releaseDataForSheet.audioFinalId}` : undefined,
    } as ReleaseEntry;
  } catch (error: any) {
    console.error('🔴 [addRelease] Error adding release to Google Sheets:');
    console.error('Error Message:', error.message);
    let specificError = `Gagal menambahkan rilisan ke Google Sheets: ${error.message || 'Unknown error'}`;
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Sheets Append:', JSON.stringify(error.response.data.error, null, 2));
      specificError = `Gagal menambahkan rilisan ke Sheets: ${error.response.data.error.message} (Code: ${error.response.data.error.code}). Periksa log server.`;
    }
    return { error: specificError };
  }
}

export async function updateRelease(idRilis: string, formData: FormData): Promise<ReleaseEntry | { error: string }> {
  console.log(`🚀 [updateRelease] Attempting to update release with ID: ${idRilis}...`);
  if (!SPREADSHEET_ID) {
     const errorMsg = "GOOGLE_SPREADSHEET_ID is not configured. Check .env.local and restart server.";
    console.error("🔴 FATAL:", errorMsg);
    return { error: errorMsg };
  }
   if (!DRIVE_FOLDER_ID) { 
    const errorMsg = "GOOGLE_DRIVE_FOLDER_ID is not configured for file uploads. Check .env.local and restart server.";
    console.error("🔴 FATAL:", errorMsg);
    return { error: errorMsg };
  }
  
  const sheets = await getSheetsClient();
  let rowIndexToUpdate = -1; // 0-based index relative to the start of the data range (A2)
  let existingRowData: any[] = []; 

  try {
    console.log(`🔍 [updateRelease] Fetching all rows from range ${SHEET_NAME}!A2:J to find row for ID ${idRilis} (in Column A) for update...`);
    const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:J`, // Read all data columns
    });
    const rows = getResponse.data.values;
    if (rows && rows.length > 0) {
        rowIndexToUpdate = rows.findIndex(row => row && row[0] === idRilis); // ID RILIS is in Column A (index 0)
        if (rowIndexToUpdate !== -1) {
          existingRowData = rows[rowIndexToUpdate];
          console.log(`[updateRelease] Found existing data for ID ${idRilis} at data index ${rowIndexToUpdate} (0-based from A2):`, existingRowData);
        } else {
          console.error(`[updateRelease] ID ${idRilis} not found in column A of the sheet range ${SHEET_NAME}!A2:J.`);
        }
    } else {
      console.warn(`[updateRelease] No rows returned from sheet range ${SHEET_NAME}!A2:J when searching for ID ${idRilis}. Sheet might be empty or range issue.`);
    }
  } catch (e: any) {
      console.error('🔴 [updateRelease] Error fetching rows for update:', e.message);
      // If we can't fetch, we can't update.
      return { error: `Gagal mengambil data untuk update: ${e.message}. Periksa log server.` };
  }

  if (rowIndexToUpdate === -1) {
    const errorMsg = `Rilisan dengan ID ${idRilis} tidak ditemukan di spreadsheet untuk diperbarui.`;
    console.error(errorMsg);
    return { error: errorMsg };
  }
  const actualSheetRowNumber = rowIndexToUpdate + 2; // Spreadsheet row number is 1-based, and data starts from row 2.
  console.log(`ℹ️ [updateRelease] Found release to update at sheet row ${actualSheetRowNumber}.`);

  const rawData = Object.fromEntries(formData.entries());
  console.log("📝 [updateRelease] Raw form data for update:", rawData);

  const coverArtFile = formData.get('coverArtFile') as File | null;
  const audioFile = formData.get('audioFile') as File | null;
  
  // Get existing file IDs from sheet (Column E for cover, F for audio)
  // These could be full URLs or just IDs if previously written by the app.
  let coverArtFinalId = extractDriveIdFromUrl(existingRowData[4]) || null; 
  let audioFinalId = extractDriveIdFromUrl(existingRowData[5]) || null;   

  try {
    if (coverArtFile && coverArtFile.size > 0) {
      console.log(`🖼️ [updateRelease] New cover art file provided: ${coverArtFile.name}. Uploading...`);
      // TODO: Potentially delete old file from Drive if replacing
      coverArtFinalId = await uploadFileToDrive(coverArtFile, `cover_${Date.now()}_${coverArtFile.name}`);
      if (!coverArtFinalId) return { error: "Gagal mengupload gambar sampul baru ke Google Drive. Periksa log server." };
    } else {
      console.log("ℹ️ [updateRelease] No new cover art file for update. Using existing ID if available:", coverArtFinalId);
    }
    if (audioFile && audioFile.size > 0) {
      console.log(`🎵 [updateRelease] New audio file provided: ${audioFile.name}. Uploading...`);
      // TODO: Potentially delete old file from Drive if replacing
      audioFinalId = await uploadFileToDrive(audioFile, `audio_${Date.now()}_${audioFile.name}`);
       if (!audioFinalId) return { error: "Gagal mengupload file audio baru ke Google Drive. Periksa log server." };
    } else {
      console.log("ℹ️ [updateRelease] No new audio file for update. Using existing ID if available:", audioFinalId);
    }
  } catch (e: any) {
    console.error("🔴 [updateRelease] Error during file upload to Drive for update:", e);
    return { error: `Gagal mengupload file saat update: ${e.message}. Periksa log server.` };
  }
  
  const updatedReleaseData = {
    idRilis: idRilis, // Column A (already exists, do not change ID)
    timestamp: existingRowData[1] || new Date().toISOString(), // Column B: Keep existing or update, for now keep existing if available
    judulRilisan: rawData.judulRilisan as string, // Column C
    artist: rawData.artist as string, // Column D
    coverArtIdToStore: coverArtFinalId || '', // Column E: GAMBAR RILISAN (ID)
    audioIdToStore: audioFinalId || '', // Column F: FILE AUDIO (ID)
    upc: rawData.upc as string | undefined, // Column G
    isrc: rawData.isrc as string | undefined, // Column H
    tanggalTayang: new Date(rawData.tanggalTayang as string), // Column I
    status: rawData.status as ReleaseFormValues['status'], // Column J
  };

  // Ensure the order matches the columns A-J in your sheet
  const valuesToUpdate = [
    updatedReleaseData.idRilis,                              // A
    updatedReleaseData.timestamp,                            // B
    updatedReleaseData.judulRilisan,                         // C
    updatedReleaseData.artist,                               // D
    updatedReleaseData.coverArtIdToStore,                    // E
    updatedReleaseData.audioIdToStore,                       // F
    updatedReleaseData.upc || '',                            // G
    updatedReleaseData.isrc || '',                           // H
    format(updatedReleaseData.tanggalTayang, 'yyyy-MM-dd'),  // I
    updatedReleaseData.status,                               // J
  ];

  try {
    const updateRange = `${SHEET_NAME}!A${actualSheetRowNumber}:J${actualSheetRowNumber}`;
    console.log(`💾 [updateRelease] Updating row ${actualSheetRowNumber} in Google Sheets (Range: ${updateRange}) with values:`, valuesToUpdate);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [valuesToUpdate],
      },
    });
    console.log(`✅ [updateRelease] Release with ID ${idRilis} updated in Google Sheets successfully.`);
    revalidatePath('/');
    revalidatePath(`/releases/${idRilis}`);
    
    return {
        idRilis: updatedReleaseData.idRilis,
        judulRilisan: updatedReleaseData.judulRilisan,
        artist: updatedReleaseData.artist,
        upc: updatedReleaseData.upc,
        isrc: updatedReleaseData.isrc,
        tanggalTayang: updatedReleaseData.tanggalTayang,
        status: updatedReleaseData.status,
        coverArtUrl: updatedReleaseData.coverArtIdToStore ? `https://drive.google.com/uc?id=${updatedReleaseData.coverArtIdToStore}` : undefined,
        audioFileName: updatedReleaseData.audioIdToStore ? `File ID: ${updatedReleaseData.audioIdToStore}` : undefined,
    } as ReleaseEntry;

  } catch (error: any) {
    console.error(`🔴 [updateRelease] Error updating release ID ${idRilis} in Google Sheets:`);
     console.error('Error message:', error.message);
    let specificError = `Gagal memperbarui rilisan di Google Sheets: ${error.message || 'Unknown error'}`;
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Sheets Update:', JSON.stringify(error.response.data.error, null, 2));
      specificError = `Gagal memperbarui rilisan di Sheets: ${error.response.data.error.message} (Code: ${error.response.data.error.code}). Periksa log server.`;
    }
    return { error: specificError };
  }
}

export async function deleteRelease(idRilis: string): Promise<{ success: boolean; error?: string }> {
  console.log(`🚀 [deleteRelease] Attempting to delete release with ID: ${idRilis}...`);
  if (!SPREADSHEET_ID) {
    const errorMsg = "GOOGLE_SPREADSHEET_ID is not configured. Check .env.local and restart server.";
    console.error("🔴 FATAL:", errorMsg);
    return { success: false, error: errorMsg };
  }
  
  const sheets = await getSheetsClient();
  let rowIndexToDelete = -1; // 0-based index relative to the start of the data range (A2)
  let sheetIdForDeletionApi: number | null | undefined = null;

  try {
    console.log(`🔍 [deleteRelease] Fetching all rows from range ${SHEET_NAME}!A2:J to find row for ID ${idRilis} (in Column A) for deletion...`);
    const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:J`, // Read all data columns
    });
    const rows = getResponse.data.values;
    if (rows && rows.length > 0) {
        rowIndexToDelete = rows.findIndex(row => row && row[0] === idRilis); 
        if (rowIndexToDelete !== -1) {
           console.log(`[deleteRelease] Found row to delete for ID ${idRilis} at data index ${rowIndexToDelete} (0-based from A2).`);
        } else {
          console.warn(`[deleteRelease] ID ${idRilis} not found in column A of the sheet range ${SHEET_NAME}!A2:J for deletion.`);
        }
    } else {
      console.warn(`[deleteRelease] No rows returned from sheet range ${SHEET_NAME}!A2:J when searching for ID ${idRilis} for deletion.`);
    }
  } catch (e: any) {
      console.error('🔴 [deleteRelease] Error fetching rows for deletion:', e.message);
      return { success: false, error: `Gagal mengambil data untuk penghapusan: ${e.message}. Periksa log server.` };
  }

  if (rowIndexToDelete === -1) {
     const errorMsg = `Rilisan dengan ID ${idRilis} tidak ditemukan di spreadsheet untuk dihapus.`;
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }
  
  // The API's `deleteDimension` `startIndex` is 0-based for the *entire sheet*.
  // `rowIndexToDelete` is 0-based *relative to the data starting at row 2*.
  // So, the actual sheet row number to delete is `rowIndexToDelete + 2`.
  // The 0-based sheet index for deletion is `(rowIndexToDelete + 2) - 1 = rowIndexToDelete + 1`.
  const zeroBasedSheetIndexForDeletion = rowIndexToDelete + 1; 
  console.log(`ℹ️ [deleteRelease] Release to delete is at data index ${rowIndexToDelete}, which corresponds to 0-based sheet index ${zeroBasedSheetIndexForDeletion}.`);

  try {
    // Get the sheetId (gid) of the target sheet by its name
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadsheetInfo.data.sheets?.find(s => s.properties?.title === SHEET_NAME);
    sheetIdForDeletionApi = sheet?.properties?.sheetId;

    if (typeof sheetIdForDeletionApi !== 'number') { 
        const errorMsg = `Sheet dengan nama "${SHEET_NAME}" tidak ditemukan atau tidak memiliki sheetId di spreadsheet. Spreadsheet sheets: ${JSON.stringify(spreadsheetInfo.data.sheets?.map(s => s.properties?.title))}`;
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }
    console.log(`🛡️ [deleteRelease] Sheet ID (gid) for "${SHEET_NAME}" is ${sheetIdForDeletionApi}. Proceeding with deletion of row index ${zeroBasedSheetIndexForDeletion}.`);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetIdForDeletionApi,
                dimension: 'ROWS',
                startIndex: zeroBasedSheetIndexForDeletion, 
                endIndex: zeroBasedSheetIndexForDeletion + 1, // Delete one row
              },
            },
          },
        ],
      },
    });
    console.log(`✅ [deleteRelease] Release with ID ${idRilis} (row index ${zeroBasedSheetIndexForDeletion}) deleted from Google Sheets successfully.`);
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error(`🔴 [deleteRelease] Error deleting release ID ${idRilis} from Google Sheets:`);
    console.error('Error Message:', error.message);
    let specificError = `Gagal menghapus rilisan dari Google Sheets: ${error.message || 'Unknown error'}`;
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Sheets Batch Update (Delete):', JSON.stringify(error.response.data.error, null, 2));
      specificError = `Gagal menghapus rilisan dari Sheets: ${error.response.data.error.message} (Code: ${error.response.data.error.code}). Periksa log server.`;
    }
    return { success: false, error: specificError };
  }
}
