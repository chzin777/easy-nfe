import Link from "next/link";

export const metadata = { title: "Termos de Uso · Easy-NFe" };

export default function TermosPage() {
  return (
    <DocLegal titulo="Termos de Uso" atualizado="22 de junho de 2026">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Modelo inicial — revise com seu jurídico antes de publicar em produção.
      </p>

      <H>1. Aceitação</H>
      <P>Ao criar uma conta e utilizar o Easy-NFe (“Plataforma”), você concorda com estes Termos de Uso e com a Política de Privacidade. Caso não concorde, não utilize a Plataforma.</P>

      <H>2. Descrição do serviço</H>
      <P>O Easy-NFe é uma ferramenta de emissão e gestão de documentos fiscais eletrônicos (NF-e/NFC-e) e cadastros relacionados. A disponibilidade depende de serviços de terceiros, como a SEFAZ e o provedor de pagamentos.</P>

      <H>3. Conta e responsabilidades</H>
      <P>Você é responsável pela veracidade dos dados cadastrados, pela guarda das credenciais e do certificado digital, e pelo uso correto da Plataforma conforme a legislação fiscal vigente.</P>

      <H>4. Assinatura e pagamento</H>
      <P>Os planos pagos são cobrados conforme o valor e a periodicidade exibidos no momento da contratação, por meio do provedor de pagamentos (Asaas), via Pix ou boleto. O acesso pode ser suspenso em caso de inadimplência após o período de tolerância.</P>

      <H>5. Cancelamento</H>
      <P>Você pode cancelar a assinatura a qualquer momento. O cancelamento interrompe cobranças futuras; valores já pagos referentes ao período vigente não são reembolsados, salvo disposição legal em contrário.</P>

      <H>6. Limitação de responsabilidade</H>
      <P>A Plataforma é fornecida “como está”. Não nos responsabilizamos por indisponibilidades de serviços de terceiros (SEFAZ, internet, provedores) nem por uso indevido ou dados incorretos informados pelo usuário.</P>

      <H>7. Alterações</H>
      <P>Estes Termos podem ser atualizados. Mudanças relevantes serão comunicadas pelos canais da Plataforma.</P>

      <P className="mt-6 text-sm text-[var(--muted)]">
        Veja também a <Link href="/privacidade" className="font-medium text-[var(--primary)] hover:underline">Política de Privacidade</Link>.
      </P>
    </DocLegal>
  );
}

function DocLegal({ titulo, atualizado, children }: { titulo: string; atualizado: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/" className="text-sm font-medium text-[var(--primary)] hover:underline">← Voltar ao início</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{titulo}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Última atualização: {atualizado}</p>
      <div className="mt-6 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-3 text-base font-semibold text-slate-900">{children}</h2>;
}
function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={className}>{children}</p>;
}
