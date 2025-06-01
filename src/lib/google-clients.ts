
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
    const errorMsg = "🔴 FATAL: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Check .env.local and restart server.";
    console.error(errorMsg);
    // Tidak melempar error di sini agar panggilan API yang sebenarnya yang gagal dan ditangkap oleh UI
  }
  
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.warn("⚠️ WARNING: NEXT_PUBLIC_APP_URL is not set in .env.local. This is crucial for the OAuth redirect URI. Please set it (e.g., NEXT_PUBLIC_APP_URL=\"http://localhost:9002\") and restart server.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  //---------------------------------------------------------------------------
  // !!! KRITIKAL: IMPLEMENTASI LOGIKA OTENTIKASI (PENGAMBILAN TOKEN) DI SINI !!!
  //---------------------------------------------------------------------------
  // Bagian ini adalah yang PALING PENTING dan perlu Anda implementasikan.
  // Anda perlu cara untuk mendapatkan access_token (dan idealnya refresh_token)
  // setelah pengguna login dan memberikan izin.
  //
  // **Jika menggunakan `next-auth` (SANGAT DISARANKAN):**
  // 1. Pastikan `next-auth` sudah terinstall (`npm install next-auth`).
  // 2. Konfigurasikan Google Provider di `src/app/api/auth/[...nextauth]/route.ts` (atau .js).
  //    Gunakan `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` Anda.
  // 3. Dalam callback JWT dan session di `next-auth`, pastikan `accessToken` dan `refreshToken`
  //    disimpan dan tersedia di objek `session`.
  // 4. Di sini, Anda akan menggunakan `getServerSession` untuk mendapatkan sesi pengguna
  //    dan mengambil tokennya.
  //
  // **Contoh Placeholder dengan `next-auth` (sesuaikan dengan implementasi Anda):**
  /*
  try {
    const session = await getServerSession(authOptions); // authOptions dari file [...nextauth]
    if (session && session.accessToken) { // Pastikan accessToken ada di tipe session Anda
      oauth2Client.setCredentials({
        access_token: session.accessToken as string,
        // refresh_token: session.refreshToken as string | undefined, // Jika Anda juga menyimpan dan mengelola refresh token
      });
      console.log("🔧 [getAuthenticatedClient] OAuth2 client configured with tokens from next-auth session.");

      // Opsional: Logika untuk refresh token jika access token akan kedaluwarsa
      // if (oauth2Client.isTokenExpiring() && session.refreshToken) {
      //   console.log("⏳ [getAuthenticatedClient] Access token is expiring, attempting to refresh...");
      //   try {
      //     const { tokens } = await oauth2Client.refreshAccessToken();
      //     oauth2Client.setCredentials(tokens);
      //     console.log("🔑 [getAuthenticatedClient] Access token refreshed successfully using next-auth refresh token.");
      //     // TODO: Anda mungkin perlu memperbarui token di sesi next-auth jika di-refresh di sini.
      //   } catch (refreshError: any) {
      //     console.error("🚨 [getAuthenticatedClient] Error refreshing access token:", refreshError.message);
      //     // Tangani error refresh token (misalnya, minta pengguna login ulang)
      //   }
      // }

    } else {
      console.warn("⚠️ [getAuthenticatedClient] No valid session or access token found via next-auth. Google API calls will likely fail. User needs to login.");
    }
  } catch (sessionError: any) {
    console.error("🔴 [getAuthenticatedClient] Error getting session for OAuth tokens:", sessionError.message);
  }
  */
  //---------------------------------------------------------------------------
  // !!! AKHIR BAGIAN IMPLEMENTASI TOKEN !!!
  //---------------------------------------------------------------------------


  if (!oauth2Client.credentials.access_token && !oauth2Client.credentials.refresh_token) {
    console.warn("🕵️ [getAuthenticatedClient] Reminder: OAuth2 client does NOT have an access_token or refresh_token. This means authentication with Google has not been completed. Implement token retrieval (e.g., via next-auth) and setting credentials on oauth2Client. Google API calls will fail.");
  }

  return oauth2Client;
}

export async function getSheetsClient() {
  const auth = await getAuthenticatedClient();
  return google.sheets({ version: 'v4', auth });
}

export async function getDriveClient() {
  const auth = await getAuthenticatedClient(); // Sebelumnya ada typo, memanggil dirinya sendiri
  return google.drive({ version: 'v3', auth });
}
