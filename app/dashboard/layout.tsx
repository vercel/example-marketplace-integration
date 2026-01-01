import { getInstallation } from "@/lib/partner";
import { getAccountInfo } from "@/lib/vercel/marketplace-api";
import { getSession } from "./auth";
import { Nav } from "./nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const account = await getAccountInfo(session.installation_id);
  const installation = await getInstallation(session.installation_id);

  return (
    <div className="mx-auto w-[800px]">
      <header className="bg-blue-100 p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-row items-center gap-4">
            <div className="flex flex-row items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Logo" className="h-6" src="/logo.png" />
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
                style={{ color: "", width: 22, height: 22 }}
                viewBox="0 0 24 24"
                width="24"
              >
                <path d="M16.88 3.549L7.12 20.451" />
              </svg>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Logo" className="h-5" src="/vlogo.svg" />
            </div>
            <h1 className="font-bold text-xl">
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
              className="h-7 w-7 rounded-full"
              src={
                session.user_avatar_url || "https://vercel.com/api/www/avatar"
              }
            />
          </div>
        </div>
        <nav className="mt-4">
          <Nav />
        </nav>
      </header>
      <main className="container mx-auto p-4">{children}</main>
    </div>
  );
}
