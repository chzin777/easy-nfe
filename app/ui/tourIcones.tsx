// Ícones dos tutoriais. Ficam fora de tours.ts para aquele arquivo continuar
// sendo só texto — quem for revisar o conteúdo não precisa passar por SVG.
const P = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconCaixa = (
  <svg {...P}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
);

export const IconPessoa = (
  <svg {...P}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);

export const IconCaminhao = (
  <svg {...P}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></svg>
);

export const IconArquivo = (
  <svg {...P}><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v6h6" /></svg>
);

export const IconGrafico = (
  <svg {...P}><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>
);

export const IconDinheiro = (
  <svg {...P}><circle cx="12" cy="12" r="9" /><path d="M15 9.5a3 3 0 0 0-3-1.5c-1.7 0-3 .9-3 2s1.3 2 3 2 3 .9 3 2-1.3 2-3 2a3 3 0 0 1-3-1.5" /><path d="M12 6v12" /></svg>
);

export const IconLista = (
  <svg {...P}><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>
);

export const IconEntrada = (
  <svg {...P}><path d="M4 4v16" /><path d="M9 12h11" /><path d="m16 8 4 4-4 4" /></svg>
);

export const IconCarrinho = (
  <svg {...P}><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h2l2.6 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 7H5" /></svg>
);

export const IconFerramenta = (
  <svg {...P}><path d="M14.7 6.3a4 4 0 0 1 5 5L18 13l-7-7 1.7-1.7a4 4 0 0 1 2-.9" /><path d="m11 6-7 7 4 4 7-7" /><path d="m3 21 3-3" /></svg>
);

// Sliders em vez de engrenagem: menos traço, legível no tamanho pequeno.
export const IconEngrenagem = (
  <svg {...P}><path d="M4 21v-7" /><path d="M4 10V3" /><path d="M12 21v-9" /><path d="M12 8V3" /><path d="M20 21v-5" /><path d="M20 12V3" /><path d="M1 14h6" /><path d="M9 8h6" /><path d="M17 16h6" /></svg>
);

export const IconAlerta = (
  <svg {...P}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
);
