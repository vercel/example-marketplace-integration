import { getWebhookEvents } from "@/lib/partner";
import type { WebhookEvent } from "@/lib/vercel/schemas";
import { getSession } from "../auth";
import { EventActions } from "./actions-ui";

export const dynamic = "force-dynamic";

const WebhookEventsPage = async () => {
  await getSession();

  const events = await getWebhookEvents();

  return (
    <main className="space-y-8">
      <h1 className="mb-4 font-bold text-2xl">Webhook Events</h1>
      {events.length === 0 ? (
        <div className="flex h-[100px] items-center justify-center">
          <span className="text-muted-foreground">No events</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((event) => (
            <EventCard event={event} key={event.id} />
          ))}
        </div>
      )}
    </main>
  );
};

const EventCard = ({ event }: { event: WebhookEvent }) => (
  <div className="rounded-lg bg-white p-4 shadow-md">
    <div className="mb-2 flex items-center justify-between">
      <span className="text-muted-foreground text-sm">ID: {event.id}</span>
    </div>
    <h2 className="mb-2 font-medium text-lg">
      {event.type} {event.unknown ? "(unknown)" : ""} (
      {new Date(event.createdAt).toISOString()})
    </h2>
    <details className="mt-4">
      <summary>Payload</summary>
      <pre className="overflow-scroll">
        <code>{JSON.stringify(event.payload, null, 2)}</code>
      </pre>
    </details>
    <EventActions event={event} />
  </div>
);

export default WebhookEventsPage;
