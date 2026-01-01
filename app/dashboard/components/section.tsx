export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-md">
      <h2 className="mb-2 font-medium text-lg">{title}</h2>
      <div className="text-gray-600 text-sm">{children}</div>
    </div>
  );
}
