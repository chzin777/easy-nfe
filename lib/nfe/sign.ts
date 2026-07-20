import { SignedXml } from "xml-crypto";
import type { Certificado } from "./cert";

// Assina um nó XML (infNFe, infEvento ou infDPS) com XML-DSig RSA-SHA1 + C14N.
// `refId` é o atributo Id do nó assinado.
//
// A NFS-e Padrão Nacional usa o mesmo esquema da NF-e 4.00 — inclusive o
// action "after", que deixa <Signature> como irmã do nó assinado, e não filha.
export function assinar(
  xml: string,
  refId: string,
  cert: Certificado,
  tag: "infNFe" | "infEvento" | "infDPS",
): string {
  const sig = new SignedXml({
    privateKey: cert.keyPem,
    publicCert: cert.certPem,
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  });
  sig.addReference({
    xpath: `//*[local-name(.)='${tag}']`,
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
    ],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    uri: refId,
  });
  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='${tag}']`, action: "after" },
  });
  return sig.getSignedXml();
}
