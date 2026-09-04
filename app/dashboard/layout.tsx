import { getInstallation } from "@/lib/partner";
import { listChildInstallations } from "@/lib/partner/organizations";
import { getAccountInfo } from "@/lib/vercel/marketplace-api";
import { getSession } from "./auth";
import { Nav } from "./nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const [account, installation, childInstallations] = await Promise.all([
    getAccountInfo(session.installation_id),
    getInstallation(session.installation_id),
    listChildInstallations(session.installation_id),
  ]);

  return (
    <div className="w-[800px] mx-auto">
      <header className="bg-blue-100 p-4">
        <div className="flex justify-between items-center">
          <div className="flex flex-row gap-4 items-center">
            <div className="flex flex-row items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Logo" className="h-6" />
              <svg
                className="h-6"
                data-testid="geist-icon"
                fill="none"
                height="24"
                shape-rendering="geometricPrecision"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                viewBox="0 0 24 24"
                width="24"
                style={{ color: "", width: 22, height: 22 }}
              >
                <path d="M16.88 3.549L7.12 20.451" />
              </svg>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/vlogo.svg" alt="Logo" className="h-5" />
            </div>
            <h1 className="text-xl font-bold">
              {`${account.name}'s`} Dashboard
              {installation?.deletedAt ? (
                <>
                  {" "}
                  <span className="text-red-500">
                    (deleted on{" "}
                    {new Date(installation.deletedAt).toLocaleString()})
                  </span>
                </>
              ) : null}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span>{session.user_name || "Unknown"}</span>
            <img
              alt="Avatar"
              src={
                session.user_avatar_url || "https://vercel.com/api/www/avatar"
              }
              className="w-7 h-7 rounded-full"
            />
          </div>
        </div>
        <nav className="mt-4">
          <Nav />
        </nav>
        {installation.organization ? (
          <div className="mt-4 rounded border border-blue-300 bg-white/70 p-3 text-sm">
            <strong>Organization child</strong>
            <div>
              Parent account:{" "}
              {installation.organization.parentAccountId ??
                "Missing attribution"}
            </div>
            <div>
              Parent installation:{" "}
              {installation.organization.parentInstallationId ??
                "Missing attribution"}
            </div>
          </div>
        ) : childInstallations.length > 0 ? (
          <div className="mt-4 rounded border border-blue-300 bg-white/70 p-3 text-sm">
            <strong>Organization parent</strong>
            <div>
              {childInstallations.length} child installation
              {childInstallations.length === 1 ? "" : "s"}
            </div>
          </div>
        ) : null}
      </header>
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
}
