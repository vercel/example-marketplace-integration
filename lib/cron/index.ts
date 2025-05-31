import { env } from "../env";

export function cronJob(
  fn: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    if (process.env.NODE_ENV !== "development") {
      const authHeader = req.headers.get("authorization");
      if (
        !authHeader ||
        authHeader.replace("Bearer ", "").trim() !== env.CRON_SECRET
      ) {
        return new Response("Unauthorized", { status: 401 });
      }
    }
    return fn(req);
  };
}
