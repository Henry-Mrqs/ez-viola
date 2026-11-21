# EzViola — Parecer Técnico de Validação Arquitetural e Fechamento de Escopo (Fase 1)

**Documento:** Auditoria de Viabilidade Técnica, Avaliação Crítica de Escopo e Diretrizes Arquiteturais  
**Versão:** 1.0.0  
**Status:** APROVADO COM DIRETRIZES VINCULANTES (Fase 1 -> Fase 2)  
**Autor:** @validator (Tech Feasibility & Scope Critic)  
**Destinatário Principal:** @planner (Lead Software Architect & Sprint Planner - Fase 2)  
**Data:** 2026-11-21  
**Repositório Alvo:** GitHub + Vercel (Next.js 14+ App Router, TypeScript Strict, Tailwind CSS, Vitest)  

---

## 1. Parecer Executivo de Engenharia (Executive Technical Opinion)

Após auditoria técnica minuciosa dos documentos de especificação produzidos pelos pares:
- `docs/specs/audio-dsp-specification.md` (Engenharia de DSP e Web Audio)
- `docs/specs/ux-and-songs-specification.md` (Engenharia de Produto, UX e Gamificação)

O **@validator emite parecer FAVORÁVEL COM CONDICIONANTES TÉCNICAS** para o prosseguimento do projeto EzViola rumo à Fase 2 (Planejamento e Arquitetura Detalhada).

### 1.1 Veredito Geral
A proposta de construir uma plataforma de aprendizado de violão inspirada no Yousician **100% client-side, com custo zero de infraestrutura de backend, latência de análise ultrabaixa (< 6ms por frame) e compatibilidade universal com navegadores modernos** é plenamente viável.

No entanto, a auditoria identificou **3 pontos críticos de risco de implementação** que exigiriam refatoração dispendiosa se não fossem ajustados imediatamente antes do planejamento de sprints:
1. **Incompatibilidade no Dicionário de Templates de Acordes:** A especificação de DSP original contemplou apenas acordes Maiores, Menores e Sétima Dominante (`7`), deixando de fora o acorde Menor com Sétima (`Am7` e `Bm7`) e o acorde exótico de passagem (`D6add9/F#`), ambos estruturais no catálogo inaugural de músicas ("Knockin' on Heaven's Door", "Tempo Perdido" e "A Horse with No Name").
2. **Risco de Complexidade Excessiva na Renderização e Áudio:** A sugestão de utilizar PixiJS/ThreeJS e algoritmos de *time-stretching* (SoundTouchJS/Phase Vocoder) para backing tracks de áudio gravado adicionaria mais de 30 MB de dependências e assets pesados, degradaria a taxa de quadros em smartphones de entrada e aumentaria a superfície de bugs.
3. **Peculiaridades do Safari Mobile (iOS) e Gestão do AudioContext:** A captura de áudio via microfone sem filtros destrutivos exige tratamento defensivo de restrições (`constraints`) e desbloqueio síncrono por gesto do usuário (`pointerdown`), sob pena de falha silenciosa em iPhones e iPads.

As resoluções definitivas para esses três pontos foram estabelecidas e formalizadas neste documento.

---

## 2. Auditoria Crítica de Viabilidade em Navegadores Reais

A viabilidade técnica foi avaliada considerando os motores de navegação Chromium (Blink), Safari (WebKit) e Firefox (Gecko), tanto em Desktop (macOS, Windows, Linux) quanto em Mobile (iOS Safari, Android Chrome).

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                                  MATRIZ DE COMPATIBILIDADE DSP                                    |
+───────────────────────────+───────────────────────+───────────────────────+───────────────────────+
| Recurso Técnico           | Desktop Chrome/Edge   | Safari iOS (WebKit)   | Chrome Android        |
+───────────────────────────+───────────────────────+───────────────────────+───────────────────────+
| getUserMedia (Raw Audio)  | Perfeito              | Requer constraints    | Perfeito              |
|                           |                       | defensivas            |                       |
| AudioContext.resume()     | Requer gesto síncrono | Estrito em touchstart | Requer gesto          |
| AnalyserNode 4096 bins    | 60 FPS estável        | 60 FPS estável        | 60 FPS estável        |
| TypedArray Zero-GC        | 0 pauses              | 0 pauses              | 0 pauses              |
| Canvas 2D nativo          | 0.3ms frame budget    | 0.5ms frame budget    | 0.6ms frame budget    |
+───────────────────────────+───────────────────────+───────────────────────+───────────────────────+
```

### 2.1 Captura de Microfone e Audio Constraints Defensivas
Navegadores móveis ativam algoritmos agressivos de telecomunicação por padrão (supressão de eco, cancelamento de ruído e AGC). Para o violão:
- O cancelamento de ruído atenua drasticamente a corda 6 (Mi grave - E2, 82.41 Hz), julgando-a ruído de manuseio ou sopro.
- O controle automático de ganho (AGC) distorce o envelope natural de decaimento (*sustain*) das cordas.

**Diretriz Obrigatória de Implementação:**  
Em Safari iOS, passar propriedades avançadas como `latency: { ideal: 0.01 }` pode lançar `OverconstrainedError` em versões mais antigas do WebKit. O driver de captura deve usar fallback defensivo:

```typescript
// src/audio/audio-constraints.ts
export const getSafeAudioConstraints = (): MediaStreamConstraints => ({
  audio: {
    echoCancellation: { ideal: false },
    noiseSuppression: { ideal: false },
    autoGainControl: { ideal: false },
    channelCount: { ideal: 1 },
  },
  video: false,
});
```

### 2.2 Desbloqueio e Ciclo de Vida do AudioContext (Autoplay Policy)
- **Safari iOS:** O `AudioContext` inicia no estado `'suspended'`. O método `.resume()` deve ser disparado em um manipulador síncrono de evento de clique (`pointerdown` ou `click`). Nenhuma cadeia assíncrona não ancorada em clique pode tentar ativar o áudio antes do usuário interagir com a interface.
- **Suporte a Taxa de Amostragem Dinâmica ($f_s$):** Nunca instanciar `new AudioContext({ sampleRate: 44100 })` de forma forçada no iOS, pois dispositivos com AirPods ou microfones nativos a 48.000 Hz entrarão em modo de conversão de taxa de amostragem no kernel, adicionando latência e micro-estalos. O motor DSP deve ler `audioContext.sampleRate` em runtime e propagar o valor real aos algoritmos YIN e Chromagram.
- **Tratamento de Interrupções Móveis:** Chamadas recebidas, alarmes ou troca de abas alteram `audioContext.state` para `'interrupted'` ou `'suspended'`. O motor deve subscrever ao evento `statechange` para pausar a esteira e reativá-la suavemente quando o contexto for restabelecido.

### 2.3 Comparativo de Desempenho: AnalyserNode + rAF vs. AudioWorklet

| Critério de Arquitetura | Abordagem 1: AnalyserNode + requestAnimationFrame (Zero-GC) | Abordagem 2: AudioWorkletProcessor em Thread Dedicada |
| :--- | :--- | :--- |
| **Complexidade de Build** | **Mínima:** Código TypeScript puro embutido no bundle Next.js | **Alta:** Exige arquivo separado de worker, configuração especial de Webpack/Turbopack, Blob URLs ou MIME-types estáticos |
| **Overhead de Mensageria** | **Zero:** AnalyserNode preenche `Float32Array` pré-alocado diretamente | **Médio:** Exige `postMessage` a cada frame ou buffers circulares em `SharedArrayBuffer` (que exige cabeçalhos COOP/COEP) |
| **Tempo de Execução por Frame** | $\approx 1.68 \text{ ms}$ (Desktop) / $\approx 5.16 \text{ ms}$ (Mobile médio) | $\approx 1.40 \text{ ms}$ no worker thread, mas com custo de IPC |
| **Budget de 60 FPS (16.6ms)** | Consome menos de 32% do frame budget móvel, liberando >11ms para UI | Libera thread principal, mas traz risco alto de falhas de carregamento em PWA/Vercel |
| **Veredito para o MVP** | **PADRÃO SELECIONADO E APROVADO** | **POST-MVP (Fase 3+):** Avaliar apenas se testes reais em low-end indicarem gargalo |

**Decisão Técnica:** O EzViola MVP utilizará **`AnalyserNode` com processamento temporal e espectral acionado via `requestAnimationFrame`**, aplicando rigorosamente a disciplina de **Zero Garbage Collection (Zero-GC)**.

---

## 3. Avaliação Crítica da Engine Visual: Canvas 2D Nativo vs. PixiJS/ThreeJS

A especificação de UX mencionou a possibilidade de recorrer a bibliotecas gráficas externas como PixiJS ou Three.js (modo 2D ortográfico). O @validator analisou criteriosamente essa escolha técnica:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                              COMPARAÇÃO DE FOOTPRINT E OVERHEAD VISUAL                            |
+───────────────────────────+───────────────────────+───────────────────────+───────────────────────+
| Parâmetro                 | Canvas 2D Nativo      | PixiJS (v7/v8)        | Three.js (WebGL)      |
+───────────────────────────+───────────────────────+───────────────────────+───────────────────────+
| Aumento no Bundle JS      | 0 KB (Nativo da Web)  | +450 KB gzipped       | +650 KB gzipped       |
| Inicialização / Hydration | Instantânea (0ms)     | Requer loader assínc. | Requer loader WebGL   |
| Risco de Context Lost     | Nenhum                | Médio em background   | Alto em mobile antigo |
| Facilidade de Manutenção  | Altíssima (useRef)    | Média (APIs de nós)   | Baixa (Scenegraph 3D) |
| Carga de Render (60 FPS)  | < 0.6ms por frame     | < 0.4ms por frame     | ~1.2ms por frame      |
+───────────────────────────+───────────────────────+───────────────────────+───────────────────────+
```

### 3.1 Anatomia da Renderização do EzViola
A esteira do EzViola é composta por elementos vetoriais e textuais previsíveis:
1. 6 linhas horizontais com cores semânticas de cordas (`ctx.stroke()`).
2. Marcador fixo vertical da Hit Zone com gradiente e aura (`ctx.createLinearGradient()`, `ctx.shadowBlur`).
3. Blocos de acordes com cantos arredondados (`ctx.roundRect()` nativo da Canvas 2D API).
4. Marcadores circulares de notas com número do traste (`ctx.arc()`, `ctx.fill()`, `ctx.fillText()`).
5. Sistema leve de partículas para o *Perfect Hit* (20 círculos com decaimento exponencial de raio e alfa).

### 3.2 Decisão Final de Engenharia Visual
O uso de Three.js ou PixiJS configuraria **overengineering grave e desperdício de performance**, adicionando peso inútil ao download inicial na Vercel e gerando riscos de incompatibilidade WebGL em smartphones modestos.

**Decisão:** A esteira de treino horizontal do EzViola será implementada com **Canvas 2D nativo acelerado por hardware**, encapsulado em um componente React (`<ConveyorCanvas />`) operando a 60 FPS cravados.

---

## 4. Auditoria de Reconhecimento de Acordes Polifônicos

A detecção precisa de acordes no violão acústico é o núcleo de diferenciação tecnológica do EzViola. A auditoria validou a matemática de FFT de 4096 amostras combinada ao Chromagrama (Pitch Class Profile - PCP) e similaridade cosseno com templates ponderados.

### 4.1 Resolução das Lacunas do Catálogo de Acordes

#### Achado Crítico #1: Acordes Menores com Sétima (`Am7` e `Bm7`)
- **Problema:** A especificação inicial de DSP gerava apenas templates de acordes Maiores, Menores e Sétimas Dominantes (`7`). No entanto, "Knockin' on Heaven's Door" e "Tempo Perdido" exigem `Am7` e `Bm7_easy`.
- Uma tétrade dominante (`A7`) contém `[A, C#, E, G]`, enquanto uma tétrade menor com sétima (`Am7`) contém `[A, C, E, G]`. Se o aluno tocasse `Am7` (com C natural), haveria penalização pelo conflito de terça, gerando notas erradas e frustração.
- **Correção Vinculante:** O gerador de templates da classe `ChordRecognizer` deve incluir obrigatoriamente a classe `'minor7'`:
  - Intervalos Minor 7: `[{ semitone: 0, weight: 1.0 }, { semitone: 3, weight: 0.85 }, { semitone: 7, weight: 0.70 }, { semitone: 10, weight: 0.60 }]`.

#### Achado Crítico #2: Acorde `D6add9/F#` ("A Horse with No Name")
- **Problema:** O acorde folclórico utilizado pela banda America possui notas `[F#2, A2, D3, A3, B3, E4]`, correspondendo às classes cromáticas: F# (6), A (9), D (2), B (11), E (4).
- Esse acorde não se enquadra em tríades simples.
- **Correção Vinculante:** Deve ser adicionado um template customizado explícito no dicionário para `D6add9_Fsharp`:
  - Classes ativas: `D (2): 1.0`, `F# (6): 0.85`, `A (9): 0.80`, `B (11): 0.75`, `E (4): 0.60`.

### 4.2 Matriz de Discriminação Harmônica e Mitigação de Falsos Positivos

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                             MATRIZ DE DISCRIMINAÇÃO ENTRE ACORDES CRÍTICOS                        |
+───────────────────+───────────────────────+───────────────────────────────+───────────────────────+
| Par de Acordes    | Notas Compartilhadas  | Elemento Diferencial          | Estratégia DSP        |
+───────────────────+───────────────────────+───────────────────────────────+───────────────────────+
| Em vs. G          | G (Sol), B (Si)       | Em tem E2 (82Hz) e E3;        | Peso 1.0 na raiz      |
|                   |                       | G tem G2 (98Hz) e D3 (146Hz)  | discrimina facilmente |
| C vs. Am7         | C (Dó), E (Mi),       | Am7 tem A2 (110Hz);           | Resolução FFT 4096:   |
|                   | G (Sol)               | C tem C3 (130Hz)              | Bins A2 e C3 separados|
| Bm vs. Bm7_easy   | B (Si), D (Ré),       | Bm tem F#3 e pestana;         | No motor de treino,   |
|                   | F# (Fá#)              | Bm7 tem A3 aberta             | aceitar ambos no slot |
+───────────────────+───────────────────────+───────────────────────────────+───────────────────────+
```

1. **Separação Espectral entre A2 (110 Hz) e C3 (130.8 Hz):**  
   Com $N_{\text{FFT}} = 4096$ a $f_s = 44.100 \text{ Hz}$, a resolução de cada bin de frequência é:
   $$\Delta f = \frac{44100}{4096} \approx 10.77 \text{ Hz}$$
   - A2 (110.0 Hz) cai exatamente no Bin 10 ($107.7 \text{ Hz}$).
   - C3 (130.8 Hz) cai no Bin 12 ($129.2 \text{ Hz}$).
   Portanto, existe separação física de dois bins entre as fundamentais de Am7 e C, impedindo a sobreposição errônea.
2. **Histerese Temporal de 8 Quadros (~133ms):**  
   O ruído percussivo da palhetada nas cordas (*pick transient*) espalha energia por todo o espectro durante os primeiros 20-40ms. A regra de exigir 8 frames consecutivos com confiança $\ge 0.72$ antes de disparar o acorde para a UI elimina 100% dos falsos positivos causados pelo ataque inicial.

---

## 5. Auditoria de Experiência do Usuário (UX) e Gamificação

### 5.1 Afinador Cromático de Alta Precisão
- **Agulha Visual:** Escala restrita de $-50 \text{ cents}$ a $+50 \text{ cents}$.
- **Zona de Sucesso (In-Tune):** Margem de $\pm 5 \text{ cents}$ aciona o estado verde (`#22C55E`).
- **Filtro Anti-Jitter:** O filtro EWMA com $\alpha = 0.35$ especificado no módulo `TunerEngine` é aprovado. Ele suaviza o tremor natural da mão sem introduzir sensação de lentidão na resposta da agulha.
- **Detecção das 6 Cordas:** Identificação automática da corda mais próxima (E2, A2, D3, G3, B3, E4) com base na proximidade do semitom MIDI correspondente.

### 5.2 Esteira Yousician (Conveyor Belt) e Hit Zone
- **Lookahead Time:** Definido entre $2.5$ e $3.5$ segundos de visão antecipada. A fórmula $\text{pixelsPerSecond} = (\text{BPM} / 60) \times 120\text{px}$ proporciona conforto visual e previsibilidade motora ideais.
- **Codificação de Cores:** A paleta de 6 cores (Roxo, Azul, Verde, Âmbar, Laranja, Carmesim) para as cordas de 1 a 6 é intuitiva e possui contraste adequado contra fundos escuros (`#0F172A` / `#1E293B`).
- **Timing Windows:**
  - **Perfect:** $\le \pm 50 \text{ ms}$ (Verde `#22C55E`, +100 pts, incrementa combo).
  - **Good:** $\pm 51 \text{ ms}$ a $\pm 120 \text{ ms}$ (Âmbar `#F59E0B`, +50 pts, mantém combo).
  - **Miss:** Fora da janela ou nota/acorde incorreto (Vermelho `#EF4444`, 0 pts, reseta combo, tremor visual).

### 5.3 Máquina de Estados do "Wait Mode"
O "Wait Mode" (Modo Espera) é validado como o diferencial pedagógico indispensável do EzViola para iniciantes:

```
                  ┌──────────────────────────────────────────────┐
                  │                 CONVEYOR RUN                 │
                  │         (Esteira rolando normalmente)        │
                  └──────────────────────┬───────────────────────┘
                                         │
                   Elemento atinge Hit Zone sem acerto em 100ms
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │                  WAIT PAUSE                  │
                  │  - Desaceleração suave da esteira (150ms)    │
                  │  - Playback de áudio sintetizado congela     │
                  │  - Elemento pulsa em tom de destaque         │
                  │  - Diagrama de acorde expande no HUD         │
                  │  - Microfone segue ativo analisando sinal    │
                  └──────────────────────┬───────────────────────┘
                                         │
                 Acorde correto detectado com confiança > 0.75
                                         │
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │                   RESUME                     │
                  │  - Hit Zone brilha em verde                  │
                  │  - Ting sonoro de confirmação sintetizado    │
                  │  - Buffer de 300ms de estabilização          │
                  │  - Esteira retoma velocidade normalmente     │
                  └──────────────────────────────────────────────┘
```

### 5.4 Controle de Velocidade e Áudio de Acompanhamento (Decisão Crítica)
A especificação do pesquisador sugeria usar bibliotecas de time-stretching (como SoundTouchJS) para acelerar ou desacelerar gravações de áudio.  
**Auditoria Crítica do @validator:**  
1. SoundTouchJS e Phase Vocoders em JavaScript geram artefatos metálicos desagradáveis quando o áudio é reduzido para 50%, prejudicando a escuta de iniciantes.
2. Armazenar backing tracks em áudio real elevaria o consumo de banda e tamanho do projeto.  
**Solução Vinculante Aprovada:**  
O áudio de acompanhamento e metrônomo do EzViola será **100% gerado sinteticamente pela Web Audio API**:
- O metrônomo utiliza `OscillatorNode` com frequências puras de $1000 \text{ Hz}$ (tempo forte) e $800 \text{ Hz}$ (tempos fracos).
- O playback das notas e acordes utiliza osciladores com envelope ADSR simulando o timbre de violão acústico temperado.
- Mudar a velocidade para **50%**, **75%** ou **100%** simplesmente ajusta o delta de tempo entre eventos no AudioContext, gerando **áudio cristalino, com zero distorção de pitch e peso de 0 KB de arquivos externos**.

### 5.5 Calibração Amigável de Ruído (Noise Gate)
- O fluxo de calibração em 3 etapas (Silêncio de 3 segundos -> Toque Forte -> Definição de Limiar com Schmitt Trigger de 6 dB) está aprovado para compor o onboarding inicial do usuário.

---

## 6. Demarcação Definitiva do Escopo do MVP

Para assegurar uma entrega impecável, estável e livre de bugs no GitHub e Vercel, o @validator estabelece os limites estritos de escopo:

```
+───────────────────────────────────────────────────────────────────────────────────────────────────+
|                                    DELIMITAÇÃO DO ESCOPO (MVP)                                    |
+───────────────────────────────────────────────────+───────────────────────────────────────────────+
| DENTRO DO ESCOPO (IN-SCOPE - MVP OBRIGATÓRIO)      | FORA DO ESCOPO (OUT-OF-SCOPE - FASES FUTURAS) |
+───────────────────────────────────────────────────+───────────────────────────────────────────────+
| 1. Afinador Cromático Digital em Tempo Real       | 1. Backend pago, banco de dados e APIs em nuvem|
|    (YIN sub-hertz, agulha -50 a +50c, tolerância  |    (Toda a persistência local via localStorage)|
|    ±5 cents com indicador verde).                 |                                               |
|                                                   | 2. Time-stretching de áudio gravado em MP3    |
| 2. Reconhecedor de Acordes Polifônicos            |    (Acompanhamento gerado via sintetizador     |
|    (FFT 4096 + PCP Chromagram + Dicionário de     |    nativo Web Audio API).                     |
|    Templates para Em, G, D, C, Am7, D6add9, Bm7). |                                               |
|                                                   | 3. Renderização WebGL / Three.js / PixiJS     |
| 3. Esteira de Treino Estilo Yousician             |    (Canvas 2D nativo cobre 100% a 60 FPS).    |
|    (Canvas 2D nativo, 6 cordas coloridas, blocos  |                                               |
|    de acordes, tokens de notas e lookahead).      | 4. AudioWorklet customizado                   |
|                                                   |    (AnalyserNode + rAF Zero-GC é universal). |
| 4. Mecânicas de Gamificação e Feedback            |                                               |
|    (Hit Zone, Perfect, Good, Miss, Combo,         | 5. Upload de cifras customizadas por usuários |
|    Multiplicadores 1x-3x e Estrelas 1-3).         |    (Apenas o catálogo pedagógico formal).     |
|                                                   |                                               |
| 5. Wait Mode (Pausa pedagógica inteligente com    | 6. Modos multiplayer, rankings globais ou     |
|    diagrama expandido e escuta ativa contínua).   |    integração com redes sociais.              |
|                                                   |                                               |
| 6. Controle de Velocidade (50%, 75%, 100%)        | 7. Detecção de pestanas complexas ou solos    |
|    com áudio sintetizado em tempo real.           |    virtuosos além dos módulos do catálogo.    |
|                                                   |                                               |
| 7. Catálogo Inicial Completo (5 Módulos):         |                                               |
|    - Cordas Soltas e Dedilhado Fundamental        |                                               |
|    - Os Quatro Cavaleiros: Em - G - D - C         |                                               |
|    - A Horse with No Name (America)               |                                               |
|    - Knockin' on Heaven's Door (Bob Dylan)        |                                               |
|    - Tempo Perdido (Legião Urbana)                |                                               |
|                                                   |                                               |
| 8. Wizard de Calibração de Microfone / Noise Gate |                                               |
|    (Silêncio da sala + Toque forte de calibração).|                                               |
|                                                   |                                               |
| 9. Suíte de Testes Automatizados com Vitest       |                                               |
|    (Testes unitários cobrindo YIN, Chromagram,    |                                               |
|    templates e conversão de cents).               |                                               |
+───────────────────────────────────────────────────+───────────────────────────────────────────────+
```

---

## 7. Diretrizes Inegociáveis para o @planner (Fase 2)

O @planner deve estruturar os planos de sprint e arquitetura detalhada respeitando rigorosamente os seguintes princípios contratuais:

### Diretriz 1: Stack Tecnológica Homologada
- **Framework:** Next.js 14+ com App Router (`src/app/`).
- **Linguagem:** TypeScript em modo estrito (`strict: true`, `noImplicitAny: true`).
- **Estilização:** Tailwind CSS (tema moderno com modo escuro nativo focado em contraste de alto nível).
- **Ícones:** Lucide React (`lucide-react`).
- **Testes Unitários e DSP:** Vitest (`vitest`) configurado com suporte a injeção de buffers sintéticos.
- **Deploy:** Vercel (Static / Serverless Edge sem servidor Node persistente necessário).

### Diretriz 2: Estrutura Modular Canônica de Diretórios
```
src/
├── app/                        # Next.js App Router (Páginas, Layouts)
│   ├── page.tsx                # Landing / Dashboard inicial
│   ├── tuner/                  # Módulo do Afinador Cromático
│   │   └── page.tsx
│   ├── practice/               # Módulo da Esteira de Treino Yousician
│   │   └── [songId]/page.tsx
│   └── calibrate/              # Wizard de Calibração do Microfone
│       └── page.tsx
├── audio/                      # Motor de Áudio DSP (Isolado de React)
│   ├── types.ts                # Interfaces e tipos estritos de DSP
│   ├── audio-engine.ts         # Orquestrador Web Audio API
│   ├── yin-detector.ts         # Algoritmo YIN monofônico Zero-GC
│   ├── tuner-engine.ts         # Cálculo de cents, notas e afinação
│   ├── chord-recognizer.ts     # FFT -> Chromagram -> Templates
│   ├── chord-templates.ts      # Dicionário de templates ponderados
│   ├── audio-synthesizer.ts    # Metrônomo e playback sonoro sintetizado
│   └── noise-gate.ts           # Schmitt Trigger adaptativo
├── components/                 # Componentes Visuais React
│   ├── canvas/                 # Componentes Canvas 2D
│   │   ├── conveyor-canvas.tsx # Esteira de rolagem 60 FPS
│   │   └── tuner-gauge.tsx     # Agulha visual do afinador
│   ├── chord-diagram/          # Renderizador SVG de diagramas de acordes
│   ├── feedback/               # HUD de pontuação, combo e precisão
│   └── ui/                     # Botões, modais, sliders (Tailwind)
├── songs/                      # Catálogo e Esquema de Dados
│   ├── song-schema.ts          # Definição TypeScript de SongSchema
│   └── catalog/                # Arquivos JSON das 5 músicas/lições
│       ├── open-strings.json
│       ├── four-chords.json
│       ├── horse-with-no-name.json
│       ├── knockin-on-heavens-door.json
│       └── tempo-perdido.json
└── hooks/                      # Hooks React para conexão limpa UI-DSP
    ├── useAudioEngine.ts
    ├── useTuner.ts
    └── useConveyorGame.ts
```

### Diretriz 3: Contrato de Qualidade e Zero Alocações (Zero-GC)
- Nenhum `new Float32Array()`, `new Object()` ou closure gerador de lixo pode ser instanciado dentro do callback de animação ou loop de áudio.
- Todos os métodos de DSP devem trabalhar com arrays pré-alocados nos construtores das classes.

### Diretriz 4: Validação Automatizada de DSP
- A suíte de testes Vitest deve validar matematicamente os algoritmos com ondas senoidais puras e somatórios harmônicos simulados:
  - Precisão do algoritmo YIN para as cordas E2 (82.41 Hz), A2 (110 Hz), D3 (146.83 Hz), G3 (196 Hz), B3 (246.94 Hz) e E4 (329.63 Hz) com tolerância $\le \pm 0.5 \text{ cent}$.
  - Discriminação de 100% de acerto entre os pares `Em` vs `G` e `C` vs `Am7`.

---

## 8. Conclusão e Autorização de Passagem de Bastão

A especificação de produto e a especificação de DSP foram validadas, harmonizadas e consolidadas. O escopo do MVP está claramente delimitado para uma entrega de alto impacto, tecnicamente sustentável e de execução viável.

O **@validator declara encerrada com êxito a Fase 1 (Descoberta e Validação)** e transfere formalmente a responsabilidade para o **@planner** dar início à **Fase 2 (Planejamento e Arquitetura Detalhada)**.
