export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-medium mb-2">{title}</h2>
      <div className="text-gray-600 text-sm">{children}</div>
    </div>
  );
}
