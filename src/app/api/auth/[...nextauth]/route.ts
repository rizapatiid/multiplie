
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import type { NextAuthOptions, Account, Profile } from "next-auth"
import type { JWT } from "next-auth/jwt"

// Tambahkan console.log di level atas untuk memastikan file ini dimuat
console.log("[NextAuth Route] File loaded. GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "Set" : "NOT SET");
console.log("[NextAuth Route] GOOGLE_CLIENT_SECRET:", process.env.GOOGLE_CLIENT_SECRET ? "Set" : "NOT SET");
console.log("[NextAuth Route] NEXTAUTH_URL:", process.env.NEXTAUTH_URL || "NOT SET");
console.log("[NextAuth Route] NEXTAUTH_SECRET:", process.env.NEXTAUTH_SECRET ? "Set (length: " + process.env.NEXTAUTH_SECRET.length + ")" : "NOT SET");


export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file"
          // Pastikan scope drive.file sudah cukup, atau gunakan drive jika perlu akses lebih luas
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile }: { token: JWT; account: Account | null; profile?: Profile }): Promise<JWT> {
      console.log("[NextAuth JWT Callback] Fired. Account present:", !!account);
      if (account) { // Hanya saat sign-in pertama kali setelah otentikasi berhasil
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token; // Penting untuk akses offline
        if (account.expires_at) {
          token.accessTokenExpires = account.expires_at * 1000; // expires_at dalam detik, ubah ke ms
        }
        token.id = profile?.sub || account.providerAccountId; // Menyimpan ID pengguna Google
        console.log("[NextAuth JWT Callback] Token updated with accessToken, refreshToken, expires_at, id.");
      }
      // Tambahkan logika untuk refresh token di sini jika diperlukan,
      // namun NextAuth dengan Google Provider biasanya menangani ini dengan baik jika refresh_token ada.
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }): Promise<any> {
      console.log("[NextAuth Session Callback] Fired. Token accessToken present:", !!token.accessToken);
      // Kirim properti ke klien, seperti accessToken dan id pengguna dari token JWT.
      session.user.accessToken = token.accessToken;
      session.user.refreshToken = token.refreshToken; // Kirim juga refresh token jika diperlukan oleh klien
      session.user.id = token.id || token.sub; // Ambil id yang disimpan di JWT
      // session.accessTokenExpires = token.accessTokenExpires; // Jika ingin mengirim info kedaluwarsa ke client
      console.log("[NextAuth Session Callback] Session object updated:", { userId: session.user.id, hasAccessToken: !!session.user.accessToken });
      return session;
    }
  },
  debug: process.env.NODE_ENV === 'development', // Aktifkan debug mode untuk pengembangan
  pages: {
    // signIn: '/auth/signin', // Jika Anda punya halaman sign-in kustom
    error: '/auth/error', // Halaman untuk menampilkan error (opsional, NextAuth punya default)
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
