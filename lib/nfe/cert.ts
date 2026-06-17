import forge from "node-forge";

export type Certificado = {
  keyPem: string;
  certPem: string;
};

// Extrai chave privada + certificado de um A1 (.pfx/.p12) em base64.
// Usa node-forge porque o Node 24 / OpenSSL 3 rejeita PFX antigos da ICP-Brasil
// quando passados direto como `pfx` ao https.Agent — extrair PEM contorna isso.
// CA=true no basicConstraints → certificado de autoridade (intermediário/raiz).
function ehCA(cert: forge.pki.Certificate): boolean {
  const bc = cert.getExtension("basicConstraints") as { cA?: boolean } | undefined;
  return bc?.cA === true;
}

export function carregarCertificado(
  pfxBase64: string,
  senha: string,
): Certificado {
  const der = forge.util.decode64(pfxBase64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), senha);

  const certBags = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [])
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => !!c);
  const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
    forge.pki.oids.pkcs8ShroudedKeyBag
  ]?.[0];

  if (certBags.length === 0 || !keyBag?.key) {
    throw new Error("Certificado A1 inválido: chave ou certificado ausente.");
  }

  // Folha = certificado do titular (não-CA); o resto é a cadeia intermediária.
  // O Ambiente Nacional (Serpro/IIS) exige a cadeia completa, senão devolve HTTP 403.
  const folha = certBags.find((c) => !ehCA(c)) ?? certBags[0];
  const intermediarios = certBags.filter((c) => c !== folha);
  const certPem =
    forge.pki.certificateToPem(folha) +
    intermediarios.map((c) => forge.pki.certificateToPem(c)).join("");

  return {
    certPem,
    keyPem: forge.pki.privateKeyToPem(keyBag.key),
  };
}
