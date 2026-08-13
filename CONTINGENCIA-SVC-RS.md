# Plano: Contingência SVC-RS (tpEmis=7) — NF-e mod 55, GO

Emitir NF-e quando a SEFAZ-GO está fora, via SEFAZ Virtual de Contingência RS (SVC-RS).
A nota é autorizada de forma definitiva no SVC-RS; **não há retransmissão** para GO quando ela volta.

## Fatos fiscais confirmados (fontes oficiais)

- GO → **SVC-RS**, `tpEmis="7"` (SVC-AN seria "6"; NÃO usar). Fonte: Gov. Goiás + NT 2013.007.
- `tpEmis≠1/3` exige, no fim do `<ide>` (após `verProc`, antes de `NFref`):
  - `<dhCont>` — `TDateTimeUTC`, `AAAA-MM-DDThh:mm:ss-03:00` (data/hora de entrada em contingência).
  - `<xJust>` — 15–256 chars (usar ≤255 sem acento por segurança).
- Trocar `tpEmis` muda a **chave** (posição 35) e o **cDV** (mód 11). `montarChave` já recalcula; `<cDV>` do `<ide>` vem de `chave.slice(-1)`, propaga automático.
- SVC-RS aceita **síncrono** (`indSinc=1`) — mesmo envelope. Fallback assíncrono só se rejeição 776 (não esperado).
- SOAP 1.2, `Content-Type: application/soap+xml; charset=utf-8` (sem SOAPAction). Igual ao atual.
- Ativação: SVC só opera quando a SEFAZ de origem declara indisponibilidade. Checar via `NFeStatusServico4` do SVC-RS (cStat 107) antes de emitir.

## Endpoints SVC-RS (confirmados)

Produção:
```
autoriza: https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx
consulta: https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx
status:   https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx
retorno:  https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx
```
Homologação (base `https://nfe-homologacao.svrs.rs.gov.br/ws/`):
```
autoriza: .../NfeAutorizacao/NFeAutorizacao4.asmx
consulta: .../NfeConsulta/NfeConsulta4.asmx
status:   .../NfeStatusServico/NfeStatusServico4.asmx
```

## Decisão de design

- Acionamento **manual confirmado** pelo usuário (não automático). Ao detectar SEFAZ-GO fora, oferecer botão "Emitir em contingência (SVC-RS)". Evita emitir em SVC quando GO só piscou.
- Persistir na nota: `tpEmis`, `dhCont`, `xJust` (auditoria + DANFE).
- Arquitetura de endpoints com dimensão de "autorizadora" (`go` | `svc-rs`), pronta p/ SVC-AN no futuro.

---

## Fase 0 — Doc discovery (CONCLUÍDA)

APIs permitidas (Next 16.2.9, doc real em node_modules/next/dist/docs/):
- Server Action: `"use server"` no topo do arquivo/função async. Import de action em client OK.
- `after` vem de **`next/server`** — uso `after(() => ...)` correto (já usado no projeto).
- Revalidação: `revalidateTag(tag, "max")` (2º arg obrigatório) ou `revalidatePath(path, type?)`. `updateTag` só em Server Action.
- Route Handler: `export async function POST(request: Request)` em `app/api/**/route.ts`.
- Anti-padrões: `unstable_cache` (removido → `use cache`), `revalidateTag(tag)` 1-arg (deprecado).
- Verificar antes: `cacheComponents` no `next.config` (define modelo de cache). Não bloqueia este plano — seguir padrão já usado em `emitirNota`.

Arquivos-alvo (verbatim confirmados):
- `lib/nfe/types.ts:51-66` DadosNFe · `lib/nfe/chave.ts` montarChave · `lib/nfe/xml.ts:120-171` montarNFe/ide · `lib/nfe/soap.ts:4-80` · `lib/nfe/index.ts:30-97` · `app/notas/actions.ts:132-463` · `prisma/schema.prisma:616-668` Nota · `app/ui/Danfe.tsx:34-57,138-140`.

---

## Fase 1 — Núcleo lib/nfe (tpEmis + endpoints SVC-RS)

**1a. types.ts** — estender `DadosNFe` (após linha 66):
```ts
  tpEmis?: "1" | "7";     // 1 normal (default) | 7 SVC-RS
  dhCont?: string;        // obrigatório se tpEmis=7 (AAAA-MM-DDThh:mm:ss-03:00)
  xJust?: string;         // obrigatório se tpEmis=7 (15-256 chars)
```
Adicionar `tpEmis` a `ResultadoEmissao` (devolver o efetivamente usado).

**1b. xml.ts** — parametrizar tpEmis + inserir dhCont/xJust:
- L142: `tpEmis: dados.tpEmis ?? "1",` (dentro de montarChave).
- L167: trocar literal `<tpEmis>1</tpEmis>` por `<tpEmis>${dados.tpEmis ?? "1"}</tpEmis>`.
- L170: após `<verProc>...`, antes de `</ide>`, inserir bloco condicional:
```ts
    (dados.tpEmis === "7"
      ? `<dhCont>${dados.dhCont}</dhCont><xJust>${esc(dados.xJust ?? "")}</xJust>`
      : ``) +
```
- Validar em montarNFe: se `tpEmis==="7"` e (sem dhCont ou xJust.length<15) → throw claro.

**1c. soap.ts** — adicionar dimensão de autorizadora:
- Novo tipo `type Autorizadora = "go" | "svc-rs";`
- Reestruturar `ENDPOINTS` para `Record<Autorizadora, Record<"1"|"2", Record<Servico,string>>>` (ou map paralelo `ENDPOINTS_SVC_RS`). Só precisa de `autoriza`, `consulta`, `status` para svc-rs (evento continua GO).
- `soap(tpAmb, servico, innerXml, cert, auth: Autorizadora = "go")` — resolve URL pela autorizadora. WSDL_NS inalterado (mesmos namespaces).
- URLs SVC-RS conforme seção acima (prod tpAmb=1, homolog tpAmb=2).

**1d. index.ts**:
- `emitirNFe(cert, dados)` — passar `auth = dados.tpEmis === "7" ? "svc-rs" : "go"` ao `soap(...)` (L83). Devolver `tpEmis` no resultado.
- Nova `consultarStatusSvc(cert, tpAmb, cUF)` — igual `consultarStatus` mas `soap(..., "svc-rs")`. Serve p/ checar se SVC está ativo (cStat 107).

**Verificação Fase 1**: `npx tsc --noEmit` limpo. Grep: `grep -n "tpEmis" lib/nfe/*.ts` mostra parametrizado, sem literal "1" solto em xml.ts:167.

---

## Fase 2 — Schema DB (persistir contingência)

**2a. prisma/schema.prisma** — no bloco "autorização SEFAZ" do model Nota (após L646):
```prisma
  tpEmis         String   @default("1")  // 1 normal | 7 SVC-RS
  contingenciaEm DateTime?                // = dhCont quando SVC-RS
  contingenciaJustificativa String?
```
**2b. Migração**: `npx prisma migrate dev --name nota_contingencia_svc` (ou `db push` conforme fluxo do projeto — verificar package.json/histórico). `npx prisma generate`.

**Verificação**: migração aplica; `npx tsc --noEmit` reconhece campos novos no client gerado (lib/generated/prisma).

---

## Fase 3 — Server action (orquestração)

**3a. app/notas/actions.ts** — nova action `emitirNotaContingencia(input, justificativa: string)`:
- Reusar todo o preparo de `emitirNota` (licença, empresa, cert, numeração, `dados`).
- Antes de emitir: `consultarStatusSvc(cert, tpAmb, cUF)` — se não cStat 107, retornar erro "SVC-RS não está ativo (SEFAZ-GO não declarou contingência ainda)".
- Setar `dados.tpEmis="7"`, `dados.dhCont = dataHoraBrasilia()`, `dados.xJust = justificativa` (validar 15-256, sanitizar acento).
- Chamar `emitirNFe`; **manter o retry 539** (numeração).
- Persistir em `nota.create.data`: `tpEmis: "7"`, `contingenciaEm`, `contingenciaJustificativa`, além dos campos já existentes (chaveAcesso nova, protocolo, xmlAutorizado...).
- Refatorar: extrair o corpo comum de `emitirNota` p/ helper `prepararEmissao()` p/ não duplicar (DRY). `emitirNota` = tpEmis 1; `emitirNotaContingencia` = tpEmis 7.

**3b.** Melhorar o catch de indisponibilidade (L437-439): junto da mensagem, sinalizar ao client `contingenciaDisponivel: true` p/ a UI oferecer o botão.

**Verificação**: `npx tsc --noEmit`. Teste manual em homologação (Fase 5).

---

## Fase 4 — UI

**4a.** Fluxo de emissão (app/notas/nova ou modal de resultado): quando `emitirNota` volta `contingenciaDisponivel`, mostrar botão "Emitir em contingência (SVC-RS)" + textarea de justificativa (min 15 chars, placeholder "Ex.: SEFAZ-GO indisponivel, emissao via SVC-RS"). Confirmar → `emitirNotaContingencia`.

**4b.** DANFE (app/ui/Danfe.tsx):
- Watermark (L34-41): se `nota.tpEmis === "7"`, tarja "DANFE em Contingência - SVC-RS".
- Propagar `tpEmis`/`contingenciaEm` via `NotaCompleta` + `mapNota` (actions.ts:474-582).
- Célula protocolo (L138-140): manter protocolo real do SVC.

**Verificação**: DANFE de nota tpEmis=7 mostra tarja; nota normal inalterada.

---

## Fase 5 — Verificação end-to-end

1. `npx tsc --noEmit` limpo; `npx eslint` sem novos erros.
2. **Homologação** (ambiente=HOMOLOGACAO, tpAmb=2): emitir nota normal (baseline OK) e depois forçar fluxo contingência contra endpoint SVC-RS homolog. Confirmar retorno síncrono (protNFe inline) e cStat 100. Se rejeição 776 → registrar e implementar fallback assíncrono (lote+RetAutorizacao).
3. Conferir chave gravada tem posição 35 = "7" e DV coerente.
4. Grep guards: sem `tpEmis>1<` literal remanescente; endpoints SVC-RS presentes; `xJust` sempre 15-256.
5. DANFE visual: tarja contingência.

## Riscos / notas

- **Só emitir em SVC quando GO realmente fora** — gate pelo status do SVC-RS (cStat 107) evita nota indevida.
- Chave muda vs. numeração: a nota continua com mesmo `numero/serie`, só a chave/DV mudam (esperado).
- Não implementar retransmissão (SVC é definitivo). FS-DA/EPEC fora de escopo.
- `evento` (cancelamento) de nota emitida em SVC: cancelar normalmente pela autorizadora que autorizou — validar depois (fora deste escopo, mas anotar).
