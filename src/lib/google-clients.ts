
'use server';

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

// Ini adalah placeholder. Anda perlu mengimplementasikan cara mendapatkan dan menyegarkan token OAuth.
// Mungkin menggunakan library seperti next-auth atau implementasi kustom.
async function getAuthenticatedClient(): Promise<OAuth2Client> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`; // Sesuaikan jika callback Anda berbeda

  if (!clientId || !clientSecret) {
    console.error("🔴 FATAL: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in your .env.local file. Please ensure they are set correctly and restart your server.");
    throw new Error("Google API Client ID or Client Secret is not configured in .env.local. Cannot create OAuth2 client.");
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.warn("⚠️ WARNING: NEXT_PUBLIC_APP_URL is not set in .env.local. This might be needed for the redirect URI.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // !! KRITIKAL: Implementasikan pengambilan dan pengaturan token yang sebenarnya di sini !!
  // Ini adalah bagian paling penting untuk membuat koneksi API berfungsi.
  // Anda perlu mendapatkan access_token (dan idealnya refresh_token) setelah pengguna login
  // dan memberikan izin, lalu mengaturnya di oauth2Client.
  //
  // Contoh (hipotetis, sesuaikan dengan alur auth Anda, misal dengan next-auth):
  // const session = await getSession(); // Fungsi untuk mendapatkan sesi (misal dari next-auth)
  // if (session?.accessToken) {
  //   oauth2Client.setCredentials({
  //     access_token: session.accessToken,
  //     refresh_token: session.refreshToken, // Jika Anda menyimpannya
  //     // expiry_date: ... // Jika ada
  //   });
  //   console.log("🔧 OAuth2 client configured with tokens.");
  // } else {
  //   console.warn("⚠️ OAuth2 client does NOT have access tokens. API calls to Google will fail. Implement token retrieval and setting.");
  //   // Bergantung pada alur Anda, Anda mungkin ingin melempar error di sini jika tidak ada token.
  //   // Untuk saat ini, kita biarkan agar error muncul saat panggilan API.
  // }

  // Jika Anda memiliki refresh token dan access token mungkin kedaluwarsa:
  // if (oauth2Client.isTokenExpiring() && oauth2Client.credentials.refresh_token) {
  //   try {
  //     const { credentials } = await oauth2Client.refreshAccessToken();
  //     oauth2Client.setCredentials(credentials);
  //     // Simpan token baru yang di-refresh (misalnya, perbarui di database/sesi Anda)
  //     console.log("🔑 Access token refreshed successfully.");
  //   } catch (error) {
  //     console.error("🚨 Error refreshing access token:", error);
  //     // Tangani error refresh token (misalnya, minta pengguna login ulang)
  //     throw new Error("Failed to refresh access token. Please re-authenticate.");
  //   }
  // }

  console.warn("🕵️ Reminder: `getAuthenticatedClient` in `src/lib/google-clients.ts` requires full OAuth 2.0 token management (retrieval, setting, and refresh) for Google API access to function correctly. The current implementation is a placeholder.");
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
