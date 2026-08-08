export function ProgressBar({ value, tone = "accent" }: { value: number; tone?: "accent" | "success" | "warning" }) {
  const colors = {
    accent: "#1450e6",
    success: "#168b55",
    warning: "#c47a00",
  };
  const normalizedValue = Math.max(0, Math.min(100, value));

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" role="progressbar" aria-valuenow={normalizedValue} aria-valuemin={0} aria-valuemax={100}>
      <svg className="block h-full w-full" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100" height="6" rx="3" fill="#d4dff0" />
        <rect width={normalizedValue} height="6" rx="3" fill={colors[tone]} />
      </svg>
    </div>
  );
}
