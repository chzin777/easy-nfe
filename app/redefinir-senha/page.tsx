import Image from "next/image";
import Link from "next/link";
import RedefinirForm from "./RedefinirForm";

// Next 16: searchParams é assíncrono.
export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <Link href="/" aria-label="Voltar à página inicial" className="absolute left-6 top-6 z-20 sm:left-8 sm:top-8">
        <Image
          src="/images/logo/logo-completa.png"
          alt="Easy-NFe"
          width={863}
          height={309}
          priority
          className="h-20 w-auto transition hover:opacity-80"
        />
      </Link>

      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <RedefinirForm token={token} />
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[var(--primary)] via-[var(--primary-2)] to-indigo-700 lg:flex lg:flex-col lg:justify-center lg:px-14">
        <Image
          src="https://wallpapers.com/images/hd/purple-abstract-2gf414bg9xvsakmf.jpg"
          alt="Easy-NFe"
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/85 via-[var(--primary-2)]/80 to-indigo-900/85" />
        <div className="relative z-10 max-w-md text-white">
          <h2 className="text-3xl font-bold leading-tight">Crie uma nova senha.</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/85">
            Escolha uma senha forte com pelo menos 8 caracteres. Depois é só entrar normalmente.
          </p>
        </div>
      </div>
    </div>
  );
}
