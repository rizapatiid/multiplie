
'use server';

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

// Jika Anda menggunakan next-auth, ini adalah tempat Anda akan mengimpornya
// import { getServerSession } from "next-auth/next"
// import { authOptions } from "@/app/api/auth/[...nextauth]/route" // Ganti dengan path yang benar ke konfigurasi authOptions Anda

async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  // Pastikan NEXT_PUBLIC_APP_URL di .env.local sudah benar (misal: http://localhost:9002)
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`; 

  if (!clientId || !clientSecret) {
    const errorMsg = "🔴 FATAL: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Check .env.local and restart server. API calls will fail.";
    console.error(errorMsg);
    // Tetap lanjutkan agar error sebenarnya (token tidak ada) muncul saat panggilan API
  }
  
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.warn("⚠️ WARNING: NEXT_PUBLIC_APP_URL is not set in .env.local. This is crucial for the OAuth redirect URI. Please set it (e.g., NEXT_PUBLIC_APP_URL=\"http://localhost:9002\") and restart server.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  //---------------------------------------------------------------------------
  // !!! KRITIKAL: IMPLEMENTASI LOGIKA OTENTIKASI (PENGAMBILAN TOKEN) DI SINI !!!
  //---------------------------------------------------------------------------
  // Anda PERLU mendapatkan access_token (dan idealnya refresh_token) dari pengguna
  // yang sudah login dan memberikan izin, lalu mengaturnya di oauth2Client.
  //
  // **Jika menggunakan `next-auth` (SANGAT DISARANKAN):**
  // 1. Buat file `src/app/api/auth/[...nextauth]/route.ts` (atau .js).
  // 2. Konfigurasikan GoogleProvider dengan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
  //    dan minta scopes:
  //    `https://www.googleapis.com/auth/spreadsheets`
  //    `https://www.googleapis.com/auth/drive.file`
  // 3. Dalam callbacks `jwt` dan `session` di `next-auth`, pastikan `accessToken`
  //    (dan `refreshToken` jika memungkinkan) dari Google disimpan dan dapat diakses.
  // 4. Di sini, Anda akan menggunakan `getServerSession` (jika di server component/route handler)
  //    atau cara lain untuk mendapatkan sesi pengguna dan tokennya.
  //
  // **Contoh Placeholder dengan `next-auth` (sesuaikan):**
  /*
  try {
    // Cara mendapatkan sesi mungkin berbeda tergantung di mana kode ini dipanggil.
    // Untuk Server Actions seperti ini, Anda mungkin perlu meneruskan sesi/token sebagai argumen
    // atau memiliki cara khusus untuk mengaksesnya dalam konteks Server Action.
    // const session = await getServerSession(authOptions); // Dapatkan sesi pengguna
    // if (session && (session as any).accessToken) { // Pastikan accessToken ada di tipe session Anda
    //   oauth2Client.setCredentials({
    //     access_token: (session as any).accessToken as string,
    //     // refresh_token: (session as any).refreshToken as string | undefined, // Jika Anda juga menyimpan dan mengelola refresh token
    //   });
    //   console.log("🔧 [getAuthenticatedClient] OAuth2 client configured with tokens from next-auth session.");
    // } else {
    //   console.warn("⚠️ [getAuthenticatedClient] No valid session or access token found via next-auth. Google API calls will likely fail. User needs to login.");
    // }
  } catch (sessionError: any) {
    console.error("🔴 [getAuthenticatedClient] Error getting/processing session for OAuth tokens:", sessionError.message);
  }
  */
  //---------------------------------------------------------------------------
  // !!! AKHIR BAGIAN IMPLEMENTASI TOKEN !!!
  //---------------------------------------------------------------------------

  if (!oauth2Client.credentials.access_token && !oauth2Client.credentials.refresh_token) {
    const noTokenMessage = "🔴 CRITICAL [getAuthenticatedClient]: OAuth2 client does NOT have an access_token. This will cause Google API calls to fail with 'No access, refresh token, API key or refresh handler callback is set.' error. You MUST implement full OAuth 2.0 token retrieval (e.g., using next-auth) and then call 'oauth2Client.setCredentials({ access_token: YOUR_TOKEN });' before this client can be used.";
    console.error(noTokenMessage);
    console.warn("🕵️ [getAuthenticatedClient] Reminder: Implement token retrieval (e.g., via next-auth) and set credentials on oauth2Client. Google API calls will fail without it.");
  } else {
    console.log("✅ [getAuthenticatedClient] OAuth2 client has an access_token set (or refresh_token). Proceeding with API client creation.");
  }

  return oauth2Client;
}

export async function getSheetsClient() {
  const auth = await getAuthenticatedClient();
  return google.sheets({ version: 'v4', auth });
}

export async function getDriveClient() {
  const auth = await getAuthenticatedClient();
  return google.drive({ version: 'v3', auth });
}

