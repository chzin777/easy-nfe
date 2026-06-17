"use client";

/**
 * Loader em formato de raio (lightning bolt) sendo preenchido de baixo p/ cima,
 * em loop. Usado em todo o site enquanto dados carregam.
 *
 * - `size`  : px do raio (default 48)
 * - `texto` : legenda opcional abaixo do raio
 * - `inline`: renderiza só o ícone, sem o wrapper centralizado/padding
 * - `overlay`: cobre o container pai (precisa de `relative` no pai)
 */
export default function LightningLoader({
  size = 48,
  texto,
  inline = false,
  overlay = false,
  className = "",
}: {
  size?: number;
  texto?: string;
  inline?: boolean;
  overlay?: boolean;
  className?: string;
}) {
  const bolt =
    "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z";
  const id = `ll-${size}`;

  const icone = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="status"
      aria-label="Carregando"
      className={inline ? className : ""}
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={bolt} />
        </clipPath>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary, #4f46e5)" />
          <stop offset="100%" stopColor="var(--primary-2, #7c3aed)" />
        </linearGradient>
      </defs>

      {/* trilho do raio (vazio) */}
      <path d={bolt} fill="var(--border, #e2e8f0)" opacity="0.55" />

      {/* preenchimento que sobe em loop */}
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="0" width="24" fill={`url(#${id}-grad)`}>
          <animate attributeName="y" values="24;0" dur="1.1s" repeatCount="indefinite" />
          <animate attributeName="height" values="0;24" dur="1.1s" repeatCount="indefinite" />
        </rect>
      </g>

      {/* contorno */}
      <path
        d={bolt}
        fill="none"
        stroke="var(--primary, #4f46e5)"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );

  if (inline) return icone;

  const conteudo = (
    <div className="flex flex-col items-center justify-center gap-2">
      {icone}
      {texto && <span className="text-sm font-medium text-[var(--muted)]">{texto}</span>}
    </div>
  );

  if (overlay) {
    return (
      <div className={"absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] bg-white/70 backdrop-blur-[1px] " + className}>
        {conteudo}
      </div>
    );
  }

  return <div className={"flex items-center justify-center py-10 " + className}>{conteudo}</div>;
}
