import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import jwt from "jsonwebtoken";

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
      // FastAPI(python-jose)가 HS256으로 검증할 수 있도록 직접 서명한 JWT를 발급한다.
      // next-auth v5의 encode()는 JWE(암호화)를 만들어 jwt.decode HS256과 호환되지 않음.
      const accessToken = jwt.sign(
        {
          sub: token.sub,
          email: token.email,
          provider: token.provider,
        },
        process.env.NEXTAUTH_SECRET!,
        { algorithm: "HS256", expiresIn: "30d" }
      );
      (session as { accessToken?: string }).accessToken = accessToken;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
