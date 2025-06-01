
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
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/, 
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/, 
    /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/,   
    /([a-zA-Z0-9_-]{25,})/, // More generic pattern for IDs, should be last
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      id = match[1];
      break;
    }
  }
  if (!id && !url.startsWith('http') && url.length > 20 && !url.includes(" ") && !url.includes("/")) { 
    // console.log(`[extractDriveIdFromUrl] Input "${url}" treated as a raw ID.`);
    return url; // Assume it's already an ID if it doesn't look like a URL and matches ID-like characteristics
  }
  if (id) {
    // console.log(`[extractDriveIdFromUrl] Extracted ID "${id}" from URL "${url}".`);
  } else {
    // console.warn(`[extractDriveIdFromUrl] No ID extracted from URL "${url}". Returning original value if it looks like an ID, otherwise null.`);
    if(!url.startsWith('http') && url.length > 20 && !url.includes(" ") && !url.includes("/")) {
        return url; 
    }
    return null;
  }
  return id;
}


// Helper function to map spreadsheet rows to ReleaseEntry based on user's sheet structure
function mapRowToReleaseEntry(row: any[], rowIndex: number): ReleaseEntry | null {
  // console.log(`[mapRowToReleaseEntry] Processing spreadsheet row index ${rowIndex + 2}, data:`, JSON.stringify(row));
  try {
    // User's Spreadsheet Structure (0-indexed for `row` array):
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

    const idRilis = row[0]?.trim(); 
    const judulRilisan = row[2]?.trim();

    if (!idRilis && !judulRilisan) {
      // console.warn(`[mapRowToReleaseEntry] SKIPPING row at spreadsheet index ${rowIndex + 2}. Lacking ID Rilis (Col A) AND Judul Rilisan (Col C). Row data:`, row);
      return null;
    }
     if (!idRilis) {
      // console.warn(`[mapRowToReleaseEntry] Row at spreadsheet index ${rowIndex + 2} is missing ID Rilis (Col A). This row will be read-only for updates/deletes by ID. Row data:`, row);
      // For now, let's allow entries without ID Rilis to be displayed, but they won't be updatable/deletable by ID.
      // We assign a placeholder, but it won't match if we try to find by this placeholder later.
    }
    if (!judulRilisan) {
      // console.warn(`[mapRowToReleaseEntry] Row at spreadsheet index ${rowIndex + 2} is missing Judul Rilisan (Col C). Using "Tanpa Judul". Row data:`, row);
    }
    
    let tanggalTayang;
    const dateString = row[8]; 
    if (dateString) {
      let parsedDate = parseISO(dateString); 
      if (!isValid(parsedDate)) {
        //  console.warn(`[mapRowToReleaseEntry] Invalid or non-ISO date format in row ${rowIndex + 2}, column I: "${dateString}". Trying direct Date constructor. Original: ${dateString}`);
         parsedDate = new Date(dateString); // Attempt to parse common date formats
         if (!isValid(parsedDate)) {
            // console.error(`[mapRowToReleaseEntry] CRITICAL: Could not parse date "${dateString}" for row ${rowIndex + 2}. Using current date as fallback.`);
            parsedDate = new Date(); // Fallback to current date
         } else {
            // console.log(`[mapRowToReleaseEntry] Successfully parsed date "${dateString}" using new Date() for row ${rowIndex + 2}.`);
         }
      }
      tanggalTayang = parsedDate;
    } else {
      // console.warn(`[mapRowToReleaseEntry] Missing date in row ${rowIndex + 2}, column I. Using current date as fallback.`);
      tanggalTayang = new Date(); // Fallback to current date if missing
    }

    const coverArtLinkOrId = row[4]; 
    const coverArtFileId = extractDriveIdFromUrl(coverArtLinkOrId);
    
    const audioLinkOrId = row[5]; 
    const audioFileId = extractDriveIdFromUrl(audioLinkOrId);

    const releaseEntry: ReleaseEntry = {
      idRilis: idRilis || `generated-readonly-id-${rowIndex}`, // Provide a placeholder for display if original ID is missing
      judulRilisan: judulRilisan || 'Tanpa Judul', 
      artist: row[3]?.trim() || 'Tanpa Artis',    
      upc: row[6]?.trim() || '',                  
      isrc: row[7]?.trim() || '',                 
      tanggalTayang: tanggalTayang,
      status: row[9]?.trim() || 'Pending',        
      coverArtUrl: coverArtFileId ? `https://drive.google.com/uc?id=${coverArtFileId}` : (coverArtLinkOrId && coverArtLinkOrId.startsWith('http') ? coverArtLinkOrId : undefined),
      audioFileName: audioFileId ? `File ID: ${audioFileId}` : (audioLinkOrId ? audioLinkOrId : undefined), // Or construct a link if you prefer
    };
    // console.log(`[mapRowToReleaseEntry] Successfully mapped row ${rowIndex + 2} to entry:`, JSON.stringify(releaseEntry));
    return releaseEntry;

  } catch (error: any) {
    console.error(`🔴 [mapRowToReleaseEntry] CRITICAL ERROR mapping row at spreadsheet index ${rowIndex + 2}:`, error.message, 'Row data:', JSON.stringify(row), 'Stack:', error.stack);
    return null; 
  }
}


export async function getReleases(): Promise<ReleaseEntry[]> {
  console.log("🚀 [getReleases] Attempting to fetch releases...");
  if (!SPREADSHEET_ID) {
    const errorMessage = "🔴 FATAL: GOOGLE_SPREADSHEET_ID is not configured in your .env.local file. Please ensure it is set correctly (e.g., GOOGLE_SPREADSHEET_ID=\"your_sheet_id\") and restart your server.";
    console.error(errorMessage);
    return Promise.reject(new Error(errorMessage));
  }
  console.log(`📄 [getReleases] Using SPREADSHEET_ID: ${SPREADSHEET_ID} and SHEET_NAME: ${SHEET_NAME}`);

  try {
    const sheets = await getSheetsClient();
    console.log("🔧 [getReleases] Google Sheets client obtained. Fetching values...");
    const range = `${SHEET_NAME}!A2:J`; // Assuming data starts from row 2 and goes up to column J
    console.log(`🔍 [getReleases] Requesting range: ${range}`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });

    const rows = response.data.values;

    if (rows && rows.length > 0) {
      console.log(`✅ [getReleases] Successfully fetched ${rows.length} rows from Google Sheets.`);
      const mappedReleases = rows.map((row, index) => {
        return mapRowToReleaseEntry(row, index); 
      }).filter(release => release !== null && release.idRilis && !release.idRilis.startsWith('generated-readonly-id-')) as ReleaseEntry[]; // Filter out entries with generated/placeholder IDs if they cause issues or are not desired for full management
      
      console.log(`ℹ️ [getReleases] Mapped ${mappedReleases.length} valid release entries with actual IDs.`);
      if (mappedReleases.length === 0 && rows.length > 0) {
        console.warn(`⚠️ [getReleases] All ${rows.length} rows from sheet were filtered out or invalid after mapping. Check mapping logic, sheet data, and ensure 'ID RILIS' (Column A) is present and unique for all entries you want to manage.`);
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
        specificMessage = "🚫 Permission Denied (403). Check if Google Sheets API is enabled, OAuth consent screen has correct scopes (spreadsheets.readonly or spreadsheets), and the authenticated user (via OAuth) has read access to the spreadsheet.";
        console.error(specificMessage);
      } else if (apiError.code === 401) {
        specificMessage = "🔑 Authentication Issue (401). OAuth token might be missing, invalid, or expired. Ensure `getAuthenticatedClient` in `src/lib/google-clients.ts` is correctly implemented and provides valid tokens (e.g., via next-auth).";
        console.error(specificMessage);
      }  else if (apiError.code === 404) {
        specificMessage = `❓ Spreadsheet Not Found (404). Ensure SPREADSHEET_ID "${SPREADSHEET_ID}" is correct and the sheet named "${SHEET_NAME}" exists.`;
        console.error(specificMessage);
      }
      return Promise.reject(new Error(specificMessage));
    } else {
      // If the error.message is "No access, refresh token, API key or refresh handler callback is set.",
      // it means the Google API client was not properly authenticated in `src/lib/google-clients.ts`.
      // This is the MOST LIKELY cause if you see this specific message.
      if (error.message?.includes("No access, refresh token")) {
        console.error("🔑🔑🔑 [getReleases] The error 'No access, refresh token...' indicates a fundamental authentication problem. The Google API client in 'src/lib/google-clients.ts' was not provided with a valid OAuth 2.0 access token. Please ensure your OAuth 2.0 flow is correctly implemented and `oauth2Client.setCredentials()` is called with valid tokens. 🔑🔑🔑");
      }
      console.error('Error Stack:', error.stack);
    }
    // This line (190 in the current full file, may vary slightly) is where the error is propagated to the UI.
    // If error.message is "No access, refresh token...", it's because the API call failed due to missing authentication.
    return Promise.reject(new Error(error.message || "Unknown error fetching releases. Check server logs for details."));
  }
}

export async function getReleaseById(idRilis: string): Promise<ReleaseEntry | null> {
  console.log(`🚀 [getReleaseById] Attempting to fetch release by ID: ${idRilis}...`);
  if (!SPREADSHEET_ID) {
     const errorMessage = "🔴 FATAL: GOOGLE_SPREADSHEET_ID is not configured. Check .env.local.";
    console.error(errorMessage);
    return Promise.reject(new Error(errorMessage));
  }
  if (!idRilis || idRilis.startsWith('generated-readonly-id-')) {
    console.warn(`[getReleaseById] Invalid or placeholder ID provided: ${idRilis}. Cannot fetch by this ID.`);
    return null;
  }
  try {
    // Optimization: Instead of fetching all, try to find the row directly if possible,
    // or ensure getReleases() is efficient enough. For now, using getReleases().
    const releases = await getReleases(); 
    const release = releases.find(r => r.idRilis === idRilis);
    if (release) {
      console.log(`✅ [getReleaseById] Release with ID ${idRilis} found.`);
    } else {
      console.log(`🤔 [getReleaseById] Release with ID ${idRilis} not found after fetching all releases. Total releases checked: ${releases.length}.`);
    }
    return release || null;
  } catch (error: any) {
    console.error(`🔴 [getReleaseById] Error fetching release by ID ${idRilis}:`, error.message);
    return Promise.reject(new Error(error.message || `Error fetching release by ID ${idRilis}`));
  }
}

async function uploadFileToDrive(file: File, fileName: string): Promise<string | null> {
  console.log(`🚀 [uploadFileToDrive] Attempting to upload file "${fileName}" to Google Drive...`);
  if (!DRIVE_FOLDER_ID) {
     const errorMessage = "🔴 FATAL: GOOGLE_DRIVE_FOLDER_ID is not configured for file uploads. Check .env.local.";
    console.error(errorMessage);
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
        specificMessage = `🚫 Permission Denied (403) for Drive upload. Check API scopes (drive.file or drive) and folder permissions for ${DRIVE_FOLDER_ID}. Ensure authenticated user has write access.`;
      } else if (apiError.code === 401) {
         specificMessage = "🔑 Authentication Issue (401) for Drive upload. OAuth token might be invalid.";
      } else if (apiError.code === 404) {
         specificMessage = `❓ Drive Folder Not Found (404). Ensure DRIVE_FOLDER_ID "${DRIVE_FOLDER_ID}" is correct and accessible.`;
      }
    } else {
       console.error('Error Stack:', error.stack);
    }
    return Promise.reject(new Error(specificMessage));
  }
}

export async function addRelease(formData: FormData): Promise<ReleaseEntry | { error: string }> {
  console.log("🚀 [addRelease] Attempting to add new release...");
  if (!SPREADSHEET_ID) return { error: "FATAL: GOOGLE_SPREADSHEET_ID not configured." };
  if (!DRIVE_FOLDER_ID) return { error: "FATAL: GOOGLE_DRIVE_FOLDER_ID not configured." };

  const rawData = Object.fromEntries(formData.entries());
  console.log("📝 [addRelease] Raw form data received:", rawData);
  
  // Validate required fields from form (judulRilisan, artist, tanggalTayang, status should be there from client validation)
  if (!rawData.judulRilisan || !rawData.artist || !rawData.tanggalTayang || !rawData.status) {
    return { error: "Data tidak lengkap. Judul, Artis, Tanggal Tayang, dan Status wajib diisi." };
  }

  const coverArtFile = formData.get('coverArtFile') as File | null;
  const audioFile = formData.get('audioFile') as File | null;

  let coverArtFileId: string | null = null;
  let audioFileId: string | null = null;

  try {
    if (coverArtFile && coverArtFile.size > 0) {
      console.log(`🖼️ [addRelease] Cover art file present: ${coverArtFile.name}, size: ${coverArtFile.size}`);
      coverArtFileId = await uploadFileToDrive(coverArtFile, `cover_${Date.now()}_${coverArtFile.name}`);
      if (!coverArtFileId) return { error: "Gagal mengupload gambar sampul ke Google Drive. Periksa log server." };
    }
    if (audioFile && audioFile.size > 0) {
      console.log(`🎵 [addRelease] Audio file present: ${audioFile.name}, size: ${audioFile.size}`);
      audioFileId = await uploadFileToDrive(audioFile, `audio_${Date.now()}_${audioFile.name}`);
      if (!audioFileId) return { error: "Gagal mengupload file audio ke Google Drive. Periksa log server." };
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
    format(releaseDataForSheet.tanggalTayang, 'yyyy-MM-dd'), // I (Format to string for sheet)
    releaseDataForSheet.status,              // J
  ];

  try {
    const sheets = await getSheetsClient();
    console.log(`➕ [addRelease] Appending new release to Google Sheets (Range: ${SHEET_NAME}!A:J):`, valuesToAppend);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:J`, // Append to all columns A-J
      valueInputOption: 'USER_ENTERED', // So date formats are interpreted correctly
      requestBody: {
        values: [valuesToAppend],
      },
    });
    console.log("✅ [addRelease] New release added to Google Sheets successfully.");
    revalidatePath('/');
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
    console.error('🔴 [addRelease] Error adding release to Google Sheets:', error.message);
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
  if (!SPREADSHEET_ID) return { error: "FATAL: GOOGLE_SPREADSHEET_ID not configured." };
  if (!DRIVE_FOLDER_ID) return { error: "FATAL: GOOGLE_DRIVE_FOLDER_ID not configured." };
  if (!idRilis || idRilis.startsWith('generated-readonly-id-')) {
    return { error: `ID Rilis tidak valid untuk pembaruan: ${idRilis}` };
  }
  
  const sheets = await getSheetsClient();
  let rowIndexToUpdate = -1; // 0-based index relative to the start of the data range (A2)
  let existingRowData: any[] = []; // To get existing timestamp or other uneditable fields

  try {
    // Fetch all rows to find the one with matching ID Rilis in Column A
    console.log(`🔍 [updateRelease] Fetching all rows from range ${SHEET_NAME}!A2:J to find row for ID ${idRilis} (in Column A) for update...`);
    const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:J`, // Read all data from A2 down to J
    });
    const rows = getResponse.data.values;
    if (rows && rows.length > 0) {
        // Find the index of the row where the first column (ID Rilis) matches
        rowIndexToUpdate = rows.findIndex(row => row && row[0] === idRilis); // row[0] is Column A
        if (rowIndexToUpdate !== -1) {
          existingRowData = rows[rowIndexToUpdate];
          // console.log(`[updateRelease] Found existing data for ID ${idRilis} at data index ${rowIndexToUpdate} (0-based from A2):`, existingRowData);
        } else {
          console.error(`[updateRelease] ID ${idRilis} not found in column A of the sheet range ${SHEET_NAME}!A2:J.`);
        }
    } else {
      console.warn(`[updateRelease] No rows returned from sheet range ${SHEET_NAME}!A2:J when searching for ID ${idRilis}.`);
    }
  } catch (e: any) {
      console.error('🔴 [updateRelease] Error fetching rows for update:', e.message);
      return { error: `Gagal mengambil data untuk update: ${e.message}. Periksa log server.` };
  }

  if (rowIndexToUpdate === -1) {
    const errorMsg = `Rilisan dengan ID ${idRilis} tidak ditemukan di spreadsheet untuk diperbarui.`;
    console.error(errorMsg);
    return { error: errorMsg };
  }
  // actualSheetRowNumber is rowIndexToUpdate + 2 because sheet data starts from row 2 (A2)
  const actualSheetRowNumber = rowIndexToUpdate + 2; 
  console.log(`ℹ️ [updateRelease] Found release to update at sheet row ${actualSheetRowNumber}.`);

  const rawData = Object.fromEntries(formData.entries());
  console.log("📝 [updateRelease] Raw form data for update:", rawData);

  const coverArtFile = formData.get('coverArtFile') as File | null;
  const audioFile = formData.get('audioFile') as File | null;
  
  // Kolom E (index 4) untuk Cover Art ID, Kolom F (index 5) untuk Audio File ID
  let coverArtFinalId = extractDriveIdFromUrl(existingRowData[4]) || ''; // Get existing ID from Col E
  let audioFinalId = extractDriveIdFromUrl(existingRowData[5]) || '';   // Get existing ID from Col F

  try {
    if (coverArtFile && coverArtFile.size > 0) {
      console.log(`🖼️ [updateRelease] New cover art file provided: ${coverArtFile.name}. Uploading...`);
      coverArtFinalId = (await uploadFileToDrive(coverArtFile, `cover_${Date.now()}_${coverArtFile.name}`)) || coverArtFinalId;
      if (!coverArtFinalId && coverArtFile) return { error: "Gagal mengupload gambar sampul baru ke Google Drive." };
    } else {
      // console.log("ℹ️ [updateRelease] No new cover art file for update. Using existing ID/URL if available:", coverArtFinalId);
    }
    if (audioFile && audioFile.size > 0) {
      console.log(`🎵 [updateRelease] New audio file provided: ${audioFile.name}. Uploading...`);
      audioFinalId = (await uploadFileToDrive(audioFile, `audio_${Date.now()}_${audioFile.name}`)) || audioFinalId;
       if (!audioFinalId && audioFile) return { error: "Gagal mengupload file audio baru ke Google Drive." };
    } else {
      // console.log("ℹ️ [updateRelease] No new audio file for update. Using existing ID/URL if available:", audioFinalId);
    }
  } catch (e: any) {
    console.error("🔴 [updateRelease] Error during file upload to Drive for update:", e);
    return { error: `Gagal mengupload file saat update: ${e.message}. Periksa log server.` };
  }
  
  // Prepare updated data for the sheet
  const updatedReleaseData = {
    idRilis: idRilis, // A - Should not change
    timestamp: existingRowData[1] || new Date().toISOString(), // B - Keep existing or set new if missing
    judulRilisan: rawData.judulRilisan as string, // C
    artist: rawData.artist as string, // D
    coverArtIdToStore: coverArtFinalId, // E - Store only ID
    audioIdToStore: audioFinalId, // F - Store only ID
    upc: rawData.upc as string | undefined, // G
    isrc: rawData.isrc as string | undefined, // H
    tanggalTayang: new Date(rawData.tanggalTayang as string), // I
    status: rawData.status as ReleaseFormValues['status'], // J
  };

  const valuesToUpdate = [
    updatedReleaseData.idRilis,                              // A
    updatedReleaseData.timestamp,                            // B
    updatedReleaseData.judulRilisan,                         // C
    updatedReleaseData.artist,                               // D
    updatedReleaseData.coverArtIdToStore,                    // E
    updatedReleaseData.audioIdToStore,                       // F
    updatedReleaseData.upc || '',                            // G
    updatedReleaseData.isrc || '',                           // H
    format(updatedReleaseData.tanggalTayang, 'yyyy-MM-dd'),  // I (Format to string)
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
        // Construct full URL for display if ID exists, or use existing full URL from form if no new file and old URL was passed
        coverArtUrl: updatedReleaseData.coverArtIdToStore ? `https://drive.google.com/uc?id=${updatedReleaseData.coverArtIdToStore}` : (formData.get('existingCoverArtUrl') as string || undefined),
        audioFileName: updatedReleaseData.audioIdToStore ? `File ID: ${updatedReleaseData.audioIdToStore}` : (formData.get('existingAudioFileName') as string || undefined),
    } as ReleaseEntry;

  } catch (error: any) {
    console.error(`🔴 [updateRelease] Error updating release ID ${idRilis} in Google Sheets:`, error.message);
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
  if (!SPREADSHEET_ID) return { success: false, error: "FATAL: GOOGLE_SPREADSHEET_ID not configured." };
  if (!idRilis || idRilis.startsWith('generated-readonly-id-')) {
    return { success: false, error: `ID Rilis tidak valid untuk penghapusan: ${idRilis}` };
  }
  
  const sheets = await getSheetsClient();
  let rowIndexToDelete = -1; // 0-based index relative to the start of the data range (A2)
  let sheetIdForDeletionApi: number | null | undefined = null;

  // Step 1: Find the row index based on idRilis in Column A
  try {
    console.log(`🔍 [deleteRelease] Fetching all rows from range ${SHEET_NAME}!A2:J to find row for ID ${idRilis} (Col A) for deletion...`);
    const getResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A2:J`, // Read column A to find the ID
    });
    const rows = getResponse.data.values;
    if (rows && rows.length > 0) {
        rowIndexToDelete = rows.findIndex(row => row && row[0] === idRilis); // row[0] is Column A
        if (rowIndexToDelete !== -1) {
          //  console.log(`[deleteRelease] Found row to delete for ID ${idRilis} at data index ${rowIndexToDelete} (0-based from A2).`);
        } else {
          console.warn(`[deleteRelease] ID ${idRilis} not found in column A of sheet range ${SHEET_NAME}!A2:J for deletion.`);
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
  
  // Step 2: Get the sheetId (gid) for the BatchUpdate request
  try {
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadsheetInfo.data.sheets?.find(s => s.properties?.title === SHEET_NAME);
    sheetIdForDeletionApi = sheet?.properties?.sheetId;

    if (typeof sheetIdForDeletionApi !== 'number') { // sheetId can be 0, so check for number type
        const errorMsg = `Sheet dengan nama "${SHEET_NAME}" tidak ditemukan atau tidak memiliki sheetId. Pastikan sheet ada dan namanya benar. Sheets found: ${JSON.stringify(spreadsheetInfo.data.sheets?.map(s => s.properties?.title))}`;
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }
    // console.log(`🛡️ [deleteRelease] Sheet ID (gid) for "${SHEET_NAME}" is ${sheetIdForDeletionApi}.`);
  } catch (e: any) {
    console.error('🔴 [deleteRelease] Error fetching sheetId for deletion:', e.message);
    return { success: false, error: `Gagal mendapatkan metadata sheet untuk penghapusan: ${e.message}. Periksa log server.` };
  }

  // Step 3: Perform the deletion using batchUpdate
  // The startIndex for deleteDimension is 0-based from the beginning of the sheet.
  // Since our data range starts at A2, the actual sheet row index is `rowIndexToDelete + 1` (because header is row 1, data starts at row 2 which is index 1 if 0-indexed from sheet start).
  const zeroBasedSheetIndexForDeletion = rowIndexToDelete + 1; 
  console.log(`ℹ️ [deleteRelease] Release to delete is at data index ${rowIndexToDelete} (from A2), which corresponds to 0-based sheet index ${zeroBasedSheetIndexForDeletion} for the deleteDimension API call.`);

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetIdForDeletionApi,
                dimension: 'ROWS',
                startIndex: zeroBasedSheetIndexForDeletion, // This is the 0-based index of the row *within the sheet*
                endIndex: zeroBasedSheetIndexForDeletion + 1, // endIndex is exclusive
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
    console.error(`🔴 [deleteRelease] Error deleting release ID ${idRilis} from Google Sheets:`, error.message);
    let specificError = `Gagal menghapus rilisan dari Google Sheets: ${error.message || 'Unknown error'}`;
    if (error.response && error.response.data && error.response.data.error) {
      console.error('Google API Error Details for Sheets Batch Update (Delete):', JSON.stringify(error.response.data.error, null, 2));
      specificError = `Gagal menghapus rilisan dari Sheets: ${error.response.data.error.message} (Code: ${error.response.data.error.code}). Periksa log server.`;
    }
    return { success: false, error: specificError };
  }
}

