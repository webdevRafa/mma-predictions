import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-fl-accent text-fl-bg shadow-[0_10px_28px_rgba(241,64,29,0.2)] hover:bg-fl-accent-strong",
  secondary:
    "border border-fl-border bg-fl-surface-2 text-fl-text hover:border-fl-text-muted hover:bg-fl-surface-3",
  ghost: "text-fl-text-muted hover:bg-fl-surface-2 hover:text-fl-text",
  danger: "bg-fl-danger text-white hover:brightness-110",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-sm",
};

export function Button({
  className,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[10px] font-bold tracking-[0.01em] transition disabled:cursor-not-allowed disabled:opacity-45",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
