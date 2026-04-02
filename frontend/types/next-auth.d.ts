import "next-auth";

declare module "next-auth" {
  interface Session {
    /** HS256 JWT — pass as `Authorization: Bearer <accessToken>` to FastAPI */
    accessToken: string;
  }
}
