"use client";

import type { WebhookEvent } from "@/lib/vercel/schemas";
import { failAction, failCheck, succeedAction, succeedCheck } from "./actions";

export function EventActions({ event }: { event: WebhookEvent }) {
  if (event.type === "deployment.integration.action.start") {
    return (
      <div className="mt-4 flex gap-2">
        <button
          className="border p-1"
          onClick={() => succeedAction(event)}
          type="button"
        >
          Succeed action
        </button>
        <button
          className="border p-1"
          onClick={() => failAction(event)}
          type="button"
        >
          Fail action
        </button>
      </div>
    );
  }
  if (event.type === "deployment.checkrun.start") {
    return (
      <div className="mt-4 flex gap-2">
        <button
          className="border p-1"
          onClick={() => succeedCheck(event)}
          type="button"
        >
          Succeed check
        </button>
        <button
          className="border p-1"
          onClick={() => failCheck(event)}
          type="button"
        >
          Fail check
        </button>
      </div>
    );
  }
  return null;
}
