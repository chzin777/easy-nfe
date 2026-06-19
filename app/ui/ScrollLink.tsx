"use client";

// Link de âncora com rolagem suave e compensação do header sticky.
// Usa scrollIntoView no elemento alvo — funciona independente de qual
// elemento é o container de scroll (window/body/documentElement).
export default function ScrollLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const comportamento: ScrollBehavior = reduz ? "auto" : "smooth";

    if (href === "#topo") {
      window.scrollTo({ top: 0, behavior: comportamento });
      history.replaceState(null, "", " ");
      return;
    }
    const alvo = document.getElementById(href.slice(1));
    if (alvo) {
      alvo.scrollIntoView({ behavior: comportamento, block: "start" });
      history.replaceState(null, "", href);
    }
  };

  return (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  );
}
