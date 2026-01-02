import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  children: ReactNode;
}

export const Section = ({ title, children }: SectionProps) => (
  <div className="rounded-lg bg-white p-4 shadow-md">
    <h2 className="mb-2 font-medium text-lg">{title}</h2>
    <div className="text-gray-600 text-sm">{children}</div>
  </div>
);
