import TransferToVercelRedirect from "./transfer-to-vercel-redirect";

export default async function Page({
  searchParams: { configurationId },
}: {
  searchParams: { configurationId: string };
}) {
  return (
    <div className="space-y-10 text-center p-10">
      <h1 className="text-lg font-medium">Nothing to configure here. 👀</h1>
      <h3 className="font-mono">{configurationId}</h3>
      <TransferToVercelRedirect configurationId={configurationId} />
    </div>
  );
}
