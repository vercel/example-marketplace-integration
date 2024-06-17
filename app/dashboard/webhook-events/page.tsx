import { getSession } from "../auth";
import { getAccountInfo, getInvoice } from "@/lib/vercel/api";
import { Section } from "../components/section";
import { getWebhookEvents } from "@/lib/partner";
import { WebhookEvent } from "@/lib/vercel/schemas";

export default async function Page() {
  await getSession();

  const events = await getWebhookEvents();

  return (
    <main className="space-y-8">
      <h1 className="text-2xl font-bold mb-4">Webhook Events</h1>
      {events.length === 0 ? (
        <div className="flex justify-center items-center h-[100px]">
          <span className="text-slate-500">No events</span>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </main>
  );
}

function EventCard({ event }: { event: WebhookEvent }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-600 text-sm">ID: {event.id}</span>
      </div>
      <h2 className="text-lg font-medium mb-2">
        {event.type} ({new Date(event.createdAt).toISOString()})
      </h2>
      <details className="mt-4">
        <summary>Payload</summary>
        <pre className="overflow-scroll">
          <code>{JSON.stringify(event.payload, null, 2)}</code>
        </pre>
      </details>
    </div>
  );
}
