import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
  variant?: "primary" | "quiet";
};

export function IconButton({
  label,
  icon,
  variant = "quiet",
  className = "",
  ...buttonProps
}: IconButtonProps) {
  return (
    <button
      className={`icon-button icon-button--${variant} ${className}`.trim()}
      type="button"
      aria-label={label}
      title={label}
      {...buttonProps}
    >
      {icon}
    </button>
  );
}
