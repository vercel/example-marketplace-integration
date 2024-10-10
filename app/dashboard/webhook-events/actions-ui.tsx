"use client";

import { WebhookEvent } from "@/lib/vercel/schemas";
import { failAction, succeedAction } from "./actions";

export function EventActions({ event }: { event: WebhookEvent }) {
  if (event.type === "deployment.integration.action.start") {
    return (
      <div className="mt-4 flex gap-2">
        <button className="border p-1" onClick={() => succeedAction(event)}>
          Succeed action
        </button>
        <button className="border p-1" onClick={() => failAction(event)}>
          Fail action
        </button>
      </div>
    );
  }
  return null;
}
