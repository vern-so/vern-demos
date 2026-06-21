"use client";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  loading?: boolean;
};

export function Button({ variant = "primary", loading, children, className = "", disabled, ...rest }: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "text-[var(--brand-fg)] hover:brightness-95"
      : variant === "secondary"
        ? "bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
        : variant === "outline"
          ? "border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          : "text-zinc-500 hover:text-zinc-800";
  return (
    <button
      type={rest.type ?? "button"}
      className={`${base} ${styles} ${className}`}
      style={variant === "primary" ? { background: "var(--brand)" } : undefined}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
