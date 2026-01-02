import { cookies } from "next/headers";
import { type OidcClaims, verifyToken } from "@/lib/vercel/auth";

export const getSession = async () => {
  const idToken = (await cookies()).get("id-token");

  if (!idToken) {
    throw new Error("ID Token not set");
  }

  return await verifyToken(idToken.value);
};

export const createSession = async (token: string) => {
  (await cookies()).set("id-token", token);
};
