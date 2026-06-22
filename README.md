<div align="center">

# ⚡ Easy-NFe

**Emissão e gestão de NF-e / NFC-e (modelo 55/65) com integração SEFAZ, assinatura A1 e cobrança de assinaturas via Asaas.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io)
[![Postgres](https://img.shields.io/badge/PostgreSQL-Neon-336791?logo=postgresql)](https://neon.tech)

</div>

---

## ✨ O que é

Plataforma SaaS multiempresa para emitir notas fiscais eletrônicas direto do navegador:

- 🧾 **Emissão NF-e (55) e NFC-e (65)** — monta o XML, assina com certificado A1 e transmite à SEFAZ (autorização síncrona), com DANFE em PDF e QR Code (NFC-e).
- 🏢 **Multiempresa / multiusuário** — cada usuário gerencia uma ou mais empresas, com controle de acesso por papel.
- 📦 **Cadastros** — produtos, clientes e transportadoras, com **importação em massa via CSV/XLSX** (modelo padrão) e busca de NCM/CNPJ automática.
- 📥 **DFe** — distribuição e manifestação de documentos recebidos.
- 💳 **Assinaturas** — cobrança via **Pix, boleto ou cartão recorrente** (Asaas), página pública de pagamento, webhook de confirmação e gestão de planos/benefícios no painel admin.
- 🧭 **Onboarding** — guia de primeiros passos + tour de emissão para novos usuários, e aviso de fim do período de teste.

---

## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, Turbopack) |
| UI | React 19, Tailwind CSS v4, `motion` |
| Banco | PostgreSQL (Neon) via Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Auth | JWT (`jose`) em cookie httpOnly + middleware (`proxy.ts`) |
| NF-e | XML próprio + assinatura `xml-crypto` / `node-forge`, SOAP SEFAZ |
| PDF/QR | `jspdf`, `html2canvas-pro`, `qrcode.react` |
| Pagamentos | Asaas (Pix, boleto, cartão/Subscriptions) |
| Cripto | AES-256-GCM (`lib/crypto.ts`) para certificado e segredos |

> ⚠️ **Atenção:** este projeto usa uma versão do Next.js com mudanças relativas ao que você conhece. Consulte os guias em `node_modules/next/dist/docs/` antes de mexer (ver `AGENTS.md`).

---

## 🚀 Começando

### Pré-requisitos
- Node.js 20+ (testado no 24)
- Um banco PostgreSQL (ex.: Neon)

### Instalação

```bash
git clone https://github.com/chzin777/easy-nfe.git
cd easy-nfe
npm install            # postinstall roda prisma generate
```

### Variáveis de ambiente (`.env`)

```env
# Banco (string POOLED do Neon recomendada)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Segredos (obrigatórios). SESSION_SECRET assina a sessão E é a chave de
# criptografia (certificado A1, config Asaas). CERT_SECRET é opcional e, se
# definido, tem prioridade sobre SESSION_SECRET na criptografia.
SESSION_SECRET="uma-string-bem-longa-e-aleatoria"
# CERT_SECRET="opcional"

# Asaas — opcionais. O recomendado é configurar pela UI (Admin → Integrações),
# que guarda criptografado no banco. As envs servem só como fallback.
# ASAAS_API_KEY="$aact_..."
# ASAAS_AMBIENTE="sandbox"        # sandbox | producao
# ASAAS_WEBHOOK_TOKEN="..."
```

### Banco

```bash
npx prisma db push     # sincroniza o schema (workflow db push, sem migrations)
npx tsx scripts/seed-admin.mjs     # cria admin: admin@easy.com / easy123123
npx tsx scripts/seed-planos.mjs    # planos iniciais (opcional)
```

### Rodar

```bash
npm run dev            # http://localhost:3000  (use -- -p 3004 p/ trocar porta)
```

---

## 📜 Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Turbopack) |
| `npm run build` | `prisma generate` + `next build` |
| `npm start` | Servidor de produção |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Checagem de tipos |

Scripts auxiliares em `scripts/*.mjs` (rodar com `npx tsx scripts/<arquivo>.mjs`).

---

## 🗂️ Estrutura

```
app/
  page.tsx              Landing (planos, CTAs)
  login/ cadastro/      Autenticação e self-serve (trial / assinatura paga)
  pagar/[token]/        Pagamento público (Pix / boleto / cartão)
  painel/               Dashboard
  produtos/ clientes/ transportadoras/   Cadastros (+ importação CSV/XLSX)
  notas/nova/           Emissão em etapas (Stepper) + tour
  notas/ eventos/ recebidas/ importar/   Notas e DFe
  configuracoes/        Empresa, certificado A1, ambiente, numeração
  admin/                Painel admin (usuários, planos, benefícios, integrações)
  api/asaas/webhook/    Webhook de pagamento Asaas
  ui/                   Componentes (Modal, Stepper, AppShell, primitives...)
lib/
  nfe/                  Montagem/assinatura/transmissão do XML, chave, QR, SOAP
  asaas.ts asaas-config.ts assinatura.ts   Integração de cobrança
  prisma.ts crypto.ts auth.ts empresa.ts licenca.ts   Infra
prisma/schema.prisma    Modelo de dados
proxy.ts                Middleware de rotas/sessão
```

---

## 💳 Pagamentos (Asaas)

1. **Admin → Integrações:** cola a API Key, escolhe ambiente (Sandbox/Produção) e (opcional) token do webhook — tudo **criptografado no banco**.
2. **Webhook:** cadastre no Asaas a URL `https://SEU_DOMINIO/api/asaas/webhook` (v3, eventos `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`). Token igual nos dois lados (ou nenhum).
3. **Formas:** Pix (QR + copia-e-cola) e boleto inline; **cartão = assinatura recorrente** (Asaas Subscriptions) via checkout hospedado.
4. **Teste:** use **Sandbox** (sem dinheiro real). Em produção, valor mínimo da cobrança ~R$5 e taxas do Asaas se aplicam.

---

## 🚢 Deploy (Vercel)

- Build roda `prisma generate` automaticamente.
- Configure as env vars na Vercel — **`SESSION_SECRET` e `DATABASE_URL` são obrigatórias** (sem `SESSION_SECRET`, a criptografia da config/cert quebra).
- O schema é aplicado via `prisma db push` (não há pasta `migrations`).

---

## 🔒 Notas de segurança

- O **certificado A1** e a **config do Asaas** são guardados criptografados (AES-256-GCM) com a chave derivada de `SESSION_SECRET`/`CERT_SECRET`.
- Páginas legais (`/termos`, `/privacidade`) são **modelos iniciais** — revise com jurídico antes de produção.

---

<div align="center">
Feito com ⚡ para emitir nota sem dor.
</div>
