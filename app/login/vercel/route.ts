import { maybeStartAuthorizationAuto } from "./actions";

export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  await maybeStartAuthorizationAuto(params);

  return Response.redirect(new URL("/login/vercel/prompt", req.url), 307);
}
