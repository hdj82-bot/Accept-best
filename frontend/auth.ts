import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import { SignJWT, jwtVerify } from "jose";

/**
 * JWT encode/decode overridden to produce plain HS256 JWTs.
 * This ensures FastAPI (python-jose) can verify tokens with the same NEXTAUTH_SECRET.
 * Payload always includes `sub` (user email) as required by academi.md.
 */
function getSecretKey(secret: string | string[]): Uint8Array {
  const raw = Array.isArray(secret) ? secret[0] : secret;
  return new TextEncoder().encode(raw);
}

export const config: NextAuthConfig = {
  providers: [Google, Kakao],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      // On first sign-in, user object is present — persist email as sub
      if (user?.email) {
        token.sub = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      // Re-sign the JWT payload so the client can attach it to FastAPI requests
      const key = getSecretKey(process.env.NEXTAUTH_SECRET ?? "");
      const payload = (token ?? {}) as Record<string, unknown>;
      session.accessToken = await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60)
        .sign(key);
      return session;
    },
  },
  jwt: {
    // Encode: produce a plain HS256 JWT instead of the default JWE
    encode: async ({ token, secret, maxAge }) => {
      const key = getSecretKey(secret);
      const payload = (token ?? {}) as Record<string, unknown>;
      return new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(
          Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60)
        )
        .sign(key);
    },
    // Decode: verify the HS256 JWT
    decode: async ({ token, secret }) => {
      if (!token) return null;
      const key = getSecretKey(secret);
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ["HS256"],
        });
        return payload;
      } catch {
        return null;
      }
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
