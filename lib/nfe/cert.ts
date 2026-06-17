import forge from "node-forge";

export type Certificado = {
  keyPem: string;
  certPem: string;
};

// Extrai chave privada + certificado de um A1 (.pfx/.p12) em base64.
// Usa node-forge porque o Node 24 / OpenSSL 3 rejeita PFX antigos da ICP-Brasil
// quando passados direto como `pfx` ao https.Agent — extrair PEM contorna isso.
export function carregarCertificado(
  pfxBase64: string,
  senha: string,
): Certificado {
  const der = forge.util.decode64(pfxBase64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), senha);

  const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[
    forge.pki.oids.certBag
  ]?.[0];
  const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
    forge.pki.oids.pkcs8ShroudedKeyBag
  ]?.[0];

  if (!certBag?.cert || !keyBag?.key) {
    throw new Error("Certificado A1 inválido: chave ou certificado ausente.");
  }

  return {
    certPem: forge.pki.certificateToPem(certBag.cert),
    keyPem: forge.pki.privateKeyToPem(keyBag.key),
  };
}
