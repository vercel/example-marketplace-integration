import { cookies } from "next/headers";
import { verifyToken } from "@/lib/vercel/auth";

export const getSession = async () => {
  const jar = await cookies();
  const idToken = jar.get("id-token");

  if (!idToken) {
    throw new Error("ID Token not set");
  }

  return await verifyToken(idToken.value);
};

export const createSession = async (token: string) => {
  const jar = await cookies();

  jar.set("id-token", token);
};
