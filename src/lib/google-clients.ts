
'use server';

import { google } from 'googleapis';
import type { OAuth2Client, Credentials } from 'google-auth-library';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Pastikan path ini benar

async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`;

  if (!clientId || !clientSecret) {
    const errorMsg = "🔴 FATAL: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Check .env.local.";
    console.error(errorMsg);
    // Melempar error di sini akan menghentikan alur lebih awal jika konfigurasi dasar hilang.
    // Atau, biarkan panggilan API gagal dan ditangani oleh UI. Untuk saat ini, kita log dan lanjutkan.
  }
  
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.warn("⚠️ WARNING: NEXT_PUBLIC_APP_URL (atau NEXTAUTH_URL) belum diatur dalam .env.local. Ini penting untuk OAuth redirect.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // !!! KRITIKAL: Integrasi dengan NextAuth untuk mendapatkan token !!!
  try {
    const session = await getServerSession(authOptions);
    
    if (session && session.user?.accessToken) {
      const credentials = {
        access_token: session.user.accessToken,
        refresh_token: session.user.refreshToken, // Pastikan ini ada di sesi jika Anda butuh refresh otomatis
      } as Credentials;
      
      oauth2Client.setCredentials(credentials);
      console.log("🔧 [getAuthenticatedClient] OAuth2 client configured with tokens from NextAuth session.");

      // Opsional: Logika untuk menangani refresh token jika access token kedaluwarsa
      // Google API client library biasanya bisa menangani ini secara otomatis jika refresh_token tersedia
      // dan `access_type: 'offline'` diminta saat otorisasi awal.
      // Namun, Anda mungkin perlu listener untuk event 'tokens' untuk memperbarui token di database/sesi Anda.
      // oauth2Client.on('tokens', (newTokens) => {
      //   if (newTokens.refresh_token) {
      //     console.log('[getAuthenticatedClient] New refresh token received:', newTokens.refresh_token);
      //     // Update refresh token di database/sesi Anda
      //   }
      //   if (newTokens.access_token) {
      //     console.log('[getAuthenticatedClient] New access token received:', newTokens.access_token);
      //     // Update access token di sesi Anda (mungkin perlu update JWT di next-auth)
      //   }
      // });

    } else {
      console.warn("⚠️ [getAuthenticatedClient] No active NextAuth session or accessToken found. Google API calls will likely fail due to missing authentication.");
    }
  } catch (error) {
    console.error("🔴 [getAuthenticatedClient] Error fetching NextAuth session:", error);
    console.warn("⚠️ Make sure NextAuth is properly configured and the user is logged in.");
  }


  if (!oauth2Client.credentials.access_token) {
    // Error ini akan muncul jika token tidak berhasil disetel dari sesi NextAuth
    const noTokenMsg = "🔴 CRITICAL: oauth2Client has NO access_token. This will cause 'No access, refresh token, API key...' error. Ensure NextAuth session provides a valid accessToken and it's correctly set via oauth2Client.setCredentials().";
    console.error(noTokenMsg);
    // Tidak perlu melempar error di sini; biarkan panggilan API yang sebenarnya gagal,
    // yang akan ditangkap oleh error handling di releaseActions.ts dan ditampilkan di UI.
  }

  return oauth2Client;
}

export async function getSheetsClient() {
  console.log("🔄 [getSheetsClient] Attempting to get authenticated Google Sheets client...");
  const auth = await getAuthenticatedClient();
  return google.sheets({ version: 'v4', auth });
}

export async function getDriveClient() {
  console.log("🔄 [getDriveClient] Attempting to get authenticated Google Drive client...");
  const auth = await getAuthenticatedClient();
  return google.drive({ version: 'v3', auth });
}
