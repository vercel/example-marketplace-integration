import TransferToVercelRedirect from "./transfer-to-vercel-redirect";

export default async function Page({
  searchParams: { configurationId },
}: {
  searchParams: { configurationId: string };
}) {
  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="flex items-center justify-between border-b pb-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-100"></div>
          <h1 className="text-2xl font-bold text-blue-600">ACME Corp</h1>
        </div>
        <div className="font-mono text-sm ">
          Configuration ID: {configurationId}
        </div>
        <div className="text-lg font-medium">ACME</div>
      </div>

      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Billing</h1>
          <p className="text-gray-500 text-lg">
            Manage your billing information and payment methods
          </p>
        </div>

        <div className="border-b mb-6">
          <div className="flex space-x-6">
            <button className="py-2 px-1 border-b-2 border-black font-medium">
              Payment Methods
            </button>
            <button className="py-2 px-1 text-gray-500">Billing History</button>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="pb-3 mb-4">
            <h2 className="text-2xl font-semibold">Payment Methods</h2>
            <p className="text-gray-500 text-base">
              Manage your payment methods for ACME services
            </p>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between p-4 border rounded-lg mb-6">
              <div className="flex items-center gap-4">
                <div>
                  <div className="font-medium">Visa ending in 4242</div>
                  <div className="text-gray-500">Expires 04/2025</div>
                </div>
              </div>
              <button className="px-4 py-2 border rounded-md" disabled={true}>
                Edit
              </button>
            </div>

            <button className="w-full py-2 border rounded-md" disabled={true}>
              Add Payment Method
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="pb-3 mb-4">
            <h2 className="text-2xl font-semibold">Account Ownership</h2>
            <p className="text-gray-500 text-base">
              Transfer your account ownership and billing to your Vercel team
            </p>
          </div>

          <div className="space-y-6">
            <p className="text-gray-600">
              Transferring ownership will move all billing responsibilities to
              the selected Vercel team.
            </p>

            <TransferToVercelRedirect configurationId={configurationId} />
          </div>
        </div>
      </div>
    </div>
  );
}
