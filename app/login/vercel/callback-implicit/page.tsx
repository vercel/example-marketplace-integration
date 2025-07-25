"use client";

import { useEffect, useState, useTransition } from "react";
import { validateImplicitAuthorizationAction } from "./actions";
import { set } from "lodash";

export default function ImplicitOidcCallbackPage() {
  const [oidcParams, setOidcParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace("#", "?"));
      setOidcParams(Object.fromEntries(params));
    }
  }, []);

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [claims, setClaims] = useState<Record<string, any> | null>(null);

  const handleValidate = () => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await validateImplicitAuthorizationAction(oidcParams);
        setClaims(response.claims);
      } catch {
        setError("Failed to validate OIDC authorization");
      }
    });
  };

  return (
    <div className="bg-gray-100 h-screen flex items-center justify-center">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 w-full max-w-sm flex flex-col gap-4">
        <h1 className="block text-gray-700 text-xl font-bold mb-6 text-center">
          Implicit OIDC Callback
        </h1>
        <pre>{JSON.stringify(oidcParams, null, 2)}</pre>
        <form method="POST" action={handleValidate}>
          <button
            type="submit"
            disabled={isPending || !oidcParams.id_token}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Validate response
          </button>
        </form>
        <div>
          {isPending ? (
            <p>Validating...</p>
          ) : claims ? (
            <pre>{JSON.stringify(claims, null, 2)}</pre>
          ) : (
            <div />
          )}
        </div>
        {error ? <div className="bg-red-600">{error}</div> : null}
      </div>
    </div>
  );
}
