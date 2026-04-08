import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { encode } from "next-auth/jwt";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30일
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.provider = account.provider;
        token.email = profile.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      // JWT를 인코딩하여 accessToken으로 전달 (FastAPI에서 HS256 검증)
      const accessToken = await encode({
        token,
        secret: process.env.NEXTAUTH_SECRET!,
      });
      (session as any).accessToken = accessToken;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
