
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string | null; // Make id optional or always string based on your token.sub
      accessToken?: string | null;
      refreshToken?: string | null;
    } & DefaultSession["user"];
    accessToken?: string | null; // For easier access at session level if preferred
    error?: string | null;
  }

  interface User extends DefaultUser {
    accessToken?: string | null;
    refreshToken?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accessToken?: string | null;
    refreshToken?: string | null;
    accessTokenExpires?: number | null;
    // You can add id here if you want to store it directly in JWT from profile
    // id?: string; 
  }
}
