<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Diretrizes de UI e Estilo

- **NUNCA USAR EMOJIS**: É terminantemente proibido o uso de emojis unicode (ex: 📦, 🔧, ℹ️, ⚠️, ❌, etc.) na interface do usuário, tabelas, modais, steppers, toasts, botões, PDFs ou qualquer elemento visual.
- **SEMPRE USAR ÍCONES**: Se precisar representar visualmente algum conceito, use sempre componentes de ícones SVG vetoriais limpos (ex: `IconBox`, `IconWrench`, `IconLayers`, `IconInfo`, `IconCheck`, etc.), nunca emojis.
