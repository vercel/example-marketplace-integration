import { OidcClaims, verifyToken } from "@/lib/vercel/auth";
import { cookies } from "next/headers";

export async function getSession(): Promise<OidcClaims> {
	const idToken = (await cookies()).get("id-token");

	if (!idToken) {
		throw new Error("ID Token not set");
	}

	return await verifyToken(idToken.value);
}

export async function createSession(token: string) {
	(await cookies()).set("id-token", token);
}
