import Link from "next/link";

export const metadata = { title: "Política de Privacidade · Easy-NFe" };

export default function PrivacidadePage() {
  return (
    <DocLegal titulo="Política de Privacidade" atualizado="22 de junho de 2026">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Modelo inicial — revise com seu jurídico antes de publicar em produção.
      </p>

      <H>1. Dados que coletamos</H>
      <P>Coletamos dados de cadastro (nome, e-mail, telefone, CPF/CNPJ), dados das empresas e cadastros fiscais (produtos, clientes, transportadoras) e dados de cobrança necessários ao processamento de pagamentos.</P>

      <H>2. Como usamos os dados</H>
      <P>Usamos os dados para operar a Plataforma, emitir documentos fiscais, processar cobranças de assinatura, prestar suporte e cumprir obrigações legais.</P>

      <H>3. Compartilhamento</H>
      <P>Compartilhamos dados apenas com terceiros essenciais à operação — como a SEFAZ (emissão fiscal) e o provedor de pagamentos (Asaas) — e quando exigido por lei.</P>

      <H>4. Pagamentos</H>
      <P>Os dados de pagamento são processados pelo Asaas. Não armazenamos dados sensíveis de cartão; cobranças são feitas via Pix ou boleto.</P>

      <H>5. Segurança</H>
      <P>Adotamos medidas técnicas para proteger os dados, incluindo criptografia de credenciais sensíveis. Nenhum sistema é 100% seguro, mas trabalhamos para mitigar riscos.</P>

      <H>6. Seus direitos (LGPD)</H>
      <P>Você pode solicitar acesso, correção ou exclusão dos seus dados pessoais, bem como informações sobre o tratamento, conforme a Lei nº 13.709/2018 (LGPD).</P>

      <H>7. Retenção</H>
      <P>Mantemos os dados pelo tempo necessário à prestação do serviço e ao cumprimento de obrigações legais e fiscais.</P>

      <H>8. Contato</H>
      <P>Para exercer seus direitos ou tirar dúvidas sobre privacidade, entre em contato pelos canais de suporte da Plataforma.</P>

      <P className="mt-6 text-sm text-[var(--muted)]">
        Veja também os <Link href="/termos" className="font-medium text-[var(--primary)] hover:underline">Termos de Uso</Link>.
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
