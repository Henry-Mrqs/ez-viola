# EzViola — Relatório de Publicação e Deploy em Produção (Fase 5)

**Projeto:** EzViola (Web App Interativo de Aprendizado de Violão com Detecção de Áudio em Tempo Real)  
**Versão:** 1.0.0 (Production Release)  
**Data:** 2026-11-21  
**Engenheiro DevOps:** @devops (Release & Deployment Engineer)  
**Status do Deploy:** PUBLICADO EM PRODUÇÃO COM SUCESSO (HTTPS Ativo)

---

## 1. URLs e Acessos Oficiais

- **Aplicação em Produção (Vercel):**  
  👉 [https://ez-viola.vercel.app](https://ez-viola.vercel.app)  
  *(Alias de Produção alternativo: https://ez-viola-1oy7npdjn-henrys-projects-ea495720.vercel.app)*

- **Repositório de Código-Fonte (GitHub):**  
  👉 [https://github.com/Henry-Mrqs/ez-viola](https://github.com/Henry-Mrqs/ez-viola)

---

## 2. Checklist de Conformidade de Produção

| Requisito | Status | Evidência Técnica |
|---|---|---|
| **HTTPS Ativo** | APROVADO | Obrigatório pelo padrão W3C para acesso a `navigator.mediaDevices.getUserMedia`. HSTS ativado (`max-age=63072000`). |
| **Permissions-Policy** | APROVADO | Header `Permissions-Policy: microphone=*` configurado em `vercel.json` e validado via `curl -I`. |
| **Headers de Segurança** | APROVADO | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`. |
| **Suíte de Testes Automatizados** | APROVADO | 67 testes passando em 15 arquivos com 100% de sucesso (Vitest). |
| **Estabilizador Inteligente para Violão** | APROVADO | YIN com correção de sub-harmônicos (E2/A2), filtro de mediana de 5 amostras, damping de palhetada e dobramento harmônico. |
| **Monitor de Retorno do Microfone** | APROVADO | Loopback de microfone direto com slider de volume, alerta de fones, osciloscópio em tempo real (Canvas 60 FPS) e VU Meter (dBFS). |
| **Build de Produção** | APROVADO | Next.js 14.2 compilado estritamente com zero erros de tipagem TypeScript. |
| **Zero Backend / Custo Zero** | APROVADO | 100% client-side rodando direto no navegador (Web Audio API + Canvas 2D nativo). |
| **Responsividade Mobile-First** | APROVADO | Otimizado para smartphones (360px–428px) em estantes de violão e telas desktop amplas. |

---

## 3. Rotas Disponíveis da Aplicação

1. **`/` (Home / Landing):**
   - Apresentação do app, acesso rápido ao afinador, calibração e catálogo.
2. **`/tuner` (Afinador Cromático de Alta Precisão):**
   - Leitura contínua do microfone em tempo real via algoritmo YIN.
   - Agulha visual de -50 a +50 cents, indicador neon verde quando em $\pm 5$ cents de afinação.
   - Seletor de cordas padrão (E2, A2, D3, G3, B3, E4) e modo cromático automático.
3. **`/calibrate` (Wizard de Calibração do Noise Gate):**
   - Calibração de ruído ambiente em 3 passos com VU Meter e histerese Schmitt Trigger.
4. **`/practice` (Galeria de Músicas e Exercícios):**
   - Catálogo pedagógico completo com 5 lições/músicas, níveis de dificuldade e badges de estrelas.
5. **`/practice/[songId]` (Esteira Yousician com Gamificação):**
   - Canvas 2D nativo a 60 FPS ancorado no `AudioContext.currentTime`.
   - 6 cordas coloridas, blocos de acordes, tokens de notas e partículas.
   - Escuta ativa na Hit Zone com feedback instantâneo (Perfect, Good, Miss).
   - **Wait Mode:** Pausa inteligente caso o aluno hesite ou erre, exibindo o diagrama SVG de dedos no braço do violão até o acorde ser tocado corretamente.
   - Controles de velocidade (50%, 75%, 100% BPM) com sintetizador sem distorção harmônica.

---

## 4. Instruções de Execução Local

```bash
# Clonar o repositório
git clone https://github.com/Henry-Mrqs/ez-viola.git
cd ez-viola

# Instalar dependências
npm install

# Rodar a suíte de testes (50 testes)
npm test

# Iniciar servidor de desenvolvimento
npm run dev

# Rodar build de produção
npm run build
```
