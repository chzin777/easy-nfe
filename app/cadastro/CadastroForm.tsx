"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import Portao from "@/app/ui/Portao";
import { formatBRL } from "@/lib/format";
import PagamentoCliente from "@/app/pagar/PagamentoCliente";
import {
  cadastrarTrial,
  cadastrarAssinatura,
  criarLead,
  type CadastroResultado,
  type AssinaturaResultado,
  type LeadResultado,
} from "./actions";
import type { PlanoOpcao } from "./page";

type Modo = "trial" | "assinatura" | "contato";

/* Quantos benefícios cada cartão mostra na escolha de plano. Quatro é o que
   cabe na fileira sem o cartão passar da curva na tela de 1080. */
const VISIVEIS = 4;

/**
 * CADASTRO — mesma casca do login (o Portão), com os quatro estados desta
 * tela dentro da curva: escolher plano, assinar, testar grátis e falar com
 * a equipe. Os campos usam os mesmos rótulos em mono do login.
 */
export default function CadastroForm({
  planos = [],
  selecionado: selProp,
  querTrial = false,
}: {
  planos?: PlanoOpcao[];
  selecionado: PlanoOpcao | null;
  querTrial?: boolean;
}) {
  // Plano selecionado: vem da URL ("Começar agora") ou é escolhido nesta tela.
  const [sel, setSel] = useState<PlanoOpcao | null>(selProp);
  // Decide o modo inicial:
  // - plano sob consulta → contato
  // - veio do botão "Testar grátis" (e o plano permite) → trial
  // - plano pago escolhido → assinatura (gera link de pagamento)
  // - sem plano → trial (só usado depois de escolher)
  const modoInicial: Modo = selProp?.sobConsulta
    ? "contato"
    : querTrial
      ? "trial"
      : selProp
        ? "assinatura"
        : "trial";
  const [modo, setModo] = useState<Modo>(modoInicial);
  const [aceite, setAceite] = useState(false);

  // Escolha de plano nesta tela (acesso direto a /cadastro, sem vir da landing).
  function escolherPlano(p: PlanoOpcao, intencao: "trial" | "assinatura") {
    setSel(p);
    setModo(p.sobConsulta ? "contato" : intencao === "trial" && p.permiteTrial ? "trial" : "assinatura");
  }

  const [trialState, trialAction, trialPend] = useActionState<CadastroResultado | null, FormData>(cadastrarTrial, null);
  const [assinState, assinAction, assinPend] = useActionState<AssinaturaResultado | null, FormData>(cadastrarAssinatura, null);
  const [leadState, leadAction, leadPend] = useActionState<LeadResultado | null, FormData>(criarLead, null);

  const trialErro = trialState && "erro" in trialState ? trialState.erro : null;
  const assinErro = assinState && "erro" in assinState ? assinState.erro : null;
  const leadErro = leadState && "erro" in leadState ? leadState.erro : null;
  const leadOk = leadState && "ok" in leadState;
  const assinOk = assinState && "ok" in assinState ? assinState : null;

  useEffect(() => {
    if (trialState && "ok" in trialState) window.location.href = trialState.destino;
  }, [trialState]);

  const selecionado = sel;
  const planoNomeSel = selecionado?.nome ?? "";
  const podeTrial = !!selecionado?.permiteTrial;
  const temPreco = (selecionado?.preco ?? 0) > 0;
  // Sem plano escolhido e há planos p/ exibir → mostra o seletor primeiro.
  const precisaEscolher = !selecionado && planos.length > 0;

  return (
    <Portao alto={!precisaEscolher} largo={!precisaEscolher} planos={precisaEscolher}>
      {assinOk ? (
        <>
          <h1 className="portao__titulo">Conta criada. Falta pagar</h1>
          <p className="portao__linha">
            Escolha Pix ou boleto abaixo. Seu acesso já está liberado — pode pagar agora ou pelo
            link a qualquer momento.
          </p>
          <div className="mt-7">
            <PagamentoCliente token={assinOk.token} />
          </div>
          <a href={assinOk.destino} className="portao__elo mt-5 inline-block text-sm font-medium">
            Pular e ir para o sistema →
          </a>
        </>
      ) : precisaEscolher ? (
        <>
          <h1 className="portao__titulo">Escolha seu plano</h1>
          <p className="portao__linha">Depois é só preencher seus dados e começar.</p>

          <div className="planos-fila">
            {planos.map((p) => (
              <div key={p.id} className="plano-cartao">
                <div className="plano-cartao__topo">
                  <span className="plano-cartao__nome">{p.nome}</span>
                  {p.sobConsulta ? (
                    <span className="plano-cartao__consulta">Sob consulta</span>
                  ) : (
                    <span className="plano-cartao__preco">
                      {formatBRL(p.preco)}
                      <span>/{p.periodicidade === "anual" ? "ano" : "mês"}</span>
                    </span>
                  )}
                </div>
                {p.beneficios.length > 0 && (
                  <>
                    {/* Só os primeiros itens: a fileira fica dentro da curva, e
                        um plano com lista longa esticaria o arco para fora dela. */}
                    <ul className="plano-cartao__lista">
                      {p.beneficios.slice(0, VISIVEIS).map((b, j) => (
                        <li key={j}>
                          <Visto />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                    {p.beneficios.length > VISIVEIS && (
                      <p className="plano-cartao__mais">+{p.beneficios.length - VISIVEIS} benefícios</p>
                    )}
                  </>
                )}
                <div className="plano-cartao__acoes">
                  {p.sobConsulta ? (
                    <button type="button" className="plano-cartao__botao plano-cartao__botao--fantasma" onClick={() => escolherPlano(p, "assinatura")}>
                      Falar com a equipe
                    </button>
                  ) : (
                    <>
                      <button type="button" className="plano-cartao__botao" onClick={() => escolherPlano(p, "assinatura")}>
                        Assinar
                      </button>
                      {p.permiteTrial && (
                        <button type="button" className="plano-cartao__botao plano-cartao__botao--fantasma" onClick={() => escolherPlano(p, "trial")}>
                          Testar grátis 7 dias
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : modo === "assinatura" ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <h1 className="portao__titulo">Criar conta e assinar</h1>
            {planos.length > 1 && (
              <button type="button" onClick={() => setSel(null)} className="portao__elo mt-8 shrink-0 text-xs font-medium">
                Trocar plano
              </button>
            )}
          </div>
          <p className="portao__linha">
            Confira o plano e crie sua conta. Depois você escolhe Pix ou boleto.
          </p>

          <div className="resumo">
            <p className="resumo__medida">Você está contratando</p>
            <div className="resumo__linha">
              <span className="resumo__nome">{planoNomeSel || "Plano"}</span>
              {temPreco && (
                <span className="resumo__preco">
                  {formatBRL(selecionado!.preco)}
                  <span>/{selecionado!.periodicidade === "anual" ? "ano" : "mês"}</span>
                </span>
              )}
            </div>
            <p className="resumo__nota">
              Cobrança recorrente {selecionado?.periodicidade === "anual" ? "anual" : "mensal"}. Cancele quando quiser.
            </p>
          </div>

          <form action={assinAction} className="portao__forma">
            <Campo rotulo="Nome" nome="nome" placeholder="Seu nome" autoComplete="name" required />
            <Campo rotulo="CPF/CNPJ" dica="usado na cobrança" nome="cpfCnpj" placeholder="Somente números" inputMode="numeric" required />
            <Campo rotulo="E-mail" nome="email" tipo="email" placeholder="voce@empresa.com" autoComplete="email" required />
            <Campo rotulo="Telefone" dica="WhatsApp" nome="telefone" placeholder="(00) 00000-0000" autoComplete="tel" />
            <Campo rotulo="Senha" dica="mín. 8 caracteres" nome="senha" tipo="password" placeholder="••••••••" autoComplete="new-password" required />
            <input type="hidden" name="planoId" value={selecionado?.id ?? ""} />

            <Aceite marcado={aceite} aoMudar={setAceite} />

            {assinErro && <Aviso>{assinErro}</Aviso>}

            <button type="submit" className="botao--cheio" disabled={assinPend || !aceite}>
              {assinPend
                ? "Criando conta…"
                : temPreco
                  ? `Continuar para o pagamento · ${formatBRL(selecionado!.preco)}`
                  : "Criar conta e continuar"}
            </button>
            <p className="text-center text-[11px] text-[var(--muted)]">
              Nada é cobrado automaticamente — você escolhe Pix ou boleto na próxima etapa.
            </p>
          </form>

          <div className="portao__troca">
            {podeTrial && (
              <p>
                Prefere testar antes?{" "}
                <button type="button" onClick={() => setModo("trial")}>Teste grátis por 7 dias</button>
              </p>
            )}
            <p>
              Quer falar antes?{" "}
              <button type="button" onClick={() => setModo("contato")}>Fale com nossa equipe</button>
            </p>
          </div>
        </>
      ) : modo === "trial" ? (
        <>
          <h1 className="portao__titulo">Teste grátis por 7 dias</h1>
          <p className="portao__linha">Sem cartão. Crie sua conta e comece a emitir no plano Básico.</p>

          <form action={trialAction} className="portao__forma">
            <Campo rotulo="Nome" nome="nome" placeholder="Seu nome" autoComplete="name" required />
            <Campo rotulo="CPF/CNPJ" dica="usado na cobrança ao assinar" nome="cpfCnpj" placeholder="Somente números" inputMode="numeric" required />
            <Campo rotulo="E-mail" nome="email" tipo="email" placeholder="voce@empresa.com" autoComplete="email" required />
            <Campo rotulo="Telefone" dica="WhatsApp" nome="telefone" placeholder="(00) 00000-0000" autoComplete="tel" />
            <Campo rotulo="Senha" dica="mín. 8 caracteres" nome="senha" tipo="password" placeholder="••••••••" autoComplete="new-password" required />

            {trialErro && <Aviso>{trialErro}</Aviso>}

            <button type="submit" className="botao--cheio" disabled={trialPend}>
              {trialPend ? "Criando conta…" : "Começar teste grátis"}
            </button>
          </form>

          <div className="portao__troca">
            {temPreco && (
              <p>
                Já quer assinar?{" "}
                <button type="button" onClick={() => setModo("assinatura")}>Assinar e pagar agora</button>
              </p>
            )}
            <p>
              Prefere conversar antes?{" "}
              <button type="button" onClick={() => setModo("contato")}>Fale com nossa equipe</button>
            </p>
          </div>
        </>
      ) : leadOk ? (
        <>
          <h1 className="portao__titulo">Recebemos seu contato</h1>
          <p className="portao__linha">Nossa equipe vai falar com você em breve.</p>
          <Link href="/" className="portao__elo mt-6 inline-block text-sm font-medium">
            Voltar ao início
          </Link>
        </>
      ) : (
        <>
          <h1 className="portao__titulo">Fale com nossa equipe</h1>
          <p className="portao__linha">Deixe seus dados e entramos em contato.</p>

          <form action={leadAction} className="portao__forma">
            <Campo rotulo="Nome" nome="nome" placeholder="Seu nome" autoComplete="name" required />
            <Campo rotulo="E-mail" nome="email" tipo="email" placeholder="voce@empresa.com" autoComplete="email" required />
            <Campo rotulo="Telefone" dica="WhatsApp" nome="telefone" placeholder="(00) 00000-0000" autoComplete="tel" required />
            <Campo rotulo="Empresa" nome="empresa" placeholder="Razão social / nome fantasia" autoComplete="organization" />
            <Campo rotulo="Mensagem" nome="mensagem" placeholder="Conte rapidamente o que precisa" />
            <input type="hidden" name="planoId" value={selecionado?.id ?? ""} />
            <input type="hidden" name="planoNome" value={planoNomeSel} />

            {leadErro && <Aviso>{leadErro}</Aviso>}

            <button type="submit" className="botao--cheio" disabled={leadPend}>
              {leadPend ? "Enviando…" : "Quero ser contatado"}
            </button>
          </form>

          {!selecionado?.sobConsulta && (
            <div className="portao__troca">
              <p>
                Quer começar agora?{" "}
                <button type="button" onClick={() => setModo(temPreco ? "assinatura" : "trial")}>
                  {temPreco ? "Assinar e pagar" : "Começar teste grátis de 7 dias"}
                </button>
              </p>
            </div>
          )}
        </>
      )}

      <p className="portao__ou">ou</p>

      <Link href="/login" className="botao--vazio mt-4">Já tenho conta</Link>

      <p className="portao__rodape">Easy-NFe · emissão de NF-e, NFC-e e NFS-e</p>
    </Portao>
  );
}

function Campo({
  rotulo, dica, nome, tipo = "text", placeholder, autoComplete, inputMode, required,
}: {
  rotulo: string;
  dica?: string;
  nome: string;
  tipo?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text" | "tel" | "email";
  required?: boolean;
}) {
  return (
    <label className="campo" htmlFor={nome}>
      <span className="campo__rotulo">
        {rotulo}
        {dica && <span className="campo__dica">{dica}</span>}
      </span>
      <input
        id={nome}
        name={nome}
        className="campo__entrada"
        type={tipo}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required={required}
      />
    </label>
  );
}

function Aceite({ marcado, aoMudar }: { marcado: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <label className="portao__aceite">
      <input type="checkbox" name="aceite" checked={marcado} onChange={(e) => aoMudar(e.target.checked)} />
      <span>
        Li e aceito os{" "}
        <a href="/termos" target="_blank" rel="noopener noreferrer" className="portao__elo">Termos de Uso</a>{" "}
        e a{" "}
        <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="portao__elo">Política de Privacidade</a>.
      </span>
    </label>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="portao__aviso" role="status">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
      {children}
    </p>
  );
}

function Visto() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  );
}
