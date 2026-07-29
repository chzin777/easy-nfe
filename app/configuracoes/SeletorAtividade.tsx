"use client";

// O que a empresa faz. É isso que decide qual inscrição o cadastro cobra:
// quem vende mercadoria precisa da estadual, quem presta serviço precisa da
// municipal, e quem faz as duas coisas (oficina, gráfica) precisa das duas.

export type Atividade = "comercio" | "servico" | "ambos";

export const exigeIE = (a: string) => a !== "servico";
export const exigeIM = (a: string) => a !== "comercio";

const OPCOES: { valor: Atividade; titulo: string; descricao: string; icone: string }[] = [
  { valor: "comercio", titulo: "Comércio", descricao: "Vende mercadoria — NF-e e NFC-e", icone: "M3 9h18l-1.5 10.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 9Zm5 0V6a4 4 0 0 1 8 0v3" },
  { valor: "servico", titulo: "Serviço", descricao: "Presta serviço — NFS-e", icone: "M14.7 6.3a4 4 0 0 1 5 5L18 13l-7 7-5-5 7-7 1.7-1.7Z" },
  { valor: "ambos", titulo: "Os dois", descricao: "Mercadoria e serviço — ex.: oficina", icone: "M4 7h16M4 12h16M4 17h16" },
];

export default function SeletorAtividade({
  valor,
  onChange,
}: {
  valor: string;
  onChange: (v: Atividade) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium">
        O que a empresa faz? <span className="text-[var(--danger)]">*</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {OPCOES.map((o) => {
          const ativo = valor === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() => onChange(o.valor)}
              aria-pressed={ativo}
              className={
                "rounded-xl border p-3 text-left transition " +
                (ativo
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] shadow-sm"
                  : "border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-slate-50")
              }
            >
              <div className="flex items-center gap-2">
                <svg
                  width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={ativo ? "text-[var(--primary)]" : "text-[var(--muted)]"}
                >
                  <path d={o.icone} />
                </svg>
                <span className={"text-sm font-semibold " + (ativo ? "text-[var(--primary)]" : "")}>
                  {o.titulo}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">{o.descricao}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {exigeIE(valor) && exigeIM(valor)
          ? "Vamos pedir a inscrição estadual e a municipal."
          : exigeIE(valor)
            ? "Vamos pedir a inscrição estadual."
            : "Vamos pedir a inscrição municipal."}
      </p>
    </div>
  );
}
