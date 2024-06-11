"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

const links = [
  {
    href: "/dashboard",
    segment: "",
    label: "Resources",
  },
  {
    href: "/dashboard/installation",
    segment: "installation",
    label: "Installation",
  },
  {
    href: "/dashboard/invoices",
    segment: "invoices",
    label: "Invoices",
  },
] as const;

export function Nav() {
  const segment = useSelectedLayoutSegment() ?? "";
  return (
    <ul className="flex space-x-4">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className={`hover:underline ${
              link.segment === segment ? "font-bold" : ""
            }`}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
