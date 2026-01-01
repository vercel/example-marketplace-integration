export default async function Page({
  searchParams: { configurationId },
}: {
  searchParams: { configurationId: string };
}) {
  return (
    <div className="space-y-10 p-10 text-center">
      <h1 className="font-medium text-lg">Nothing to configure here. 👀</h1>
      <h3 className="font-mono">{configurationId}</h3>
    </div>
  );
}
