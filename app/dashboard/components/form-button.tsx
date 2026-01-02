"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

export const FormButton = (props: ComponentProps<"button">) => {
  const { pending } = useFormStatus();

  return <button {...props} disabled={pending || props.disabled} />;
};
