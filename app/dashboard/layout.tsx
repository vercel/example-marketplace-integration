export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="w-[800px] mx-auto p-8">{children}</div>;
}
