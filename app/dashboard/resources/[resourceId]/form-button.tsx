"use client";

import { useFormStatus } from "react-dom";

export function FormButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>
) {
  const { pending } = useFormStatus();

  return <button {...props} disabled={pending} />;
}
