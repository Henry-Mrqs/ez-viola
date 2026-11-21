# EzViola — Plano Mestre de Implementação Arquitetural e Executiva (Fase 2)

**Documento:** Plano de Implementação Granular e Atômico (Implementation Plan)  
**Versão:** 1.0.0  
**Status:** PRONTO PARA EXECUÇÃO (Fase 2 -> Fase 3)  
**Autor:** @planner (Implementation Architect & Sprint Planner)  
**Destinatários:** Engenheiros de Software, Engenheiros de DSP, Desenvolvedores Frontend e QA  
**Data:** 2026-11-21  
**Repositório Alvo:** GitHub + Vercel  
**Documentos de Referência:**
- `docs/specs/architecture-validation.md` (Decisões Vinculantes do @validator)
- `docs/specs/audio-dsp-specification.md` (Topologia e Algoritmos Matemáticos do @audio-dsp)
- `docs/specs/ux-and-songs-specification.md` (Experiência do Usuário, Gamificação e Catálogo do @researcher)

---

## 1. Sumário Executivo & Diretrizes Vinculantes

O objetivo deste plano mestre é guiar a engenharia de desenvolvimento na construção do **EzViola**: uma plataforma progressiva (PWA) de aprendizado de violão 100% client-side com análise de áudio em tempo real, afinador cromático de precisão profissional, esteira estilo Yousician e modo pedagógico *Wait Mode*.

### 1.1 Diretrizes Vinculantes Homologadas (Architecture Compliance)
1. **Zero Backend / Custo Zero:** Todo o processamento de DSP, pontuação e persistência de progresso opera no navegador (Web Audio API + `localStorage`). Nenhum byte de áudio é enviado à rede.
2. **Zero Garbage Collection (Zero-GC):** Nenhuma alocação dinâmica (`new Float32Array`, objetos em closures, `.map()`, `.filter()`) no loop de 60 FPS de animação ou no loop de processamento de áudio. Todos os buffers e structs de retorno são pré-alocados nos construtores.
3. **Engine Visual Nativa:** Uso estrito de **Canvas 2D nativo acelerado por hardware**, descartando Three.js e PixiJS para economizar mais de 500 KB no bundle e garantir 60 FPS cravados em smartphones de entrada.
4. **Áudio de Acompanhamento 100% Sintetizado:** Descarte de áudio MP3 gravado e time-stretching pesado via SoundTouchJS. O metrônomo e playback harmônico usam osciladores Web Audio nativos com síntese subtrativa e ADSR, viabilizando velocidades dinâmicas (50%, 75%, 100%) com 0 KB de assets e sem distorção harmônica.
5. **Captura Defensiva de Microfone:** Constraints defensivas (`echoCancellation: { ideal: false }`, `noiseSuppression: { ideal: false }`, `autoGainControl: { ideal: false }`) com tratamento do Safari iOS (desbloqueio por `pointerdown`, taxa de amostragem dinâmica lida de `audioCtx.sampleRate`).
6. **Dicionário Harmônico Completo:** Suporte obrigatório e discriminatório para os acordes do catálogo: Maiores, Menores, Sétimas Dominantes (`7`), Menores com Sétima (`Am7`, `Bm7_easy`), pestana (`Bm`) e o acorde especial `D6add9_Fsharp`.

---

## 2. Árvore Canônica de Arquivos e Módulos

```
C:/Users/henry/www/ez-viola/
├── docs/
│   ├── plans/
│   │   └── implementation-plan.md     # Este documento
│   └── specs/
│       ├── architecture-validation.md
│       ├── audio-dsp-specification.md
│       └── ux-and-songs-specification.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── vitest.config.ts
├── tests/
│   ├── setup.ts                       # Setup do Vitest (mocks de Web Audio / Canvas)
│   ├── helpers/
│   │   └── synthetic-audio.ts         # Gerador de buffers senoidais e harmônicos
│   ├── audio/
│   │   ├── noise-gate.test.ts
│   │   ├── yin-detector.test.ts
│   │   ├── tuner-engine.test.ts
│   │   ├── chord-templates.test.ts
│   │   ├── chord-recognizer.test.ts
│   │   └── audio-synthesizer.test.ts
│   ├── game/
│   │   └── hit-detection.test.ts
│   └── songs/
│       └── catalog-validation.test.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout com tema escuro e meta viewport
│   │   ├── page.tsx                   # Landing page / Home
│   │   ├── globals.css                # Estilos base e animações de tremor/pulso
│   │   ├── tuner/
│   │   │   └── page.tsx               # Página do Afinador Cromático
│   │   ├── calibrate/
│   │   │   └── page.tsx               # Wizard de Calibração do Microfone
│   │   └── practice/
│   │       ├── page.tsx               # Galeria e Seleção de Lições
│   │       └── [songId]/
│   │           └── page.tsx           # Tela do Jogo / Esteira Yousician
│   ├── audio/
│   │   ├── types.ts                   # Interfaces estritas de DSP e áudio
│   │   ├── audio-constraints.ts       # Constraints seguras para getUserMedia
│   │   ├── noise-gate.ts              # Schmitt Trigger com histerese 6 dB
│   │   ├── yin-detector.ts            # Algoritmo YIN monofônico Zero-GC
│   │   ├── tuner-engine.ts            # Cálculo de cents, notas e anti-jitter EWMA
│   │   ├── chord-templates.ts         # Dicionário de templates de acordes L2-norm
│   │   ├── chord-recognizer.ts        # FFT 4096 -> 12-PCP Chromagram -> Cosine Sim
│   │   ├── audio-synthesizer.ts       # Metrônomo sonoro e playback sintético ADSR
│   │   └── audio-engine.ts            # Orquestrador Web Audio e loop 60 FPS
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx             # Botões de alta acessibilidade
│   │   │   ├── navigation.tsx         # Barra superior de navegação
│   │   │   └── modal.tsx              # Componente base de modal
│   │   ├── canvas/
│   │   │   ├── tuner-gauge.tsx        # Ponteiro/Agulha visual do afinador (-50 a +50c)
│   │   │   └── conveyor-canvas.tsx    # Esteira 2D de rolagem Yousician (60 FPS)
│   │   ├── tuner/
│   │   │   ├── string-selector.tsx    # Seletor das 6 cordas (E2..E4) ou Cromático
│   │   │   └── frequency-display.tsx  # Display de frequência, alvo e cents
│   │   ├── chord-diagram/
│   │   │   └── chord-diagram.tsx      # Diagrama SVG do braço do violão (trastes/pestana)
│   │   ├── feedback/
│   │   │   ├── game-hud.tsx           # HUD de score, combo, multiplicador e metrônomo
│   │   │   └── results-modal.tsx      # Modal de fim de lição com 1-3 estrelas
│   │   └── catalog/
│   │       └── song-card.tsx          # Card da música na galeria de seleção
│   ├── hooks/
│   │   ├── useAudioEngine.ts          # Ciclo de vida e permissões do AudioEngine
│   │   ├── useTuner.ts                # Conexão reativa com resultados do afinador
│   │   ├── useAudioClock.ts           # Sincronizador de timeline via AudioContext
│   │   ├── useConveyorGame.ts         # Game engine, validação de hit e Wait Mode
│   │   └── useWakeLock.ts             # Prevenção de bloqueio de tela em smartphone
│   └── songs/
│       ├── song-schema.ts             # Tipos TypeScript estritos e validador de schema
│       └── catalog/
│           ├── index.ts               # Exportador do catálogo
│           ├── open-strings.json      # Exercício 1: Cordas Soltas
│           ├── four-chords.json       # Exercício 2: Em - G - D - C
│           ├── horse-with-no-name.json# Música 1: America (Em e D6add9/F#)
│           ├── knockin-on-heavens-door.json # Música 2: Bob Dylan (G-D-Am7-C)
│           └── tempo-perdido.json     # Música 3: Legião Urbana (C-Am7-Bm7-Em)
```

---

## 3. Matriz de Dependências Técnicas e Grafo de Execução

```
[Sprint 0: Setup & Tooling]
            │
            ▼
[Sprint 1: Core Audio Engine & DSP (TDD)]
            │
            ├─────────────────────────────────────────┐
            ▼                                         ▼
[Sprint 2: Afinador Cromático (UI)]       [Sprint 3: Esteira Yousician (Canvas 2D)]
            │                                         │
            └────────────────────┬────────────────────┘
                                 ▼
              [Sprint 4: Validação em Tempo Real & Wait Mode]
                                 │
                                 ▼
              [Sprint 5: Catálogo de Músicas & Diagramas]
                                 │
                                 ▼
              [Sprint 6: Responsividade, Auditoria & Deploy]
```

---

## 4. Detalhamento Atômico dos Sprints

---

### Sprint 0: Setup do Projeto & Tooling

**Meta do Sprint:** Configurar a fundação técnica do projeto com Next.js 14+ App Router, TypeScript strict, Tailwind CSS com paleta semântica de cordas, Lucide Icons, Vitest com setup de mocks de áudio e layout base mobile-first.

---

#### Tarefa 0.1: Inicialização do Repositório, package.json e Dependências
- **Meta:** Criar o `package.json` com scripts canônicos e instalar todas as dependências do ecossistema.
- **Arquivos a Criar:**
  - `package.json`
- **Dependências de Produção:**
  - `next`: `^14.2.0` (ou superior)
  - `react`: `^18.3.0`
  - `react-dom`: `^18.3.0`
  - `lucide-react`: `^0.378.0`
  - `clsx`: `^2.1.1`
  - `tailwind-merge`: `^2.3.0`
- **Dependências de Desenvolvimento:**
  - `typescript`: `^5.4.5`
  - `@types/node`: `^20.12.0`
  - `@types/react`: `^18.3.0`
  - `@types/react-dom`: `^18.3.0`
  - `tailwindcss`: `^3.4.3`
  - `postcss`: `^8.4.38`
  - `autoprefixer`: `^10.4.19`
  - `vitest`: `^1.6.0`
  - `@vitest/coverage-v8`: `^1.6.0`
- **Scripts no package.json:**
  - `"dev"`: `"next dev"`
  - `"build"`: `"next build"`
  - `"start"`: `"next start"`
  - `"lint"`: `"next lint"`
  - `"test"`: `"vitest run"`
  - `"test:watch"`: `"vitest"`
  - `"test:coverage"`: `"vitest run --coverage"`
- **Critérios de Aceitação:**
  - `npm install` roda sem erros ou conflitos de pacotes.
  - Scripts `test` e `build` funcionam e são reconhecidos pelo npm.

---

#### Tarefa 0.2: Configuração Estrita do TypeScript
- **Meta:** Garantir tipagem segura de alto nível em todo o codebase, bloqueando `any` implícito e garantindo conformidade com padrões modernos ES2022.
- **Arquivos a Criar:**
  - `tsconfig.json`
- **Configuração Chave:**
  - `compilerOptions.strict: true`
  - `compilerOptions.noImplicitAny: true`
  - `compilerOptions.strictNullChecks: true`
  - `compilerOptions.noUnusedLocals: true`
  - `compilerOptions.noUnusedParameters: true`
  - `compilerOptions.paths: { "@/*": ["./src/*"] }`
  - `compilerOptions.target: "ES2022"`
  - `compilerOptions.lib: ["dom", "dom.iterable", "esnext"]`
- **Critérios de Aceitação:**
  - O comando `npx tsc --noEmit` executa sem apontar erros de sintaxe ou resolução.

---

#### Tarefa 0.3: Configuração do Vitest e Ambiente de Testes de Áudio
- **Meta:** Configurar o Vitest para execução rápida de testes unitários isolados com ambiente Node/JSDOM e utilitários auxiliares de injeção de buffers de áudio sintético.
- **Arquivos a Criar:**
  - `vitest.config.ts`
  - `tests/setup.ts`
  - `tests/helpers/synthetic-audio.ts`
- **Implementação do Helper `tests/helpers/synthetic-audio.ts`:**
  - `generateSineWave(frequency: number, sampleRate: number, durationSec: number, amplitude?: number): Float32Array`
  - `generateHarmonicGuitarString(f0: number, harmonics: number[], sampleRate: number, durationSec: number): Float32Array`
  - `generateChordBuffer(frequencies: number[], sampleRate: number, durationSec: number): Float32Array`
  - `generateFftFromSignal(signal: Float32Array, fftSize: number): Float32Array` (simulador de espectro de potência em dBFS para testes de acordes)
- **Critérios de Aceitação:**
  - O comando `npm run test` roda um teste básico de fumaça em menos de 1 segundo com sucesso.

---

#### Tarefa 0.4: Configuração do Tailwind CSS e Paleta Semântica de Violão
- **Meta:** Configurar o Tailwind com suporte a tema escuro profundo (`#0F172A`, `#1E293B`) e cores padronizadas das 6 cordas do violão estabelecidas na especificação.
- **Arquivos a Criar/Modificar:**
  - `tailwind.config.ts`
  - `postcss.config.js`
  - `src/app/globals.css`
- **Paleta de Cores Obrigatória das Cordas:**
  - Corda 1 (E4): Roxo `#8B5CF6` (`string-1`)
  - Corda 2 (B3): Azul Celeste `#0EA5E9` (`string-2`)
  - Corda 3 (G3): Verde Esmeralda `#10B981` (`string-3`)
  - Corda 4 (D3): Âmbar Dourado `#F59E0B` (`string-4`)
  - Corda 5 (A2): Laranja Vibrante `#F97316` (`string-5`)
  - Corda 6 (E2): Carmesim `#EF4444` (`string-6`)
- **Cores de Feedback:**
  - Perfect: Verde Neon `#22C55E`
  - Good: Âmbar `#F59E0B`
  - Miss: Vermelho Rubi `#EF4444`
  - Background Primário: Slate 900 `#0F172A`
  - Background Secundário/Card: Slate 800 `#1E293B`
- **Animações em `globals.css`:**
  - `@keyframes shake`: tremor horizontal de 6px por 200ms para feedback de Miss.
  - `@keyframes pulse-wait`: pulso suave em tom azul/âmbar para o Wait Mode.
- **Critérios de Aceitação:**
  - Cores semânticas utilizáveis via classes Tailwind (`text-string-1`, `border-string-6`, `bg-perfect`).

---

#### Tarefa 0.5: Estrutura Base de Layout e Navegação Mobile-First
- **Meta:** Implementar o layout raiz responsivo adaptado para suportes de violão / estantes de partitura, com viewport meta que impede zoom acidental e barra de navegação superior.
- **Arquivos a Criar:**
  - `src/app/layout.tsx`
  - `src/app/page.tsx`
  - `src/components/ui/navigation.tsx`
  - `src/components/ui/button.tsx`
  - `src/hooks/useWakeLock.ts`
- **Especificações:**
  - `layout.tsx` define `viewport: width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no`.
  - `navigation.tsx`: links limpos para `/` (Home), `/tuner` (Afinador), `/practice` (Lições), `/calibrate` (Calibração de Microfone).
  - `useWakeLock.ts`: ativa a Screen Wake Lock API quando suportada para evitar desligamento de tela durante o treino no violão.
- **Critérios de Aceitação:**
  - Página inicial renderiza perfeitamente no desktop e em viewport mobile (360x640px e 390x844px).
  - Navegação entre rotas funciona instantaneamente sem erros de hidratação React.

---

### Sprint 1: Core Audio Engine & DSP (TDD)

**Meta do Sprint:** Construir todos os módulos matemáticos e de processamento de áudio em TypeScript puro, com 100% de cobertura de testes unitários com buffers sintéticos antes de qualquer integração visual.

---

#### Tarefa 1.1: Tipagens e Interfaces Estritas de DSP
- **Meta:** Definir os contratos de dados e interfaces compartilhadas do motor de áudio.
- **Arquivos a Criar:**
  - `src/audio/types.ts`
- **Definições Obrigatórias:**
  - `AudioEngineConfig`, `TunerResult`, `ChordResult`, `GuitarStringSpec`, `GUITAR_STRINGS` (E2 a E4), `NOTE_NAMES` (12 semitons).
  - Tipos estritos para status de captura: `'uninitialized' | 'requesting' | 'running' | 'suspended' | 'interrupted' | 'error'`.
- **Critérios de Aceitação:**
  - Zero erros de compilação com `strict: true`.

---

#### Tarefa 1.2: Restrições de Áudio e Gestão Segura de Microfone
- **Meta:** Configurar constraints defensivas de `getUserMedia` para mitigar o cancelamento destrutivo de graves no Safari iOS e Android.
- **Arquivos a Criar:**
  - `src/audio/audio-constraints.ts`
  - `tests/audio/audio-constraints.test.ts`
- **Implementação:**
  - Exportar função `getSafeAudioConstraints(): MediaStreamConstraints` retornando desativação de `echoCancellation`, `noiseSuppression` e `autoGainControl`, além de mono (`channelCount: 1`).
  - Fallback defensivo para navegadores que não suportam propriedades de latência avançada.
- **Critérios de Aceitação:**
  - Teste unitário valida a integridade do objeto retornado.

---

#### Tarefa 1.3: Noise Gate Adaptativo com Schmitt Trigger e Histerese
- **Meta:** Criar o detector de envelope RMS e Schmitt Trigger com histerese de 6 dB para impedir oscilações violentas (*chattering*) de abertura e fechamento de gate.
- **Arquivos a Criar:**
  - `src/audio/noise-gate.ts`
  - `tests/audio/noise-gate.test.ts`
- **Especificações Matemáticas:**
  - Cálculo de RMS temporal: $\text{RMS} = \sqrt{\frac{1}{N} \sum x[n]^2}$.
  - Limiares padrão: $\text{Threshold}_{\text{Open}} = 0.015$ ($-36.5\text{ dBFS}$), $\text{Threshold}_{\text{Close}} = 0.0075$ ($-42.5\text{ dBFS}$, 6 dB abaixo).
  - Máquina de estados: se o gate estiver fechado e RMS $> \text{Threshold}_{\text{Open}}$, abre imediatamente (Attack 5ms); se estiver aberto e RMS $< \text{Threshold}_{\text{Close}}$, aguarda janela de Release (120ms) antes de fechar.
  - Permite calibração dinâmica com base no silêncio da sala e pico do violão.
- **Testes Unitários:**
  - Buffer de silêncio ($0.001$) mantém gate fechado.
  - Surto acústico ($0.05$) abre o gate no primeiro ciclo.
  - Sinal na faixa intermediária entre Open e Close mantém o estado anterior (histerese comprovada).
- **Critérios de Aceitação:**
  - 100% dos testes unitários de histerese passando no Vitest.

---

#### Tarefa 1.4: Algoritmo YIN Monofônico de Detecção de Pitch Zero-GC
- **Meta:** Implementar o algoritmo YIN completo para $N = 2048$, com cálculo de CMNDF, absolute thresholding ($\theta = 0.15$) e interpolação parabólica sub-amostra, sem nenhuma alocação de memória no método `.detect()`.
- **Arquivos a Criar:**
  - `src/audio/yin-detector.ts`
  - `tests/audio/yin-detector.test.ts`
- **Algoritmo em 5 Passos:**
  1. Diferença quadrada $d_t(\tau)$ com janela $W = N - \tau_{\max}$, onde $\tau_{\max} = N / 2 = 1024$.
  2. Normalização cumulativa CMNDF $d'_t(\tau)$.
  3. Busca do primeiro vale $d'_t(\tau) < 0.15$ com fallback para mínimo global se $< 0.40$.
  4. Interpolação parabólica sub-amostra nos 3 pontos vizinhos para encontrar $\tau^* = \tau + \delta$.
  5. Cálculo de frequência $f_0 = f_s / \tau^*$ e confiança/clareza $\text{clarity} = \max(0, 1 - d'_t[\tau])$.
- **Testes Unitários:**
  - TC-01: Senoide pura em 82.41 Hz (E2) detectada entre 82.0 Hz e 82.8 Hz com claridade $> 0.90$.
  - TC-02: Senoides puras nas 6 cordas do violão (E2 82.41, A2 110.0, D3 146.83, G3 196.0, B3 246.94, E4 329.63 Hz) com erro $\le 0.5\text{ cent}$.
  - TC-03: Rejeição de ruído branco aleatório (retorna $f = -1$ e claridade baixa).
- **Critérios de Aceitação:**
  - Testes cobrindo todas as 6 cordas do violão com precisão sub-cent em $f_s = 44.100\text{ Hz}$ e $f_s = 48.000\text{ Hz}$.

---

#### Tarefa 1.5: Motor do Afinador Cromático com Anti-Jitter EWMA
- **Meta:** Integrar o YIN no `TunerEngine`, implementando a conversão de frequência para nota MIDI, cálculo de cents ($-50$ a $+50$), tolerância de afinação ($\pm 5\text{ cents}$) e filtro EWMA ($\alpha = 0.35$).
- **Arquivos a Criar:**
  - `src/audio/tuner-engine.ts`
  - `tests/audio/tuner-engine.test.ts`
- **Fórmulas Matemáticas:**
  - $\text{MIDI} = 69 + 12 \log_2(f / 440)$
  - $\text{TargetFreq} = 440 \cdot 2^{(\text{round}(\text{MIDI}) - 69) / 12}$
  - $\Delta c = 1200 \log_2(f / \text{TargetFreq})$
  - $f_{\text{smooth}}[k] = 0.35 \cdot f_0[k] + 0.65 \cdot f_{\text{smooth}}[k-1]$
  - `inTune = Math.abs(cents) <= 5.0`
- **Testes Unitários:**
  - Injeção de 440.0 Hz $\rightarrow$ Nota A4, 0.0 cents, `inTune: true`.
  - Injeção de 441.27 Hz (+5 cents) $\rightarrow$ Nota A4, +5.0 cents, `inTune: true`.
  - Injeção de 442.55 Hz (+10 cents) $\rightarrow$ Nota A4, +10.0 cents, `inTune: false`.
  - Identificação correta de cada corda de violão (`stringIndex: 0..5`).
- **Critérios de Aceitação:**
  - Zero alocações no loop de processamento (`result` pré-alocado e reciclado).
  - 100% dos testes unitários de nota e cents validados.

---

#### Tarefa 1.6: Dicionário de Templates de Acordes Ponderados e L2-Normalizados
- **Meta:** Construir a classe e dicionário de templates com pesos harmônicos diferenciados (Raiz 1.0, Terça 0.85, Quinta 0.70, Sétima 0.60) cobrindo Maiores, Menores, Sétimas Dominantes, Menores com Sétima (`Am7`, `Bm7_easy`), e o acorde customizado `D6add9_Fsharp`.
- **Arquivos a Criar:**
  - `src/audio/chord-templates.ts`
  - `tests/audio/chord-templates.test.ts`
- **Especificações dos Templates Ponderados:**
  - Classes Maiores: 12 tríades.
  - Classes Menores: 12 tríades.
  - Classes com Sétima Dominante (`7`): 12 tétrades.
  - Classes Menores com Sétima (`minor7`): incluindo `Am7` e `Bm7`.
  - Template Customizado `D6add9_Fsharp`: D (2): 1.0, F# (6): 0.85, A (9): 0.80, B (11): 0.75, E (4): 0.60.
  - Todos os vetores $\mathbf{T}_m$ são normalizados em norma $L_2$: $\|\hat{\mathbf{T}}_m\|_2 = 1$.
- **Testes Unitários:**
  - Verificar que todos os templates possuem norma Euclidiana estritamente igual a $1.000 \pm 0.001$.
  - Verificar existência explícita de `Em`, `G`, `D`, `C`, `Am7`, `Bm7` e `D6add9_Fsharp`.
- **Critérios de Aceitação:**
  - Dicionário completo gerado em menos de 1ms na inicialização.

---

#### Tarefa 1.7: Reconhecedor de Acordes Polifônicos com FFT 4096 e Cromagrama
- **Meta:** Implementar o `ChordRecognizer` que processa buffers de magnitude FFT de 4096 bins, mapeia frequências entre 75 Hz e 2200 Hz para as 12 classes cromáticas (C a B), calcula o produto escalar com templates e aplica histerese temporal (8 frames consecutivos com confiança $\ge 0.72$).
- **Arquivos a Criar:**
  - `src/audio/chord-recognizer.ts`
  - `tests/audio/chord-recognizer.test.ts`
- **Especificações:**
  - Conversão de frequência do bin para semitom contínuo: $p_{\text{cont}} = 12 \log_2(f_k / 440) + 69$.
  - Classe discreta: $c = \text{round}(p_{\text{cont}}) \bmod 12$.
  - Acumulação de energia quadrática linear: $C[c] \mathrel{+}= 10^{\text{dB}(k) / 10}$.
  - Normalização $L_2$ do cromagrama.
  - Similaridade cosseno direta com produto escalar de 12 elementos.
  - Contador de confirmação de histerese para eliminar falsos positivos de ataque de palheta.
- **Testes Unitários:**
  - Discriminação harmônica perfeita entre Em e G.
  - Discriminação harmônica perfeita entre C e Am7 (conforme Seção 4.2 do parecer de validação).
  - Reconhecimento com confiança $\ge 0.80$ para espectros simulados de D, Em, G, C, Am7, Bm7 e D6add9/F#.
- **Critérios de Aceitação:**
  - Tempo de execução de `processSpectrum()` inferior a $1.5\text{ ms}$.

---

#### Tarefa 1.8: Sintetizador de Áudio Nativo para Metrônomo e Playback Harmônico
- **Meta:** Criar o módulo sintetizador Web Audio API para reproduzir cliques de metrônomo e sonoridades de acordes sem a necessidade de carregar arquivos MP3 ou bibliotecas externas.
- **Arquivos a Criar:**
  - `src/audio/audio-synthesizer.ts`
  - `tests/audio/audio-synthesizer.test.ts`
- **Especificações:**
  - `playMetronomeClick(audioCtx: AudioContext, time: number, isDownbeat: boolean)`:
    - Downbeat: `OscillatorNode` senoide pura a 1000 Hz, envelope de ganho exponencial de 30ms.
    - Upbeat: `OscillatorNode` senoide pura a 800 Hz, envelope de ganho exponencial de 20ms.
  - `playSynthesizedChord(audioCtx: AudioContext, frequencies: number[], time: number, durationSec: number)`:
    - Oscilador triangular/dente-de-serra com filtro passa-baixas dinâmico simulando ataque e decaimento natural de cordas de violão (ADSR rápido: attack 10ms, decay 200ms, sustain 0.4, release 400ms).
  - `playConfirmationTing(audioCtx: AudioContext, time: number)`:
    - Som límpido de sucesso em 1760 Hz (A6) com decaimento suave para acerto no Wait Mode.
- **Testes Unitários:**
  - Criação de nós e agendamento correto de nós de oscilador e ganho sem erros de runtime.
- **Critérios de Aceitação:**
  - Áudio cristalino em qualquer taxa de amostragem (44.1 kHz ou 48 kHz).

---

#### Tarefa 1.9: Orquestrador Principal do Grafo Web Audio API
- **Meta:** Implementar a classe `AudioEngine` integrando captura de microfone, filtro passa-altas de 65 Hz (rejeição de rumble e DC offset), analisadores paralelos (`tunerAnalyser` 2048 amostras e `chordAnalyser` 4096 amostras) e loop Zero-GC em `requestAnimationFrame`.
- **Arquivos a Criar:**
  - `src/audio/audio-engine.ts`
  - `tests/audio/audio-engine.test.ts`
- **Especificações:**
  - Grafo de áudio:
    `Microfone` $\rightarrow$ `HighPassFilter(65Hz, Q=0.707)` $\rightarrow$ `tunerAnalyser` (fftSize 2048) & `chordAnalyser` (fftSize 4096).
  - Métodos públicos: `start(): Promise<void>`, `stop(): Promise<void>`, callbacks `onTunerUpdate` e `onChordUpdate`.
  - Tratamento de `statechange` para gerenciar interrupções móveis.
  - Reutilização permanente de `Float32Array(2048)` para tempo e frequência.
- **Testes Unitários:**
  - Ciclo de vida: inicialização e encerramento limpo (fechamento de faixas de stream e contexto).
- **Critérios de Aceitação:**
  - Consumo de CPU por frame inferior a 6ms em ambiente móvel simulado.

---

### Sprint 2: Afinador Cromático de Alta Precisão (UI & Integração)

**Meta do Sprint:** Construir a interface visual completa do afinador cromático com ponteiro/agulha visual (-50 a +50 cents), indicador verde neon para $\le \pm 5\text{ cents}$, seletor de cordas, calibração amigável de ruído e página dedicada.

---

#### Tarefa 2.1: Hooks Reativos de Integração Web Audio
- **Meta:** Criar hooks React para conectar componentes visuais ao `AudioEngine` com gerenciamento de ciclo de vida seguro (montagem/desmontagem).
- **Arquivos a Criar:**
  - `src/hooks/useAudioEngine.ts`
  - `src/hooks/useTuner.ts`
- **Especificações:**
  - `useAudioEngine`: gerencia estado (`isStarted`, `isSuspended`, `error`), expõe métodos `startAudio()` e `stopAudio()`.
  - `useTuner`: subscreve ao callback do `tunerEngine` e atualiza o estado React apenas com frequências suavizadas para evitar re-renders desnecessários.
- **Critérios de Aceitação:**
  - Desmontagem do componente para o microfone e fecha o `AudioContext` sem vazamento de memória.

---

#### Tarefa 2.2: Componente da Agulha Visual do Afinador (Tuner Gauge)
- **Meta:** Implementar o medidor visual de afinação com escala de $-50$ a $+50\text{ cents}$, agulha animada a 60 FPS e zona de afinação precisa ($\le \pm 5\text{ cents}$) destacada em verde neon.
- **Arquivos a Criar:**
  - `src/components/canvas/tuner-gauge.tsx`
- **Especificações de Design e Física:**
  - Arco graduado de $-50$ a $+50\text{ cents}$ com marcações a cada 10 cents e marcação em destaque no zero.
  - Agulha com transição suave via interpolação linear ($lerp$) para evitar tremores visuais.
  - Quando $|\text{cents}| \le 5$: a agulha, o arco central e o indicador numérico mudam para Verde Neon (`#22C55E`) com brilho sutil (`drop-shadow`).
  - Quando $|\text{cents}| > 5$: cor âmbar/azul neutra indicando a direção necessária (apertar ou afrouxar a corda).
- **Critérios de Aceitação:**
  - Renderização fluida a 60 FPS sem travamentos.

---

#### Tarefa 2.3: Seletor de Corda Alvo e Indicador Cromático Automático
- **Meta:** Desenvolver o componente que permite ao usuário escolher entre o modo cromático automático (qualquer nota) e o modo de corda específica (E2, A2, D3, G3, B3, E4).
- **Arquivos a Criar:**
  - `src/components/tuner/string-selector.tsx`
- **Especificações:**
  - 6 botões circulares grandes com a paleta semântica oficial das cordas (E2 carmesim a E4 roxo).
  - Botão "Auto" para detecção cromática universal.
  - Destaque pulsante na corda atualmente detectada pelo motor de áudio.
- **Critérios de Aceitação:**
  - Seleção tátil rápida com resposta visual clara em telas móveis.

---

#### Tarefa 2.4: Display Numérico de Frequência, Desvio e Nota Alvo
- **Meta:** Exibir em tipografia monospace legível a frequência medida em Hz (com 1 casa decimal), a frequência teórica da nota e a diferença numérica em cents.
- **Arquivos a Criar:**
  - `src/components/tuner/frequency-display.tsx`
- **Especificações:**
  - Nota em tamanho extra grande (ex: **E**, **A**, **D**), oitava em sobrescrito (ex: $E_2$).
  - Mensagem de orientação para iniciantes: "Aperte a corda ↑" (se cents $< -5$), "Afrouxe a corda ↓" (se cents $> +5$), ou "Afinado! ✓" (se $|\text{cents}| \le 5$).
- **Critérios de Aceitação:**
  - Visualização nítida a 1.5 metros de distância (violão no colo e celular no suporte).

---

#### Tarefa 2.5: Wizard de Calibração de Microfone e Ruído em 3 Passos
- **Meta:** Construir o wizard amigável de ajuste do Noise Gate conforme Seção 2.5 da especificação de UX.
- **Arquivos a Criar:**
  - `src/components/tuner/noise-gate-modal.tsx`
  - `src/app/calibrate/page.tsx`
- **Fluxo em 3 Etapas:**
  1. Passo 1: Silêncio por 3s com medidor circular progressivo para medir $N_{\text{floor}}$.
  2. Passo 2: Toque forte no violão para capturar $S_{\text{peak}}$.
  3. Passo 3: Definição do limiar $\text{Threshold}_{\text{Open}} = N_{\text{floor}} + 0.35 \times (S_{\text{peak}} - N_{\text{floor}})$ e VU meter em tempo real com indicador de zona de corte.
- **Critérios de Aceitação:**
  - Limiar calibrado é persistido no `localStorage` e carregado automaticamente nas sessões futuras.

---

#### Tarefa 2.6: Página do Afinador Integrada e Responsiva
- **Meta:** Integrar todos os componentes na rota `/tuner`, adicionando botão de permissão de microfone síncrono e tratamento de estados de erro.
- **Arquivos a Criar:**
  - `src/app/tuner/page.tsx`
- **Critérios de Aceitação:**
  - O afinador funciona instantaneamente após o clique do usuário no botão "Iniciar Afinador".
  - Layout totalmente responsivo com suporte a modo escuro nativo.

---

### Sprint 3: Engine da Esteira Horizontal Yousician (Canvas 2D)

**Meta do Sprint:** Construir a esteira de treino 2D acelerada por hardware no Canvas nativo, com 6 cordas coloridas, blocos de acordes, tokens de notas, linha de execução (Hit Zone), sincronismo com `AudioContext.currentTime`, metrônomo visual/sonoro e controle de velocidade dinâmico.

---

#### Tarefa 3.1: Hook e Relógio de Sincronização Áudio-Visual
- **Meta:** Criar o gerenciador de tempo estritamente ancorado em `AudioContext.currentTime` para evitar descompasso (*audio-visual drift*) entre a esteira e o playback sonoro.
- **Arquivos a Criar:**
  - `src/hooks/useAudioClock.ts`
- **Especificações:**
  - Monitora o tempo decorrido relativo ao início da música: $\text{elapsedTime} = \text{audioCtx.currentTime} - \text{startTime}$.
  - Suporte a pausa, desaceleração suave (Wait Mode) e retomada sem salto temporal.
- **Critérios de Aceitação:**
  - Deriva acumulada menor que 5ms após 3 minutos de execução ininterrupta.

---

#### Tarefa 3.2: Motor de Renderização Canvas 2D da Esteira Horizontal
- **Meta:** Implementar o componente `<ConveyorCanvas />` com renderização contínua a 60 FPS utilizando Canvas 2D nativo.
- **Arquivos a Criar:**
  - `src/components/canvas/conveyor-canvas.tsx`
- **Especificações do Pipeline Gráfico:**
  - Limpeza do frame (`ctx.clearRect`).
  - Desenho das 6 linhas horizontais com espessura de 2px e cores semânticas (`#8B5CF6` a `#EF4444`).
  - Hit Zone vertical fixada a 15% da margem esquerda da esteira com gradiente linear e cursor iluminado.
  - Projeção de lookahead: exibe entre $2.5\text{s}$ e $3.5\text{s}$ de música adiante da Hit Zone.
  - Cálculo de posição horizontal para cada evento da timeline:
    $$x = \text{hitZoneX} + (\text{event.timeSec} - \text{currentAudioTime}) \times \text{pixelsPerSecond}$$
- **Critérios de Aceitação:**
  - Tempo de desenho gráfico por frame inferior a 1ms medido via DevTools Performance.

---

#### Tarefa 3.3: Renderização de Elementos: Blocos de Acordes e Tokens de Notas
- **Meta:** Implementar a geometria visual para blocos de acordes e círculos de notas individuais no Canvas 2D.
- **Arquivos a Modificar:**
  - `src/components/canvas/conveyor-canvas.tsx`
- **Especificações Gráficas:**
  - **Blocos de Acordes:** Retângulos com cantos arredondados (`ctx.roundRect`), cobrindo da corda mais grave à mais aguda ativada pelo acorde. Largura proporcional à duração em beats. Cifra legível desenhada em branco com sombra no centro superior do bloco.
  - **Tokens de Notas Soltas:** Círculos centralizados na linha da corda correspondente. Preenchimento com a cor da corda, borda branca de 2px e número do traste (0 a 12) impresso em fonte bold no centro.
- **Critérios de Aceitação:**
  - Identificação imediata e sem sobreposições visuais indesejadas em qualquer resolução de tela.

---

#### Tarefa 3.4: Sistema de Partículas e Animação de Impacto na Hit Zone
- **Meta:** Criar o sistema de partículas leves nativo em Canvas 2D para a explosão visual do *Perfect Hit*.
- **Arquivos a Modificar:**
  - `src/components/canvas/conveyor-canvas.tsx`
- **Especificações:**
  - Pool estático de 30 partículas recicladas (Zero-GC).
  - No acerto *Perfect*: dispersão radial de 20 partículas verde neon com decaimento exponencial de velocidade e alfa por 300ms.
  - No acerto *Good*: brilho suave em tom âmbar na Hit Zone.
  - No *Miss*: tremor horizontal da Hit Zone de 6px por 200ms com flash vermelho rubi.
- **Critérios de Aceitação:**
  - Zero criação de objetos no momento do impacto (uso estrito de arrays numéricos fixos).

---

#### Tarefa 3.5: Metrônomo Sonoro e Visual Sincronizado
- **Meta:** Integrar o metrônomo ao motor da esteira, combinando clique sonoro (`AudioSynthesizer`) com piscar rítmico da Hit Zone no início de cada tempo do compasso.
- **Arquivos a Modificar:**
  - `src/components/canvas/conveyor-canvas.tsx`
  - `src/hooks/useAudioClock.ts`
- **Especificações:**
  - Agendamento síncrono com precisão de microssegundos no `AudioContext`.
  - Pulso visual diferenciado no tempo forte (downbeat do compasso 4/4).
- **Critérios de Aceitação:**
  - Sincronia auditiva e visual perfeita sem atrasos perceptíveis.

---

#### Tarefa 3.6: Painel de Controle de Velocidade Dinâmica (50%, 75%, 100%)
- **Meta:** Implementar os seletores de velocidade da esteira, ajustando a reprodução e o deslocamento gráfico sem distorcer o pitch do áudio sintetizado.
- **Arquivos a Criar:**
  - `src/components/feedback/speed-controls.tsx`
- **Especificações:**
  - Botões de acesso rápido: **50% (Meia Velocidade)**, **75% (Modo Estudo)** e **100% (Velocidade Normal)**.
  - O multiplicador de velocidade altera $\Delta t$ entre eventos e a taxa de avanço de $x$ na esteira proporcionalmente.
- **Critérios de Aceitação:**
  - Alternância imediata de velocidade durante a reprodução sem estalos de áudio ou congelamentos.

---

### Sprint 4: Validação em Tempo Real, Gamificação & Wait Mode

**Meta do Sprint:** Integrar a escuta contínua do microfone à esteira de treino, avaliando timing windows (Perfect $\le \pm 50\text{ms}$, Good $\le \pm 120\text{ms}$, Miss), sistema de pontuação com combos, máquina de estados do Wait Mode e modal de resultados com estrelas.

---

#### Tarefa 4.1: Game Engine de Avaliação na Hit Zone e Janelas de Timing
- **Meta:** Criar a lógica central de avaliação que compara o evento corrente da timeline com as notas e acordes detectados pelo motor DSP.
- **Arquivos a Criar:**
  - `src/hooks/useConveyorGame.ts`
  - `tests/game/hit-detection.test.ts`
- **Janelas de Tolerância:**
  - **Perfect:** $|\Delta t| \le 50\text{ms}$ E (pitch $\le \pm 25\text{ cents}$ ou correlação de acorde $\ge 85\%$).
  - **Good:** $51\text{ms} < |\Delta t| \le 120\text{ms}$ E (pitch $\le \pm 45\text{ cents}$ ou correlação de acorde $\ge 70\%$).
  - **Miss:** $|\Delta t| > 120\text{ms}$ sem acerto, ou nota/acorde dissonante tocado.
- **Testes Unitários:**
  - Validação de toque no tempo exato ($0\text{ms}$) $\rightarrow$ Perfect.
  - Validação de toque com atraso de $80\text{ms}$ $\rightarrow$ Good.
  - Validação de toque fora da janela ($150\text{ms}$) $\rightarrow$ Miss.
- **Critérios de Aceitação:**
  - Cobertura de 100% dos ramos de decisão de timing e harmonia.

---

#### Tarefa 4.2: Feedback Visual e Sonoro de Acertos e Erros (Combo e Score)
- **Meta:** Gerenciar o placar em tempo real, streak de acertos consecutivos e multiplicadores de combo.
- **Arquivos a Modificar:**
  - `src/hooks/useConveyorGame.ts`
- **Regras de Pontuação:**
  - Base: Perfect = 100 pts; Good = 50 pts; Miss = 0 pts.
  - Multiplicadores de Combo:
    - 0 a 9 acertos: $1\times$
    - 10 a 19 acertos: $1.5\times$
    - 20 a 39 acertos: $2\times$
    - 40+ acertos: $3\times$ (Fever Mode ativado com aura visual na Hit Zone).
  - Em caso de Miss: multiplicador reseta imediatamente para $1\times$ e o combo zera.
- **Critérios de Aceitação:**
  - Cálculo de pontuação e combo exato e testado via testes unitários.

---

#### Tarefa 4.3: Implementação da Máquina de Estados do "Wait Mode"
- **Meta:** Construir a mecânica pedagógica do Wait Mode conforme especificado na Seção 2.4 de UX e Seção 5.3 da validação arquitetural.
- **Arquivos a Modificar:**
  - `src/hooks/useConveyorGame.ts`
  - `src/components/canvas/conveyor-canvas.tsx`
- **Fluxo Operacional:**
  1. Se um evento alcançar a Hit Zone ($t = t_{\text{alvo}}$) e não for tocado com sucesso em $100\text{ms}$:
     - A esteira desacelera suavemente ao longo de $150\text{ms}$ até parar exatamente na Hit Zone.
     - O playback sonoro pausa.
     - O elemento na Hit Zone começa a pulsar levemente.
     - O HUD exibe o diagrama do acorde expandido com dedos (1 a 4) e cordas abertas/abafadas.
  2. O microfone permanece escutando continuamente.
  3. Quando o acorde ou nota correta for detectada com confiança $> 0.75$:
     - A Hit Zone acende em verde neon.
     - O sintetizador emite o som *ting* cristalino de confirmação.
     - Aguarda um buffer de estabilização de $300\text{ms}$.
     - A esteira retoma sua velocidade normal em direção ao próximo evento.
- **Critérios de Aceitação:**
  - Transição de estados suave, sem congelamento da UI ou micro-cortes de áudio.

---

#### Tarefa 4.4: HUD Superior de Gamificação
- **Meta:** Construir o painel superior da tela de jogo com exibição de pontuação, combo atual, indicador de multiplicador e barra de progresso da música.
- **Arquivos a Criar:**
  - `src/components/feedback/game-hud.tsx`
- **Elementos Visuais:**
  - Score com efeito de transição numérica fluida.
  - Pílula de Combo com cor dinâmica (Azul no $1\times$, Roxo no $1.5\times$, Dourado no $2\times$, Fogo Neon no $3\times$).
  - Barra de progresso horizontal fina no topo mostrando percentual concluído da lição.
  - Botão de Pausa e Alternância de Modo (Wait Mode Ativo / Contínuo).
- **Critérios de Aceitação:**
  - Não obstrutivo em relação à esteira e legível em telas pequenas.

---

#### Tarefa 4.5: Tela Modal de Resultados Finais e Avaliação por Estrelas
- **Meta:** Criar o modal de encerramento da lição com cálculo de precisão percentual e premiação de 1 a 3 estrelas douradas.
- **Arquivos a Criar:**
  - `src/components/feedback/results-modal.tsx`
- **Fórmula de Precisão:**
  $$\text{Accuracy (\%)} = \left( \frac{N_{\text{perfect}} \times 1.0 + N_{\text{good}} \times 0.6}{N_{\text{total\_events}}} \right) \times 100$$
- **Classificação:**
  - $\ge 95\%$: 3 Estrelas Douradas
  - $80\% \le \text{precisão} < 95\%$: 2 Estrelas
  - $60\% \le \text{precisão} < 80\%$: 1 Estrela
  - $< 60\%$: Repetir Lição (com sugestão amigável para praticar a 50% de velocidade).
- **Persistência:** Salva melhor score e estrelas no `localStorage` sob a chave `ezviola_progress`.
- **Critérios de Aceitação:**
  - Modal abre automaticamente ao fim da timeline com botões "Jogar Novamente" e "Próxima Lição".

---

### Sprint 5: Catálogo de Músicas & Diagramas de Acordes

**Meta do Sprint:** Estruturar o schema formal das músicas, criar os arquivos JSON dos 5 módulos práticos, implementar o componente SVG de diagrama de braço de violão e a galeria de seleção de lições.

---

#### Tarefa 5.1: Tipagem Canônica SongSchema e Validador de Estrutura
- **Meta:** Definir a tipagem TypeScript completa e o validador em tempo de carregamento para garantir a integridade dos dados das músicas.
- **Arquivos a Criar:**
  - `src/songs/song-schema.ts`
  - `tests/songs/catalog-validation.test.ts`
- **Critérios de Aceitação:**
  - Qualquer inconsistência em compasso, duração ou notas de um acorde lança erro explicativo.

---

#### Tarefa 5.2: Base de Dados do Catálogo Inicial com os 5 Módulos em JSON
- **Meta:** Gerar os 5 arquivos de lições e músicas rigorosamente compatíveis com `SongSchema` e validados pelo Parecer de Engenharia.
- **Arquivos a Criar:**
  - `src/songs/catalog/open-strings.json` (Cordas Soltas e Dedilhado Fundamental, 60 BPM)
  - `src/songs/catalog/four-chords.json` (Os Quatro Cavaleiros: Em - G - D - C, 65 BPM)
  - `src/songs/catalog/horse-with-no-name.json` (America - A Horse with No Name: Em e D6add9/F#, 120 BPM)
  - `src/songs/catalog/knockin-on-heavens-door.json` (Bob Dylan - Knockin' on Heaven's Door: G - D - Am7 e G - D - C, 68 BPM)
  - `src/songs/catalog/tempo-perdido.json` (Legião Urbana - Tempo Perdido: C - Am7 - Bm7_easy - Em, 85 BPM)
  - `src/songs/catalog/index.ts` (exporta array ordenado com metadados e conteúdo)
- **Testes Unitários:**
  - Teste automatizado em `catalog-validation.test.ts` que valida individualmente os 5 arquivos contra o esquema.
- **Critérios de Aceitação:**
  - 100% dos JSONs passam na validação estrita sem campos nulos ou tempos inconsistentes.

---

#### Tarefa 5.3: Componente SVG de Diagrama de Braço do Violão (Chord Diagram)
- **Meta:** Implementar componente React SVG modular para renderizar qualquer acorde do violão com trastes, cordas, pestanas curvas, dedos de 1 a 4, e símbolos O e X.
- **Arquivos a Criar:**
  - `src/components/chord-diagram/chord-diagram.tsx`
  - `tests/components/chord-diagram.test.tsx`
- **Especificações Visuais do SVG:**
  - 6 linhas verticais (cordas 6 a 1).
  - 5 linhas horizontais (trastes 1 a 4 + nut superior espesso se `baseFret === 1`).
  - Indicação lateral do número da casa se `baseFret > 1` (ex: "Casa 2" para o Bm).
  - Círculos preenchidos com o número do dedo (1 = Indicador, 2 = Médio, 3 = Anelar, 4 = Mínimo).
  - Barra de pestana curvada com cantos arredondados quando o acorde possuir campo `barres`.
  - Círculos abertos (○) para cordas soltas e '✕' para cordas abafadas acima do nut.
- **Critérios de Aceitação:**
  - Renderiza perfeitamente todos os 8 acordes do repertório inicial (`Em`, `G`, `D`, `C`, `Am7`, `Bm7_easy`, `Bm`, `D6add9_Fsharp`).

---

#### Tarefa 5.4: Galeria Interativa e Seletor do Catálogo de Músicas
- **Meta:** Criar a página de galeria `/practice` permitindo ao usuário navegar pelas lições disponíveis, ver o nível de dificuldade, andamento (BPM), lista de acordes e estrelas já conquistadas.
- **Arquivos a Criar:**
  - `src/components/catalog/song-card.tsx`
  - `src/app/practice/page.tsx`
- **Especificações do Card:**
  - Badge de Dificuldade com cor semântica (Verde para Beginner, Azul para Elementary).
  - Exibição de BPM e duração em minutos/segundos.
  - Miniaturas dos diagramas de acordes utilizados na música.
  - Indicador de estrelas salvas (0 a 3 estrelas preenchidas).
- **Critérios de Aceitação:**
  - Clique no card navega diretamente para `/practice/[songId]`.

---

#### Tarefa 5.5: Página Completa de Treino da Música com Esteira e HUD
- **Meta:** Integrar todos os sistemas na rota dinâmica `src/app/practice/[songId]/page.tsx`.
- **Arquivos a Criar:**
  - `src/app/practice/[songId]/page.tsx`
- **Fluxo de Inicialização:**
  1. Carrega os dados da música correspondente via `songId`.
  2. Apresenta tela de pré-partida com botões "Afinar Violão Antes de Começar" e "Começar Lição".
  3. No clique do usuário, inicializa `AudioContext` com desbloqueio síncrono.
  4. Ativa a esteira de rolagem sincronizada com metrônomo sonoro e detecção de acordes.
  5. Aciona o Wait Mode em hesitações e encerra exibindo o modal de resultados.
- **Critérios de Aceitação:**
  - Treino de ponta a ponta plenamente funcional em todas as 5 lições do catálogo.

---

### Sprint 6: Responsividade, Auditoria de QA e Deploy

**Meta do Sprint:** Realizar ajustes ergonômicos de visualização em smartphones na estante de partitura, auditoria de performance de 60 FPS, teste de build e preparação para deploy contínuo no GitHub e Vercel.

---

#### Tarefa 6.1: Otimização de Layout Mobile-First e Orientação Paisagem
- **Meta:** Garantir ergonomia visual superior quando o smartphone estiver apoiado no tampo do violão ou estante de partitura.
- **Arquivos a Modificar:**
  - `src/app/practice/[songId]/page.tsx`
  - `src/components/canvas/conveyor-canvas.tsx`
- **Especificações:**
  - Detecção de orientação de tela: se em modo retrato (portrait) na esteira de treino, exibe prompt visual elegante: *"Para melhor visualização da esteira, gire o celular para a posição horizontal (paisagem)"*.
  - Redimensionamento dinâmico via `ResizeObserver` ajustando o `canvas.width` e `canvas.height` mantendo a escala de proporção dos elementos.
- **Critérios de Aceitação:**
  - Canvas redimensiona sem distorção e sem reiniciar a música em curso.

---

#### Tarefa 6.2: Prevenção de Suspensão de Tela (Screen Wake Lock API)
- **Meta:** Integrar a Screen Wake Lock API nativa para evitar que a tela do dispositivo apague enquanto o aluno pratica.
- **Arquivos a Modificar:**
  - `src/hooks/useWakeLock.ts`
  - `src/app/practice/[songId]/page.tsx`
- **Especificações:**
  - Solicita `navigator.wakeLock.request('screen')` ao iniciar a lição.
  - Libera o lock automaticamente ao concluir ou pausar a música.
- **Critérios de Aceitação:**
  - Não lança erros em navegadores sem suporte à API (degradação graciosa).

---

#### Tarefa 6.3: Execução da Suíte Completa de Testes Automatizados no Vitest
- **Meta:** Executar todos os testes unitários e de integração de ponta a ponta com relatório de cobertura.
- **Comando de Teste:**
  `npm run test:coverage`
- **Metas de Cobertura de Código:**
  - Módulos de DSP (`src/audio/`): $\ge 90\%$ de cobertura de branches e linhas.
  - Módulos de Dados (`src/songs/`): $100\%$ de cobertura na validação de schema.
  - Lógica do Game Engine (`src/hooks/useConveyorGame.ts`): $\ge 85\%$ de cobertura.
- **Critérios de Aceitação:**
  - Zero testes falhando e cobertura global acima de 85%.

---

#### Tarefa 6.4: Auditoria de Performance de Frame Rate e Zero Alocações de GC
- **Meta:** Verificar através do Chrome DevTools Performance que não ocorrem picos de Garbage Collection (GC) ou quedas abaixo de 58 FPS durante a rolagem contínua da esteira.
- **Critérios de Aceitação:**
  - Frame budget de renderização gráfica $\le 1.0\text{ ms}$.
  - Frame budget de análise DSP $\le 5.5\text{ ms}$.
  - Taxa média de quadros estável em 60 FPS durante 2 minutos de execução.

---

#### Tarefa 6.5: Pipeline de Build de Produção e Configuração de Deploy na Vercel
- **Meta:** Assegurar que o projeto constrói com perfeição (`npm run build`) e configurar as instruções de publicação na Vercel com HTTPS habilitado.
- **Arquivos a Criar:**
  - `vercel.json` (cabeçalhos de segurança e cache estático)
- **Especificações:**
  - Garantir HTTPS obrigatório (requisito essencial para acesso ao microfone via `navigator.mediaDevices.getUserMedia`).
  - Headers de áudio e segurança: `Permissions-Policy: microphone=*`.
- **Critérios de Aceitação:**
  - O comando `npm run build` completa sem warnings de TypeScript ou ESLint.
  - Aplicação pronta para deploy imediato com 1 comando na Vercel.

---

## 5. Matriz de Riscos de Engenharia & Estratégias de Mitigação

| Risco Técnico Identificado | Probabilidade | Impacto | Estratégia de Mitigação Implementada no Plano |
| :--- | :---: | :---: | :--- |
| **Microfone de celular com corte abrupto abaixo de 100 Hz** (dificuldade em detectar E2 a 82 Hz) | Média | Alto | O algoritmo YIN opera no domínio do tempo pela autocorrelação/CMNDF, capturando o período fundamental através dos harmônicos superiores (*Missing Fundamental*). |
| **GC Stutters no Chrome / Safari Mobile** causados por alocações dinâmicas | Alta | Alto | Diretriz estrita Zero-GC em todas as classes de DSP e Canvas: buffers reutilizados e objetos de retorno pré-alocados. |
| **Autoplay Policy bloqueando áudio no iOS** | Alta | Alto | Instanciação e chamada de `.resume()` estritamente encapsuladas em manipulador síncrono de evento de clique/toque do usuário. |
| **Falsos positivos de acordes causados por ruído percussivo da palheta** | Média | Médio | Filtro de histerese temporal exigindo confirmação de 8 frames consecutivos (~133ms) com score $\ge 0.72$ antes de acionar a UI. |
| **Desvio temporal entre Canvas e Áudio** (*Audio-Visual Drift*) | Média | Médio | Sincronização centralizada ancorada exclusivamente em `AudioContext.currentTime`. |

---

## 6. Critérios de Aceitação Globais (Definition of Done - DoD)

O projeto EzViola será considerado formalmente concluído para a Fase 2/Fase 3 quando:
1. **Compilação e Tipagem:** `npm run build` executar com 0 erros de compilação em modo TypeScript estrito.
2. **Suíte de Testes:** Todos os testes no Vitest executarem com 100% de aprovação (`npm test`).
3. **Afinador:** O afinador detectar as 6 cordas do violão e indicar afinação precisa dentro da janela de $\pm 5\text{ cents}$ em verde neon.
4. **Reconhecimento Harmônico:** Os acordes `Em`, `G`, `D`, `C`, `Am7`, `Bm7` e `D6add9_Fsharp` forem identificados com confiança e sem conflitos de terceiras.
5. **Esteira Yousician:** A esteira 2D Canvas rodar a 60 FPS contínuos, reagindo com Perfect, Good e Miss conforme as janelas temporais de $\pm 50\text{ms}$ e $\pm 120\text{ms}$.
6. **Wait Mode:** A esteira pausar suavemente quando o usuário hesitar e retomar automaticamente no momento em que o acorde correto for dedilhado no violão real.
7. **Catálogo Pedagógico:** Todos os 5 módulos de lições puderem ser jogados do início ao fim com pontuação, estrelas e persistência local.
8. **Compatibilidade:** Funcionamento verificado em navegadores desktop e móveis com HTTPS.
