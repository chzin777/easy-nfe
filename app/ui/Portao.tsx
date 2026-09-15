import Image from "next/image";
import Link from "next/link";
import "./portao.css";

/**
 * PORTÃO — a casca das telas de acesso (login e cadastro).
 *
 * Cena ao fundo, meia-lua de vidro à esquerda e o formulário dentro da
 * curva. Ficou em componente porque as duas telas são a mesma porta: se
 * cada uma tivesse a sua cópia, a primeira mexida já separaria as duas.
 *
 * `alto` é para conteúdo mais alto que a tela (o cadastro): o arco deixa
 * de ser centralizado e rola junto com a página.
 */

const PLACAS = [
  { n: 1, titulo: "NF-e 1.482", nota: "AUTORIZADA · SEFAZ-GO", icone: <IconeArquivo /> },
  { n: 2, titulo: "DANFE enviada", nota: "E-MAIL DO CLIENTE", icone: <IconeCheck /> },
  { n: 3, titulo: "Venda do site", nota: "VIROU NOTA SOZINHA", icone: <IconeSino /> },
  { n: 4, titulo: "Orçamento #308", nota: "FECHADO EM NFS-E", icone: <IconeArquivo /> },
];

export default function Portao({
  alto = false,
  largo = false,
  planos = false,
  children,
}: {
  alto?: boolean;
  largo?: boolean;
  /* `planos` alarga o arco para caber a escolha de plano em linha: é a
     única tela desta casca que é mais larga do que alta. */
  planos?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={"portao" + (alto ? " portao--alto" : "") + (planos ? " portao--planos" : "")}>
      {/* ── a cena ── */}
      <div className="cena" aria-hidden="true">
        <Image
          src="https://wallpapers.com/images/hd/purple-abstract-2gf414bg9xvsakmf.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* véu claro: a foto é escura demais p/ o vidro da meia-lua aparecer */}
        <div className="absolute inset-0 bg-[linear-gradient(150deg,rgba(239,235,255,0.55),rgba(222,215,251,0.42)_48%,rgba(233,229,250,0.58))]" />

        {/* arcos largos, o gesto de fundo */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
          {[260, 380, 500, 620, 740].map((r) => (
            <circle key={r} cx="820" cy="440" r={r} fill="none" stroke="rgba(82,39,255,0.09)" strokeWidth="1.5" />
          ))}
        </svg>

        {/* o halo da marca */}
        <div className="absolute right-[6%] top-[38%] aspect-square w-[38%] -translate-y-1/2 rounded-full opacity-70 blur-[90px] [background:radial-gradient(circle,rgba(124,92,255,0.5),transparent_68%)]" />

        {/* o objeto do produto, em contorno */}
        <div className="absolute right-[26%] top-1/2 grid h-[168px] w-[168px] -translate-y-1/2 place-items-center rounded-[40px] bg-white/80 shadow-[0_30px_70px_-32px_rgba(82,39,255,0.45)] backdrop-blur-md">
          <IconeNota />
        </div>

        {PLACAS.map((p) => (
          <div key={p.n} className={`placa-vidro p-${p.n}`}>
            <span className="placa-vidro__icone">{p.icone}</span>
            <span className="placa-vidro__texto">
              <b>{p.titulo}</b>
              <i>{p.nota}</i>
            </span>
          </div>
        ))}
      </div>

      {/* ── o pórtico ── */}
      <div className="portao__palco">
        <div className="meia-lua">
          <div className={"portao__coluna" + (planos ? " portao__coluna--planos" : largo ? " portao__coluna--largo" : "")}>
            <Link href="/" aria-label="Voltar à página inicial" className="portao__marca">
              <Image
                src="/images/logo/logo-completa.png"
                alt="Easy-NFe"
                width={863}
                height={309}
                priority
                className="h-14 w-auto"
              />
            </Link>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function IconeArquivo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>
  );
}

function IconeCheck() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  );
}

function IconeSino() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
  );
}

function IconeNota() {
  return (
    <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--primary)]"><path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5z" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></svg>
  );
}
