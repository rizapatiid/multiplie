
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import type { NextAuthOptions, Account, Profile } from "next-auth"
import type { JWT } from "next-auth/jwt"

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
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account }: { token: JWT; account: Account | null }): Promise<JWT> {
      // Persist the OAuth access_token and refresh_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        // Calculate expiry time if expires_at is provided
        if (account.expires_at) {
            token.accessTokenExpires = account.expires_at * 1000; // Convert to milliseconds
        }
        // console.log("[NextAuth JWT Callback] Account present, token updated:", token);
      }
      // TODO: Implement token refresh logic here if needed
      // Example: if (Date.now() < (token.accessTokenExpires as number)) return token;
      // return await refreshAccessToken(token);
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }): Promise<any> {
      // Send properties to the client, like an access_token and user id from a provider.
      session.user.accessToken = token.accessToken;
      session.user.refreshToken = token.refreshToken;
      session.user.id = token.sub; // Use `sub` (subject) from token as user id
      // console.log("[NextAuth Session Callback] Session updated:", session);
      return session;
    }
  },
  // Optional: Add debug true for development
  // debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
