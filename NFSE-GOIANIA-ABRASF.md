# Plano: NFS-e de Goiânia (ABRASF 2.04 / SGISS)

Emitir nota de serviço para empresas de Goiânia. Hoje o Easy só fala com o emissor
nacional (SEFIN), e Goiânia **não aderiu** a ele — toda tentativa volta E0039.

## Por que o nacional não serve

Desde 01/10/2025 Goiânia usa o **SGISS** (Sistema de Gestão, Fiscalização e
Arrecadação do ISSQN), rodando sobre a plataforma **ISSNet Online**. A prefeitura
mantém emissor próprio e apenas **compartilha** as notas com o ambiente nacional
(ADN). Por isso a SEFIN Nacional rejeita com:

```
E0039 O município emissor informado na DPS deve estar parametrizado para utilizar
os emissores públicos nacionais, conforme parametrização do município no Sistema
Nacional NFS-e.
```

Não é erro de preenchimento. Não adianta repetir nem mexer no XML da DPS.

## Fatos confirmados no ar (WSDL lido em 13/08/2026)

- Endpoint: `https://nfse.issnetonline.com.br/abrasf204/goiania/nfse.asmx`
  (WSDL em `?wsdl` — responde 200 sem certificado no transporte)
- Padrão: **ABRASF 2.04**. `targetNamespace` = `http://nfse.abrasf.org.br`
- SOAP **1.1** (binding `soap:`, não `soap12:`); `soapAction` =
  `http://nfse.abrasf.org.br/<Operacao>`
- Toda operação recebe dois parâmetros string com XML dentro:
  `nfseCabecMsg` e `nfseDadosMsg`. A resposta vem em `outputXML`.
- Operações publicadas: `GerarNfse`, `RecepcionarLoteRps`,
  `RecepcionarLoteRpsSincrono`, `SubstituirNfse`, `CancelarNfse`,
  `ConsultarLoteRps`, `ConsultarNfsePorRps`, `ConsultarNfsePorFaixa`,
  `ConsultarNfseServicoPrestado`, `ConsultarNfseServicoTomado`,
  `ConsultarRpsDisponivel`, `ConsultarUrlNfse`, `ConsultarDadosCadastrais`.

Para o nosso caso serve `GerarNfse`: uma nota por chamada, resposta na hora —
mesmo formato de uso do emissor nacional hoje.

## Burocracia antes de codar

- O webservice de **produção** só é liberado por pedido em
  **suporte.nfse@goiania.go.gov.br**, informando a inscrição municipal.
- **Não existe servidor de homologação** para o município. O teste é em produção,
  com o modo TESTE habilitado pela prefeitura ou emitindo com série `TESTE`:
  as validações são reais e nenhuma nota é gerada de verdade.
- Certificado **A1** com o mesmo CNPJ do prestador (o Easy já guarda e usa o A1
  da empresa para a NF-e e para a NFS-e nacional).
- XSDs e o manual de integração ficam na área de **Downloads** do sistema, atrás
  do login em `https://www.issnetonline.com.br/goiania/online/login/login.aspx`.
  **Ainda não temos esses arquivos** — sem eles não dá para fechar o layout.

## A confirmar (não assumir)

- Se o transporte exige certificado do cliente (mTLS) nas operações, ou se a
  autenticação é só a assinatura XMLDSig dentro do lote/RPS.
- Conteúdo exato do `nfseCabecMsg` (versão do layout) e do `nfseDadosMsg`.
- Quais tags são assinadas: `<Rps>`, `<LoteRps>` ou ambas.
- Regras próprias de Goiânia: código de serviço municipal (não é o cTribNac do
  nacional), alíquota, retenção, e o que a prefeitura exige em cada campo.
- Como o número/série do RPS conversa com a numeração que já guardamos.

## Desenho no código

O emissor nacional fica intacto. Entra um segundo caminho, escolhido pelo
município da empresa:

- `lib/nfse/abrasf/` — cliente SOAP 1.1, montagem do XML ABRASF 2.04, assinatura
  e leitura da resposta. Aproveita o que já existe: `lib/nfe/cert.ts` (A1) e a
  assinatura XMLDSig usada na NF-e.
- Roteamento na emissão: município da empresa parametrizado no nacional → SEFIN;
  senão → provedor municipal. Hoje só Goiânia, mas ABRASF 2.04 é usado por
  centenas de prefeituras, então o módulo nasce reaproveitável.
- Persistência: a `NotaServico` guarda hoje campos do padrão nacional (chave de
  acesso, DPS, protocolo). Precisa acomodar número de RPS, número da NFS-e e
  código de verificação, que é o que o ABRASF devolve.

## Enquanto isso

O cliente de Goiânia emite pelo site da prefeitura. O Easy já mostra a mensagem
explicando isso em vez de repassar o código E0039 cru.
