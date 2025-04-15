import { OidcClaims, verifyToken } from "@/lib/vercel/auth";
import { cookies } from "next/headers";

export async function getSession(): Promise<OidcClaims> {
  // const idToken = cookies().get("id-token");

  // if (!idToken) {
  //   throw new Error("ID Token not set");
  // }

  // return await verifyToken(idToken.value);
  return {
    iss: "https://marketplace.vercel.com",
    sub: "account:bbab27ce0645afd2c628cf5432ed30a7bf16506c9f55e156a84443d1df17d147:user:105cd395279d04025d3e3ab92124b0c51257ee2107da24a75344ec023d469e81",
    aud: "oac_lwzCwu4BrkUh332AG7gVZ63k",
    installation_id: "icfg_MYtOwkOajEA9ONYlcUe3Yyqt",
    account_id:
      "bbab27ce0645afd2c628cf5432ed30a7bf16506c9f55e156a84443d1df17d147",
    user_id: "105cd395279d04025d3e3ab92124b0c51257ee2107da24a75344ec023d469e81",
    user_role: "ADMIN",
    user_name: "Vanessa Teo",
    nbf: 1744240557,
    iat: 1744240557,
    exp: 17442441570,
  };
}

export async function createSession(token: string) {
  cookies().set("id-token", token);
}
