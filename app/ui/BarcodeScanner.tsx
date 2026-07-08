"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { Button } from "./primitives";

// Leitura de código de barras pela câmera usando a BarcodeDetector API nativa
// (Chrome/Android). Sem dependência externa. Onde a API não existe (iOS Safari,
// Firefox), mostra aviso — o usuário pode usar um leitor USB/bluetooth (que digita
// no campo) ou digitar o número à mão. onDetect recebe só dígitos.

// Tipagem mínima da API nativa (não faz parte do lib.dom padrão).
type DetectedBarcode = { rawValue: string; format: string };
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

const FORMATOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "itf"];

export default function BarcodeScanner({
  aberto,
  onFechar,
  onDetect,
  continuo = false,
}: {
  aberto: boolean;
  onFechar: () => void;
  onDetect: (codigo: string) => void;
  // continuo = fica lendo para bipar vários em sequência (não para no 1º código).
  continuo?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const ultimoRef = useRef<{ codigo: string; em: number }>({ codigo: "", em: 0 });
  const [erro, setErro] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const suportado = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;

    async function iniciar() {
      if (!suportado) {
        setErro("Este navegador não suporta leitura por câmera. Use um leitor USB/bluetooth (bipa direto no campo) ou digite o número.");
        return;
      }
      try {
        const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
        const detector = new Detector({ formats: FORMATOS });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const tick = async () => {
          if (cancelado || !videoRef.current) return;
          try {
            const codigos = await detector.detect(videoRef.current);
            const achado = codigos.find((c) => c.rawValue.replace(/\D/g, "").length >= 8);
            if (achado) {
              const codigo = achado.rawValue.replace(/\D/g, "");
              if (!continuo) { onDetect(codigo); return; } // para no 1º
              // Modo contínuo: ignora o mesmo código relido por ~1,5s (evita duplicar).
              const agora = Date.now();
              const u = ultimoRef.current;
              if (codigo !== u.codigo || agora - u.em > 1500) {
                ultimoRef.current = { codigo, em: agora };
                onDetect(codigo);
                setFlash(codigo);
              }
            }
          } catch {
            /* frame não pronto — tenta de novo */
          }
          loopRef.current = requestAnimationFrame(tick);
        };
        loopRef.current = requestAnimationFrame(tick);
      } catch (e) {
        const nome = e instanceof Error ? e.name : "";
        setErro(
          nome === "NotAllowedError"
            ? "Permissão de câmera negada. Libere o acesso ou use um leitor USB/bluetooth."
            : "Não foi possível acessar a câmera. Use um leitor USB/bluetooth ou digite o número.",
        );
      }
    }

    void iniciar();

    return () => {
      cancelado = true;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [aberto, suportado, continuo, onDetect]);

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Escanear código de barras"
      largura="max-w-md"
      rodape={<Button variante="ghost" onClick={onFechar}>Fechar</Button>}
    >
      {erro ? (
        <p className="text-sm text-[var(--muted)]">{erro}</p>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-[var(--primary)] opacity-80" />
          </div>
          <p className="text-center text-xs text-[var(--muted)]">
            {continuo && flash
              ? <>Lido: <span className="font-mono text-[var(--success)]">{flash}</span> — continue bipando.</>
              : "Aponte a câmera para o código de barras do produto."}
          </p>
        </div>
      )}
    </Modal>
  );
}
