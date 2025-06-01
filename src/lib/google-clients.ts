'use server';

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

async function getAuthenticatedClient(): Promise<OAuth2Client> {
  // Data dari gambar (gunakan hanya untuk testing, sebaiknya pindah ke .env pada produksi)
  const clientId = '590594986577-rfpp6oqvc4ehihnqhnm3466ocsrj1fv.apps.googleusercontent.com';
  const clientSecret = 'GOCSPX-s70Z29SKv1PBLehLW27DSOGfLMP';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`;

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.warn("⚠️ WARNING: NEXT_PUBLIC_APP_URL belum diatur dalam .env.local.");
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // ⚠️ HARUS diatur access_token (biasanya via next-auth atau proses OAuth manual)
  if (!oauth2Client.credentials.access_token && !oauth2Client.credentials.refresh_token) {
    console.error("🔴 [getAuthenticatedClient] access_token belum tersedia.");
    console.warn("🕵️ Pastikan proses OAuth berhasil dan access_token disetel.");
  } else {
    console.log("✅ [getAuthenticatedClient] Token ditemukan. Siap digunakan.");
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