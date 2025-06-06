"use client";

import { useState } from "react";
import { requestTransferToVercelAction } from "./actions";

interface TransferToVercelRedirectProps {
  configurationId: string;
}

export default function TransferToVercelRedirect({
  configurationId,
}: TransferToVercelRedirectProps) {
  const [continueUrl, setContinueUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleTransfer() {
    setLoading(true);
    const formData = new FormData();
    formData.append("installationId", configurationId);

    try {
      const result = await requestTransferToVercelAction(formData);
      setContinueUrl(result.continueUrl);
    } catch (error: any) {
      console.error("Transfer failed:", error.message);
    }
    setLoading(false);
  }

  function handleCancel() {
    setContinueUrl(null);
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {continueUrl ? (
        <section className="p-4 border rounded text-center">
          <p className="mb-4">
            Please go to Vercel Marketplace to complete the transfer.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href={continueUrl}
              target="_blank"
              className="rounded bg-green-500 text-white px-4 py-2 inline-block"
              rel="noreferrer"
            >
              Proceed to Vercel
            </a>
            <button
              onClick={handleCancel}
              className="rounded bg-red-500 text-white px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <button
          onClick={handleTransfer}
          disabled={loading}
          className="rounded bg-blue-500 text-white px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Transfer to Vercel"}
        </button>
      )}
    </div>
  );
}
