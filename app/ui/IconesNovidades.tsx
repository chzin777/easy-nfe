import type { Novidade } from "@/lib/novidades";

// Desenhos das novidades. Ficam separados porque o carrossel do painel é
// componente de cliente e a landing é de servidor — os dois importam daqui.
const CAMINHOS: Record<Novidade["icone"], string> = {
  servico: "M14.7 6.3a4 4 0 0 1 5 5L18 13l-7 7-5-5 7-7 1.7-1.7Z M5 19h.01",
  lista: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  espelho: "M14 3v5h5M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z M9 14h6M9 17h4",
  catalogo: "M4 5a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5Z M8 7h6M8 11h6",
  empresa: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 11h.01M15 11h.01",
  entrada: "M4 13h4l2 3h4l2-3h4M4 13 6 5h12l2 8v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6Z",
  tutorial: "M12 3 2 8l10 5 10-5-10-5ZM6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5",
};

export default function IconeNovidade({
  icone,
  className = "h-5 w-5",
}: {
  icone: Novidade["icone"];
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {CAMINHOS[icone].split(" M").map((d, i) => (
        <path key={i} d={i === 0 ? d : "M" + d} />
      ))}
    </svg>
  );
}
