# EzViola — Plano Cirúrgico de Implementação: Refatoração DSP & UX Iniciante
## Estabilização de Pitch Industrial, Calibração Hands-Free (Zero Cliques) e Orientação Visual Anatômica

**Documento:** Plano de Implementação Granular e Atômico (Implementation Architecture Plan)  
**Versão:** 1.0.0  
**Status:** **PRONTO PARA EXECUÇÃO PELO @developer**  
**Autor:** @planner (Implementation Architect & Sprint Planner)  
**Destinatários:** @developer (Lead Frontend/DSP Engineer), @audio-dsp, @ux-designer, @validator  
**Data:** 2026-11-22  
**Repositório:** `C:/Users/henry/www/ez-viola/`  
**Deploy Target:** Next.js 14+ / Vercel / GitHub  
**Documentos Homologados Vinculantes:**
- `docs/specs/brainstorming-refactor-consensus.md` (Parecer de Homologação Arquitetural e Diretrizes Vinculantes)
- `docs/specs/benchmark-and-pitch-stabilization-research.md` (Pesquisa de DSP, Erros de Oitava e Benchmarks GuitarTuna/Cifra Club)
- `docs/specs/hands-free-calibration-dsp-spec.md` (Especificação de DSP de Calibração Hands-Free e Onset ODF)
- `docs/specs/beginner-visual-guidance-spec.md` (Especificação de Design de UX para o "Iniciante Zero")

---

## 1. Sumário Executivo & Princípios Arquiteturais Inegociáveis

Este plano estabelece a sequência cirúrgica de tarefas para resolver definitivamente os dois maiores gargalos técnicos e de produto do **EzViola**:
1. **No Domínio DSP:** Eliminação de 100% dos erros de oitava (octave jumps) na 6ª corda ($E_2 = 82.41\text{ Hz}$), anulação do "efeito pipoca" (*harmonic hopping* entre $82\text{ Hz}$, $165\text{ Hz}$ e $247\text{ Hz}$) e eliminação do tremor errático da agulha através de pré-filtragem adaptativa com `BiquadFilterNode` dinâmico ($f_c = 115\text{ Hz}$ para $E_2$), supressão de ataque (*Attack Blanking* de 60ms), histerese centesimal (*Schmitt Trigger* a $\pm 65\text{ cents}$) e suavização sigmoidal sensível à velocidade (*Sigmoidal Dual-Rate EMA*).
2. **No Domínio de UX e Ergonomia:** Implementação da **Regra de Ouro "Mãos Livres / Zero Cliques"**, permitindo que o estudante calibre e afine seu violão sem largar o instrumento, sustentada por um detector contínuo de transientes (ODF com RMS e Spectral Flux retificado em meia-onda), máquina de estados de 3 toques com rejeição estatística de outliers ($\sigma > 18\text{ cents}$), auto-avanço em 1200ms e uma interface visual anatômica de 2 metros com mapeamento tátil de tarraxas ("APERTE" vs "AFROUXE"), código de cores de dedos (1=Azul, 2=Verde, 3=Laranja, 4=Roxo) e alerta anti-pânico de quebra da Mizinha ($E_4 > +45\text{ cents}$).

### 1.1 Princípios Arquiteturais Obrigatórios
- **Zero-GC Estrito no Loop de Áudio/Frame:** Nenhuma alocação dinâmica (`new Float32Array`, closures com novos objetos, `.map()`, `.filter()`) dentro de `requestAnimationFrame` ou métodos `process()`. Todos os vetores, anéis de mediana e structs de resultado devem ser pré-alocados no construtor.
- **Budget de Frame DSP < 3.5ms:** A esteira completa de processamento por frame (RMS, Spectral Flux, YIN, PitchStabilizer e harmônicos) deve executar em menos de $2.8\text{ ms}$ em smartphones médios para assegurar 60 FPS inabaláveis.
- **Filtro Biquad com Frequência Homologada ($f_c = 115\text{ Hz}$ em $E_2$):** Conforme retificação mandatória do @validator, o filtro passa-baixas da 6ª corda deve cortar estritamente em $115\text{ Hz}$ ($Q = 0.707$) para atenuar o 2º harmônico em $-7.2\text{ dB}$ e o 3º em $-13.5\text{ dB}$.
- **Transição Rápida e Suave de Filtros:** Mudanças de $f_c$ devem usar `biquad.frequency.setTargetAtTime(targetFc, audioCtx.currentTime, 0.040)` para evitar pops/clicks.
- **Compatibilidade Rigorosa:** Todos os 74 testes existentes no Vitest devem continuar passando, sem regressão nas suítes de acordes, esteira ou sintetizador.

---

## 2. Mapa Canônico de Arquivos Afetados

```
C:/Users/henry/www/ez-viola/
├── src/
│   ├── audio/
│   │   ├── types.ts                                     [MODIFICAR] Novos tipos de estabilização, FSM e profile v2
│   │   ├── audio-engine.ts                              [MODIFICAR] Adicionar Biquad adaptativo no grafo DSP
│   │   ├── pitch-stabilizer.ts                          [CRIAR] Mediana 5, Schmitt Trigger, Sigmoidal EMA, Deadband
│   │   ├── transient-detector.ts                        [CRIAR] Detecção contínua ODF (RMS + Spectral Flux)
│   │   ├── hands-free-calibration-engine.ts             [CRIAR] FSM 3 toques, outlier rejection, auto-advance
│   │   ├── tuner-engine.ts                              [MODIFICAR] Integrar PitchStabilizer e Attack Blanking
│   │   ├── guitar-calibration.ts                        [MODIFICAR] Schema v2, injeção e persistência localStorage
│   │   ├── chord-recognizer.ts                          [MODIFICAR] Injeção de perfil v2 e rebuildTemplates
│   │   └── audio-synthesizer.ts                         [MODIFICAR] Adicionar síntese de chimes 880Hz, 1174Hz, 1760Hz
│   ├── components/
│   │   ├── tuner/
│   │   │   ├── guitar-headstock-viewer.tsx              [CRIAR] SVG interativo de tarraxas e alerta de estouro E4
│   │   ├── guitar/
│   │   │   └── animated-fretboard-guide.tsx             [CRIAR] Braço anatômico, dedos coloridos e casas
│   │   ├── calibration/
│   │   │   └── hands-free-calibration-wizard.tsx        [CRIAR] Wizard 100% mãos livres com UI de 2 metros
│   │   └── canvas/
│   │       └── tuner-gauge.tsx                          [MODIFICAR] Status textual explícito em português
│   └── app/
│       ├── tuner/page.tsx                               [MODIFICAR] Incorporar HeadstockViewer e novos feedbacks
│       ├── calibrate/page.tsx                           [MODIFICAR] Substituir wizard legado pelo Hands-Free
│       └── practice/[songId]/page.tsx                   [MODIFICAR] Integrar AnimatedFretboardGuide no Wait Mode
└── tests/
    └── audio/
        ├── pitch-stabilizer.test.ts                     [CRIAR] Testes unitários do estabilizador de pitch
        ├── transient-detector.test.ts                   [CRIAR] Testes de detecção de onsets e rejeição de ruído
        ├── hands-free-calibration-engine.test.ts        [CRIAR] Testes da FSM de 3 ciclos e auto-avanço
        ├── audio-engine.test.ts                         [MODIFICAR] Testes do filtro biquad adaptativo
        ├── tuner-engine.test.ts                         [MODIFICAR] Testes de estabilização e ausência de pipoca
        └── dsp-stabilization-audit.test.ts              [CRIAR] Auditoria sintética final (E2, E4, transientes)
```

---

## 3. Sprint A: Core DSP & Estabilização de Pitch de Nível Industrial

### Objetivo do Sprint A
Eliminar definitivamente os saltos de oitava na 6ª corda ($E_2$), suprimir transientes de impacto de palhetada nos primeiros 60ms e extinguir micro-trepidações visuais na agulha do afinador com filtros matemáticos de precisão industrial.

---

### Tarefa A1: Atualização dos Contratos em `src/audio/types.ts`
- **Arquivo:** `src/audio/types.ts`
- **Ações:**
  1. Adicionar o tipo `TunerTuningAction`:
     ```typescript
     export type TunerTuningAction =
       | 'TIGHTEN'      // Corda frouxa -> APERTE a tarraxa
       | 'LOOSEN'       // Corda esticada -> AFROUXE a tarraxa
       | 'IN_TUNE'      // Afinado dentro da margem
       | 'DANGER_BREAK' // Alerta extremo na 1ª corda (E4 > +45 cents)
       | 'IDLE';        // Sem sinal ou ruído
     ```
  2. Expandir a interface `TunerResult` com novos campos de diagnóstico e estabilidade:
     ```typescript
     export interface TunerResult {
       frequency: number;            // Frequência instantânea YIN (-1 se mudo)
       smoothedFrequency: number;    // Frequência estabilizada pós-EMA/Mediana
       targetFrequency: number;      // Frequência alvo nominal da nota/corda
       noteName: string;             // Nome da nota (ex: "E", "A")
       octave: number;               // Oitava da nota (ex: 2, 4)
       midiNote: number;             // Nota MIDI arredondada
       cents: number;                // Desvio centesimal (-50 a +50)
       rawCents: number;             // Desvio centesimal antes de clamp
       inTune: boolean;              // Math.abs(cents) <= 5.0
       clarity: number;              // Índice de periodicidade YIN (0.0 a 1.0)
       rms: number;                  // Energia RMS do frame
       isGateOpen: boolean;          // Estado do noise gate
       stringIndex: number;          // 0..5 index em GUITAR_STRINGS ou -1
       tuningAction: TunerTuningAction; // Ação mecânica recomendada
       isAttackBlanking: boolean;    // True se dentro da janela de supressão de 60ms
     }
     ```
  3. Adicionar interfaces de configuração do estabilizador de pitch e filtros biquad:
     ```typescript
     export interface PitchStabilizerConfig {
       minAlpha?: number;       // Padrão: 0.12 (firmeza máxima perto do tom)
       maxAlpha?: number;       // Padrão: 0.80 (resposta instantânea em transições)
       inflectionCents?: number;// Padrão: 12.0 cents (ponto de inflexão sigmoidal)
       sigmoidSlope?: number;   // Padrão: 4.0
       deadbandCents?: number;  // Padrão: 0.25 cents (zona morta de micro-ruído)
       hysteresisCents?: number;// Padrão: 65.0 cents (Schmitt Trigger de nota)
       confirmationFrames?: number; // Padrão: 4 frames consecutivos
       decayFreezeMs?: number;  // Padrão: 400 ms (congelamento gracioso no silêncio)
     }
     ```
- **Critério de Aceitação:** Compilação TypeScript estrita sem erros; `npm run lint` limpo.

---

### Tarefa A2: Inclusão do `BiquadFilterNode` Adaptativo em `src/audio/audio-engine.ts`
- **Arquivo:** `src/audio/audio-engine.ts`
- **Ações:**
  1. Declarar a propriedade privada `private adaptiveFilter: BiquadFilterNode | null = null;`.
  2. No método `start()`, após conectar `sourceNode -> highPassFilter (65 Hz)`, instanciar o filtro adaptativo:
     ```typescript
     const adaptive = ctx.createBiquadFilter();
     adaptive.type = "lowpass";
     adaptive.frequency.setValueAtTime(3200, ctx.currentTime); // Padrão banda larga
     adaptive.Q.setValueAtTime(0.707, ctx.currentTime);
     this.adaptiveFilter = adaptive;
     ```
  3. Atualizar o encadeamento Web Audio API:
     `sourceNode -> highPassFilter (65 Hz) -> adaptiveFilter -> tunerAnalyser e chordAnalyser`.
  4. Implementar métodos de ajuste de frequência com rampa suave de 40ms:
     ```typescript
     public setAdaptiveFilterCutoff(cutoffHz: number, type: BiquadFilterType = "lowpass"): void {
       if (!this.adaptiveFilter || !this.audioCtx) return;
       const now = this.audioCtx.currentTime;
       this.adaptiveFilter.type = type;
       this.adaptiveFilter.frequency.setTargetAtTime(cutoffHz, now, 0.040);
     }

     public setAdaptiveFilterForString(stringNumber: number): void {
       // Mapeamento estrito homologado no parecer de consenso:
       // Corda 6 (E2 = 82.41 Hz): fc = 115 Hz (atenua 2º harmônico em -7.2 dB)
       // Corda 5 (A2 = 110.00 Hz): fc = 150 Hz
       // Corda 4 (D3 = 146.83 Hz): fc = 220 Hz
       // Corda 3 (G3 = 196.00 Hz): fc = 300 Hz
       // Corda 2 (B3 = 246.94 Hz): fc = 380 Hz
       // Corda 1 (E4 = 329.63 Hz): fc = 500 Hz
       const CUTOFF_MAP: Record<number, number> = {
         6: 115,
         5: 150,
         4: 220,
         3: 300,
         2: 380,
         1: 500,
       };
       const targetFc = CUTOFF_MAP[stringNumber] ?? 3200;
       this.setAdaptiveFilterCutoff(targetFc, "lowpass");
     }

     public setAdaptiveFilterForChords(): void {
       this.setAdaptiveFilterCutoff(3200, "lowpass");
     }

     public getAdaptiveFilter(): BiquadFilterNode | null {
       return this.adaptiveFilter;
     }
     ```
  5. Assegurar desconexão no método `stop()`: desconectar `this.adaptiveFilter`.
- **Critério de Aceitação:** O grafo conecta sem ruído; `setAdaptiveFilterForString(6)` define $f_c \to 115\text{ Hz}$ com rampa exponencial sem estalos sonoros.

---

### Tarefa A3: Criação de `src/audio/pitch-stabilizer.ts` (Motor Anti-Jitter Industrial)
- **Arquivo:** `src/audio/pitch-stabilizer.ts` (Novo Arquivo)
- **Responsabilidades:**
  1. **Filtro de Mediana de 5 Amostras:** Anel circular Zero-GC com *insertion sort in-place*.
  2. **Schmitt Trigger Centesimal com Confirmação:** Histerese de $\pm 65\text{ cents}$. Uma nova nota só é aceita se mantiver estabilidade por 4 frames consecutivos ($\approx 66\text{ ms}$) com clareza $\ge 0.75$.
  3. **Dual-Rate Velocity-Sensitive Sigmoidal EMA:**
     $$\alpha(\Delta c) = \alpha_{\min} + (\alpha_{\max} - \alpha_{\min}) \cdot \frac{1}{1 + e^{-\frac{\Delta c - c_0}{s}}}$$
     - Se perto da afinação ($|\Delta c| < 6\text{ cents}$): $\alpha \approx 0.12$ (firmeza de agulha estática).
     - Se em transição ($|\Delta c| > 20\text{ cents}$): $\alpha \approx 0.80$ (rastreamento veloz).
  4. **Anti-Jitter Deadband:** Se $|\Delta c| < 0.25\text{ cents}$, a variação é arredondada a zero.
  5. **Graceful Decay Freeze:** Ao cair no silêncio ($\text{isGateOpen} = \text{false}$), congela a última frequência válida por $400\text{ ms}$ antes de zerar, prevenindo piscamento da UI no fim da nota.
  6. **Ação Pedagógica (Tuning Advisor):**
     - Se corda 1 ($E_4$) e $\text{cents} > +45$: `DANGER_BREAK`
     - Se $\text{cents} < -5.0$: `TIGHTEN` ("Corda frouxa — APERTE a tarraxa")
     - Se $\text{cents} > +5.0$: `LOOSEN` ("Corda tensa — AFROUXE a tarraxa")
     - Se $|\text{cents}| \le 5.0$: `IN_TUNE` ("AFINADO!")
- **Assinatura da Classe:**
  ```typescript
  export interface PitchStabilizerOutput {
    frequency: number;
    smoothedFrequency: number;
    targetFrequency: number;
    noteName: string;
    octave: number;
    midiNote: number;
    cents: number;
    rawCents: number;
    inTune: boolean;
    tuningAction: TunerTuningAction;
  }

  export class PitchStabilizer {
    constructor(config?: PitchStabilizerConfig);
    public reset(): void;
    public process(
      rawFreq: number,
      clarity: number,
      isGateOpen: boolean,
      targetLock: GuitarStringSpec | null,
      deltaMs: number
    ): PitchStabilizerOutput;
  }
  ```
- **Critério de Aceitação:** Passar em testes unitários dedicados provando ausência de ruído, histerese estrita e preservação de Zero-GC.

---

### Tarefa A4: Refatoração do `TunerEngine` em `src/audio/tuner-engine.ts`
- **Arquivo:** `src/audio/tuner-engine.ts`
- **Ações:**
  1. Instanciar o `PitchStabilizer` no construtor.
  2. Implementar a janela de **Attack Blanking de 60ms**:
     - Monitorar o onset de ataque via derivada de RMS ($\Delta\text{RMS} / \Delta t$) ou reabertura do gate.
     - Durante os primeiros 60ms subsequentes ao onset, sinalizar `isAttackBlanking = true`.
     - Enquanto `isAttackBlanking = true`, congelar o cálculo centesimal no valor anterior ou aplicar amortecimento pesado ($\alpha = 0.08$), descartando o pitch glide transitório (+25 cents) e ruído da palheta.
  3. Atualizar `setTargetString(stringNumber: number | null)` para que, ao travar uma corda, o `AudioEngine` seja notificado para ajustar o filtro passa-baixas adaptativo correspondente via callback ou método `onTargetStringChange`.
  4. Manter o método `foldGuitarHarmonics(freq)` refinado como segunda linha de defesa harmônica.
  5. Preencher todos os novos campos de `TunerResult`.
- **Critério de Aceitação:** `tuner-engine.test.ts` e novos testes cobrindo estabilização passam com 100% de sucesso.

---

### Tarefa A5: Testes Unitários de DSP e Estabilização com Vitest
- **Arquivos:**
  - `tests/audio/pitch-stabilizer.test.ts` (Novo)
  - `tests/audio/tuner-engine.test.ts` (Atualizar)
- **Cenários Cobertos:**
  1. *Micro-jitter test:* Sinal senoidal fixo em $440\text{ Hz}$ com ruído branco de $\pm 0.2\text{ cents}$: comprovar que o desvio final fica em $0.00\text{ cents}$ (deadband).
  2. *Sigmoidal response test:* Transição abrupta de $82\text{ Hz}$ para $110\text{ Hz}$: demonstrar que o $\alpha$ sobe para $\ge 0.75$, adaptando a leitura em menos de 100ms.
  3. *Schmitt Trigger test:* Oscilação de sinal limítrofe entre $-62\text{ cents}$ e $-58\text{ cents}$: comprovar que a nota base não fica alternando freneticamente.
  4. *Attack Blanking test:* Injeção de burst de impacto (+35 cents nos primeiros 40ms): verificar que a leitura do afinador não reporta o overshoot transitório.
  5. *Harmonic Hopping Elimination:* Injeção de sinal sintético simulando 6ª corda real ($E_2$ a 82.41 Hz com 2º harmônico em 164.82 Hz com $+14\text{ dB}$ de magnitude): provar que a fundamental identificada é rigorosamente $E_2$ e nunca $E_3$.
- **Critério de Aceitação do Sprint A:** Todos os testes do Sprint A executam e passam em `npm test`.

---

## 4. Sprint B: Motor de Calibração Hands-Free em 3 Ciclos (Zero Cliques)

### Objetivo do Sprint B
Criar a esteira autônoma de calibração instrumental baseada em detecção contínua de transientes, máquina de estados com 3 toques por corda/acorde, validação de variância ($\sigma \le 18\text{ cents}$), auto-avanço de 1200ms e feedback sonoro cristalino por síntese direta Web Audio.

---

### Tarefa B1: Criação de `src/audio/transient-detector.ts` (Onset Detector ODF)
- **Arquivo:** `src/audio/transient-detector.ts` (Novo Arquivo)
- **Responsabilidades Matemáticas:**
  1. **Derivada Temporal de Energia ($\Delta\text{RMS}$):**
     $$\text{RMS}[m] = \sqrt{\frac{1}{N} \sum_{n=0}^{N-1} x^2[n]}, \quad \Delta\text{RMS}[m] = \text{RMS}[m] - \text{RMS}[m-1]$$
  2. **Fluxo Espectral com Retificação de Meia-Onda (*Spectral Flux*):**
     $$\text{SF}[m] = \sum_{k=k_{\min}}^{k_{\max}} \frac{(|X[m, k]| - |X[m-1, k]|) + ||X[m, k]| - |X[m-1, k]||}{2}$$
     Com $k_{\min}$ em $70\text{ Hz}$ e $k_{\max}$ em $3500\text{ Hz}$.
  3. **Função Combinada de Ataque (ODF):**
     $$\text{ODF}[m] = 0.40 \cdot \tilde{\Delta\text{RMS}}[m] + 0.60 \cdot \tilde{\text{SF}}[m]$$
  4. **Limiar Adaptativo e Disparo:**
     $$\text{ODF}[m] > (\mu_{\text{ODF}} + 2.5 \cdot \sigma_{\text{ODF}} + 0.15) \quad \text{e} \quad \text{RMS}[m] > 0.012$$
  5. **Filtros de Rejeição de Ruídos Espúrios:**
     - *Critério 1:* Clareza YIN $\ge 0.70$ (rejeita batidas percussivas no corpo do violão).
     - *Critério 2:* Centroide Espectral $\le 3500\text{ Hz}$ (rejeita raspagem de dedo e ruído agudo).
     - *Critério 3:* Janela de afinação da corda alvo $|\Delta c| \le 250\text{ cents}$ (rejeita corda vizinha errada).
  6. **Período de Resfriamento (Cooldown):** $450\text{ ms}$ após o onset confirmado antes de aceitar novo disparo.
- **Assinatura da Classe:**
  ```typescript
  export interface TransientEvent {
    isOnset: boolean;
    rms: number;
    deltaRms: number;
    spectralFlux: number;
    odfValue: number;
    isRejected: boolean;
    rejectionReason?: 'LOW_CLARITY' | 'HIGH_CENTROID' | 'WRONG_STRING_WINDOW';
    timestamp: number;
  }

  export class TransientDetector {
    constructor(sampleRate?: number, fftSize?: number);
    public reset(): void;
    public process(
      timeBuffer: Float32Array,
      freqBuffer: Float32Array,
      clarity: number,
      targetFreq?: number,
      detectedFreq?: number
    ): TransientEvent;
  }
  ```
- **Critério de Aceitação:** Identifica toques límpidos de cordas com acurácia $> 98\%$ e rejeita 100% de batidas no tampo com clareza $< 0.70$.

---

### Tarefa B2: Criação de `src/audio/hands-free-calibration-engine.ts` (FSM Autônoma)
- **Arquivo:** `src/audio/hands-free-calibration-engine.ts` (Novo Arquivo)
- **Máquina de Estados Finita (FSM):**
  - `STANDBY`: Aguardando início do wizard.
  - `CONFIGURING_DSP`: Ajusta o `BiquadFilterNode` adaptativo para a corda alvo corrente e aguarda 50ms de estabilização.
  - `AWAITING_PLUCK`: Escutando transiente legítimo. Inicia temporizador de inatividade (12 segundos) para disparar nudge visual pedagógico caso o aluno hesite.
  - `ATTACK_SETTLING`: Transiente detectado; congela leitura por 60ms para aguardar o término do pitch glide mecânico.
  - `MEASURING_SUSTAIN`: Coleta 3 frames espectrais estáveis (YIN + FFT).
  - `PLUCK_CONFIRMED`: Valida o toque individual e dispara chime auditivo correspondente:
    - Toque 1/3: Clique suave 880 Hz (30ms).
    - Toque 2/3: Clique duplo 1174 Hz (30ms).
    - Toque 3/3: Confirmation Ting 1760 Hz (350ms).
  - `COOLDOWN_WAIT`: Pausa de 400ms para amortecimento natural da corda.
  - `STEP_COMPLETE`: Avalia a dispersão dos 3 toques coletados:
    $$\sigma_{\text{cents}} = 1200 \cdot \frac{\sigma_{f_0}}{\bar{f}_0 \cdot \ln 2}$$
    - Se $\sigma_{\text{cents}} > 18.0\text{ cents}$: Descarta o toque mais distante da mediana, recua o contador de 3/3 para 2/3, toca som de erro amortecido (`playDampedMissSound`) e solicita 1 toque extra com mensagem amigável.
    - Se $\sigma_{\text{cents}} \le 18.0\text{ cents}$: Consolida a média ponderada, armazena no buffer da corda e transita para `AUTO_ADVANCING`.
  - `AUTO_ADVANCING`: Temporização de 1200ms com contagem regressiva para repouso do aluno, avançando automaticamente para a próxima corda (6 $\to$ 1) ou próximo acorde.
  - `CALIBRATION_DONE`: Consolida o perfil completo versão 2, grava em `localStorage` e injeta no `TunerEngine` e `ChordRecognizer`.
- **API Externa da Classe:**
  ```typescript
  export type HandsFreeState =
    | 'STANDBY'
    | 'CONFIGURING_DSP'
    | 'AWAITING_PLUCK'
    | 'ATTACK_SETTLING'
    | 'MEASURING_SUSTAIN'
    | 'PLUCK_CONFIRMED'
    | 'COOLDOWN_WAIT'
    | 'STEP_COMPLETE'
    | 'AUTO_ADVANCING'
    | 'CALIBRATION_DONE';

  export class HandsFreeCalibrationEngine {
    constructor(audioEngine: AudioEngine);
    public startWizard(): void;
    public stopWizard(): void;
    public retryCurrentStep(): void;   // Rota de escape manual: refazer corda atual
    public skipCurrentStep(): void;    // Rota de escape manual: pular corda
    public onFrame(deltaMs: number): void;
    public subscribe(listener: (state: HandsFreeCalibrationProgress) => void): () => void;
  }
  ```
- **Critério de Aceitação:** O fluxo de 6 cordas e acordes é completado sem nenhuma intervenção manual ou clique, com tolerância comprovada a outliers.

---

### Tarefa B3: Extensão do `AudioSynthesizer` com Chimes em `src/audio/audio-synthesizer.ts`
- **Arquivo:** `src/audio/audio-synthesizer.ts`
- **Ações:**
  1. Adicionar método unificado de feedback de calibração:
     ```typescript
     public static playCalibrationStepChime(
       audioCtx: AudioContext,
       step: 1 | 2 | 3,
       time: number
     ): void {
       if (!audioCtx || audioCtx.state === "closed") return;
       try {
         const osc = audioCtx.createOscillator();
         const gain = audioCtx.createGain();
         osc.type = "sine";

         if (step === 1) {
           // Toque 1: 880 Hz (A5), 30ms
           osc.frequency.setValueAtTime(880, time);
           gain.gain.setValueAtTime(0.2, time);
           gain.gain.exponentialRampToValueAtTime(0.001, time + 0.030);
           osc.connect(gain);
           gain.connect(audioCtx.destination);
           osc.start(time);
           osc.stop(time + 0.030);
         } else if (step === 2) {
           // Toque 2: 1174.66 Hz (D6), 30ms
           osc.frequency.setValueAtTime(1174.66, time);
           gain.gain.setValueAtTime(0.22, time);
           gain.gain.exponentialRampToValueAtTime(0.001, time + 0.030);
           osc.connect(gain);
           gain.connect(audioCtx.destination);
           osc.start(time);
           osc.stop(time + 0.030);
         } else {
           // Toque 3: Confirmation Ting em 1760 Hz (A6), 350ms decay
           this.playConfirmationTing(audioCtx, time);
         }
       } catch (e) {
         console.warn("Could not schedule calibration chime:", e);
       }
     }
     ```
- **Critério de Aceitação:** Síntese percussiva limpa sem alocação de buffers de áudio gravados.

---

### Tarefa B4: Atualização de Schema e Persistência em `src/audio/guitar-calibration.ts`
- **Arquivo:** `src/audio/guitar-calibration.ts`
- **Ações:**
  1. Atualizar a interface `StringCalibrationData` para conter `varianceCents`, `harmonics: StringHarmonic[]`, `samplesCount` e `capturedAt`.
  2. Atualizar o schema `GuitarCalibrationProfile`:
     ```typescript
     export interface GuitarCalibrationProfile {
       version: 2;
       updatedAt: number;
       instrumentType: 'acoustic_steel' | 'classical_nylon' | 'electric' | 'unknown';
       strings: Record<number, StringCalibrationData>;
       chords: Record<string, ChordCalibrationData>;
     }
     ```
  3. Prover migração transparente: caso o usuário possua um perfil versão 1 em `localStorage`, carregar com segurança e atualizar para a versão 2 sem quebrar a execução.
- **Critério de Aceitação:** Testes unitários validam serialização, deserialização e compatibilidade regressiva.

---

### Tarefa B5: Injeção do Perfil no `TunerEngine` e no `ChordRecognizer`
- **Arquivos:**
  - `src/audio/tuner-engine.ts`
  - `src/audio/chord-recognizer.ts`
- **Ações:**
  1. No `TunerEngine`, quando um perfil calibrado estiver ativo, usar os offsets centesimais reais da ponte do instrumento para calibrar o ponto neutro ($0\text{ cents}$) da afinação.
  2. No `ChordRecognizer`, injetar os vetores de cromagrama médios reais capturados na calibração sobre os templates canônicos sintéticos através de `rebuildTemplates()`, elevando a taxa de reconhecimento de acordes acústicos para $\ge 95\%$.
- **Critério de Aceitação:** Testes de integração confirmam que o afinador e o reconhecedor operam com as matrizes personalizadas.

---

### Tarefa B6: Testes Unitários com Vitest para o Ciclo Hands-Free
- **Arquivos:**
  - `tests/audio/transient-detector.test.ts` (Novo)
  - `tests/audio/hands-free-calibration-engine.test.ts` (Novo)
- **Cenários Cobertos:**
  1. Detecção sequencial de 3 toques com auto-avanço para o próximo passo após 1200ms.
  2. Rejeição de toque espúrio com $\text{clarity} = 0.40$ (batida no tampo).
  3. Rejeição de toque inconsistente ($\sigma > 18\text{ cents}$), remoção do outlier e regressão de 3/3 para 2/3.
  4. Disparo do nudge de inatividade após 12 segundos sem som.
  5. Acionamento do botão manual de escape "Refazer corda".
- **Critério de Aceitação do Sprint B:** `npm test` executa todas as suítes e passa 100%.

---

## 5. Sprint C: Componentes Visuais do "Iniciante Zero"

### Objetivo do Sprint C
Construir uma linguagem visual clara, anatômica e acolhedora, desenhada para quem nunca tocou violão: SVG de headstock com sentido de giro das tarraxas ("APERTE" vs "AFROUXE"), braço de violão com dedos coloridos (1=Azul, 2=Verde, 3=Laranja, 4=Roxo), alerta de perigo de estouro da 1ª corda e wizard mãos-livres legível a 2 metros de distância.

---

### Tarefa C1: Criação de `src/components/tuner/guitar-headstock-viewer.tsx`
- **Arquivo:** `src/components/tuner/guitar-headstock-viewer.tsx` (Novo Arquivo)
- **Especificações de Design:**
  1. **SVG do Headstock (Cabeça do Violão):** Representação gráfica anatômica com os 6 pinos/tarraxas:
     - Lado Esquerdo/Superior (cordas graves): Tarraxas das cordas 6, 5 e 4.
     - Lado Direito/Inferior (cordas agudas): Tarraxas das cordas 3, 2 e 1.
  2. **Tarraxa Ativa:** Destacada com anel pulsante na cor da corda e linha esticada até a pestana.
  3. **Setas Animadas de Direção de Giro:**
     - Se `cents < -5.0` (`TIGHTEN`): Seta circular animada indicando sentido de aperto acompanhada do texto `"APERTE A TARRAXA"`.
     - Se `cents > +5.0` (`LOOSEN`): Seta circular animada no sentido oposto com o texto `"AFROUXE A TARRAXA"`.
     - Se `|cents| <= 5.0` (`IN_TUNE`): Halo verde neon com ícone de check e `"CORDA AFINADA!"`.
  4. **Alerta de Perigo de Quebra (Safety Guard Anti-Pânico):**
     - Disparado se a corda ativa for a 1ª corda ($E_4$) e `cents > +45.0` (ou frequência $> 338\text{ Hz}$).
     - Banner pulsante em vermelho escarlate (`#EF4444`) com animação de alerta:
       `"CUIDADO: RISCO DE QUEBRA! AFROUXE A TARRAXA IMEDIATAMENTE"`
  5. **Metáforas Físicas para Iniciantes:** Exibir rótulos claros: "Corda mais grossa (Cima)" para a 6ª e "Corda mais fina (Baixo)" para a 1ª.
- **Props do Componente:**
  ```typescript
  export interface GuitarHeadstockViewerProps {
    activeStringNumber: number | null; // 6 a 1
    cents: number;
    inTune: boolean;
    hasSignal: boolean;
    tuningAction: TunerTuningAction;
    onSelectString?: (stringNumber: number) => void;
  }
  ```
- **Critério de Aceitação:** Renderização SVG limpa, responsiva, sem layout shift, acessível com contraste WCAG AAA.

---

### Tarefa C2: Criação de `src/components/guitar/animated-fretboard-guide.tsx`
- **Arquivo:** `src/components/guitar/animated-fretboard-guide.tsx` (Novo Arquivo)
- **Especificações de Design:**
  1. **Perspectiva do Músico Olhando para Baixo:**
     - Corda 6 (mais grossa) no topo; corda 1 (mais fina) na base.
     - Casas numeradas (1, 2, 3, 4, 5...) com trastes metálicos e marcações de pontos (dots nas casas 3, 5, 7, 9 e duplo na 12).
  2. **Codificação Cromática Universal dos Dedos:**
     - Dedo 1 (Indicador): Azul Real `#3B82F6` (círculo com número "1")
     - Dedo 2 (Médio): Verde Esmeralda `#10B981` (círculo com número "2")
     - Dedo 3 (Anelar): Laranja Vibrante `#F97316` (círculo com número "3")
     - Dedo 4 (Mínimo): Roxo Violeta `#A855F7` (círculo com número "4")
     - Dedo P (Polegar): Apoio de postura indicado atrás do braço.
  3. **Sinalização de Cordas Especiais:**
     - Corda Solta: Círculo verde com `0` à esquerda da pestana.
     - Corda Muda (Abafada/Não Tocar): Símbolo luminoso `✕` em vermelho escarlate.
  4. **Setas de Palhetada / Ritmo:**
     - Seta vertical apontando para baixo ($\downarrow$) para batida descendente.
     - Seta vertical apontando para cima ($\uparrow$) para batida ascendente.
  5. **Dicas Textuais de Postura Anatômica:**
     - Ex: *"Pressione com a pontinha do dedo indicador perto do traste metálico, sem tocar na corda vizinha"*.
- **Props do Componente:**
  ```typescript
  export interface AnimatedFretboardGuideProps {
    chordId?: string;
    chordName?: string;
    fretsCount?: number; // Padrão: 5 casas visíveis
    highlightedStrings?: number[];
    strumDirection?: 'down' | 'up' | 'none';
    showFingerLabels?: boolean;
    className?: string;
  }
  ```
- **Critério de Aceitação:** Renderização nítida em mobile e desktop, exibindo corretamente tríades, tétrades e cordas mudas.

---

### Tarefa C3: Criação de `src/components/calibration/hands-free-calibration-wizard.tsx`
- **Arquivo:** `src/components/calibration/hands-free-calibration-wizard.tsx` (Novo Arquivo)
- **Especificações de Design:**
  1. **Design de Visibilidade a 2 Metros:** Tipografia com títulos de 28 a 36px font-black, contrastes elevados para visualização do celular apoiado na mesa ou cama.
  2. **Contador de Toques Multissensorial:**
     - [ Toque 1/3 ] [ Toque 2/3 ] [ Toque 3/3 ]
     - Animação de pulso e preenchimento gradual a cada impacto de corda.
  3. **Badge de Auto-Avanço:** Barra de contagem regressiva circular de 1200ms com texto *"Perfeito! Indo para a próxima corda em 3... 2... 1..."*.
  4. **Rotas de Escape Manual Táteis:** Botões acessíveis na base:
     - `"Refazer esta corda"` (reseta os toques da corda corrente mantendo as anteriores)
     - `"Pular corda"`
     - `"Encerrar calibração"`
  5. **Balão Pedagógico de Inatividade (Nudge Nudge):** Disparado se o aluno ficar 12s sem tocar:
     *"Não estamos ouvindo seu violão... Toque a corda mais grossa com firmeza perto do microfone!"*.
- **Critério de Aceitação:** Integração perfeita com `HandsFreeCalibrationEngine`, proporcionando uma jornada fluida de 6 cordas e acordes sem cliques.

---

### Tarefa C4: Integração dos Componentes na Página do Afinador (`src/app/tuner/page.tsx`)
- **Arquivo:** `src/app/tuner/page.tsx`
- **Ações:**
  1. Importar e renderizar `<GuitarHeadstockViewer />` acima ou ao lado do dial de afinação.
  2. Atualizar o `<TunerGauge />` para exibir o texto de orientação explícito:
     - `"Corda frouxa — APERTE a tarraxa"`
     - `"AFINADO!"`
     - `"Corda esticada — AFROUXE a tarraxa"`
     - `"CUIDADO: RISCO DE QUEBRA! AFROUXE IMEDIATAMENTE"`
  3. Quando o usuário clica em uma tarraxa no headstock, selecionar a corda correspondente no modo assistido e ajustar o filtro passa-baixas adaptativo no `AudioEngine`.
- **Critério de Aceitação:** A página do afinador torna-se autoexplicativa até para quem nunca segurou um instrumento.

---

### Tarefa C5: Atualização da Central de Calibração (`src/app/calibrate/page.tsx`)
- **Arquivo:** `src/app/calibrate/page.tsx`
- **Ações:**
  1. Substituir a invocação do wizard antigo pelo `<HandsFreeCalibrationWizard />`.
  2. Garantir que o `AudioContext` seja iniciado no clique de abertura ("Iniciar Calibração Mãos Livres") para cumprir a política de autoplay do iOS Safari e Chrome.
- **Critério de Aceitação:** O fluxo de calibração executa de ponta a ponta sem erros.

---

### Tarefa C6: Integração do `<AnimatedFretboardGuide />` em `/practice/[songId]`
- **Arquivo:** `src/app/practice/[songId]/page.tsx`
- **Ações:**
  1. Renderizar o `<AnimatedFretboardGuide />` no painel lateral do jogo e no modal de pausa / *Wait Mode*.
  2. No momento em que uma nota ou acorde estiver aguardando o aluno no *Wait Mode*, destacar os dedos coloridos e a seta de palhetada recomendada.
- **Critério de Aceitação:** O aluno visualiza instantaneamente onde posicionar os dedos sem precisar decifrar diagramas pretos e brancos abstratos.

---

### Tarefa C7: Testes Unitários de Componentes Visuais
- **Arquivos:**
  - `tests/components/guitar-headstock-viewer.test.tsx` (Novo)
  - `tests/components/animated-fretboard-guide.test.tsx` (Novo)
  - `tests/components/hands-free-calibration-wizard.test.tsx` (Novo)
- **Cenários Cobertos:**
  1. Headstock exibe ação `TIGHTEN` quando `cents = -25` e `LOOSEN` quando `cents = +20`.
  2. Headstock exibe alerta `DANGER_BREAK` quando corda 1 ($E_4$) e `cents = +48`.
  3. Fretboard renderiza os 4 dedos com as classes e cores corretas (1=Azul, 2=Verde, 3=Laranja, 4=Roxo).
  4. Wizard reage a eventos da FSM e exibe botões táteis de escape.
- **Critério de Aceitação do Sprint C:** Todos os testes de componentes passam no Vitest com `@testing-library/react`.

---

## 6. Sprint D: Auditoria de QA, Simulação de Sinais e Deploy

### Objetivo do Sprint D
Validar através de simulação acústica estrita a anulação completa do "efeito pipoca", verificar a compilação de produção do Next.js sem avisos e homologar o deploy ativo na Vercel e GitHub.

---

### Tarefa D1: Suíte de Auditoria Sintética Anti-Pipoca (`tests/audio/dsp-stabilization-audit.test.ts`)
- **Arquivo:** `tests/audio/dsp-stabilization-audit.test.ts` (Novo Arquivo)
- **Cenários Críticos de Simulação Acústica:**
  1. **Simulação do 6º Bordão ($E_2$ a 82.41 Hz):**
     - Geração de sinal composto: fundamental de $82.41\text{ Hz}$ somada ao 2º harmônico ($164.82\text{ Hz}$) com $+14\text{ dB}$ e 3º harmônico ($247.23\text{ Hz}$) com $+8\text{ dB}$.
     - Passagem pelo `AudioEngine` (filtro biquad adaptativo $f_c = 115\text{ Hz}$) e `TunerEngine`.
     - **Critério:** Taxa de identificação correta de $E_2$ igual a **100% em 50 frames contínuos** (zero saltos para $E_3$ ou $B_3$).
  2. **Simulação da 1ª Corda ($E_4$ a 329.63 Hz) com Impacto Inicial Agudo:**
     - Injeção de transiente de palhetada com harmônicos superiores dominantes ($E_5$, $B_5$) nos primeiros 40ms.
     - **Critério:** Zero saltos para $E_5$; estabilização cravada em $E_4$.
  3. **Simulação de Batida no Tampo (Body Knock):**
     - Sinal percussivo de banda larga com clareza YIN de $0.35$.
     - **Critério:** Descartado imediatamente pelo `TransientDetector` sem disparar falso onset.
  4. **Simulação do Fluxo Hands-Free de 3 Toques:**
     - 3 toques coerentes seguidos de intervalo de 1200ms: transição de estado confirmada.
- **Critério de Aceitação:** 100% de aprovação na suíte de auditoria sintética.

---

### Tarefa D2: Execução Completa da Cobertura de Testes Vitest
- **Ação:**
  Executar no terminal:
  ```bash
  npm test
  ```
- **Critério de Aceitação:** Todos os testes unitários (os 74 anteriores + todas as novas suítes criadas) executam e passam sem nenhuma quebra.

---

### Tarefa D3: Auditoria Estrita de Tipos e Build de Produção
- **Ações:**
  1. Executar verificação de tipos e linter:
     ```bash
     npm run lint
     ```
  2. Executar o build de produção do Next.js:
     ```bash
     npm run build
     ```
- **Critério de Aceitação:** Build concluído com sucesso gerando todas as rotas estáticas e dinâmicas (`/`, `/tuner`, `/calibrate`, `/practice`, `/practice/[songId]`) sem warnings ou erros de compilação.

---

### Tarefa D4: Deploy e Validação em Produção (GitHub + Vercel)
- **Ações:**
  1. Gerar commit cirúrgico no repositório local seguindo convenções semânticas:
     `git commit -m "feat(dsp-ux): refatoracao de estabilizacao de pitch, calibracao hands-free e guia visual para iniciantes"`
  2. Enviar alterações para a branch principal do GitHub:
     `git push origin main`
  3. Validar a esteira de build na Vercel e verificar o funcionamento da URL pública em ambiente real mobile e desktop.
- **Critério de Aceitação:** Deploy ativo na Vercel com status *Ready*, sem erros no console do navegador e com o novo afinador/calibração operando perfeitamente.

---

## 7. Matriz de Rastreabilidade de Riscos e Mitigações

| ID do Risco | Descrição do Risco | Sprint / Módulo | Mitigação Técnica Implementada no Plano |
| :---: | :--- | :---: | :--- |
| **RSK-01** | Erro de oitava na 6ª corda ($E_2$) devido a harmônico de 164.8 Hz. | Sprint A / `AudioEngine` | Filtro biquad Butterworth passa-baixas adaptativo com corte estrito em $f_c = 115\text{ Hz}$ e $Q = 0.707$, atenuando o 2º harmônico em $-7.2\text{ dB}$. |
| **RSK-02** | Trepidação visual e jitter na agulha perto da afinação. | Sprint A / `PitchStabilizer` | Filtro de mediana de 5 amostras, deadband de $0.25\text{ cents}$ e EMA sigmoidal com $\alpha = 0.12$ na vizinhança do tom alvo. |
| **RSK-03** | Oscilação rápida entre notas vizinhas (ex: D# e E). | Sprint A / `PitchStabilizer` | Schmitt Trigger centesimal com zona morta de $\pm 65\text{ cents}$ e confirmação obrigatória de 4 frames estáveis ($\text{clarity} \ge 0.75$). |
| **RSK-04** | Latidos, tosse ou batida no violão disparando toques espúrios. | Sprint B / `TransientDetector` | Tripla barreira: Limiar de clareza YIN ($\ge 0.70$), filtro de centroide espectral ($\le 3.5\text{ kHz}$) e filtro de dispersão de 3 toques ($\sigma \le 18\text{ cents}$). |
| **RSK-05** | Ruptura da 1ª corda ($E_4$) por rotação da tarraxa no sentido incorreto. | Sprint C / `GuitarHeadstockViewer` | Alerta visual pulsante de emergência (`DANGER_BREAK`) quando $E_4 > +45\text{ cents}$, com setas explícitas "AFROUXE A TARRAXA". |
| **RSK-06** | Aluno perdido ou travado no fluxo hands-free em silêncio. | Sprint B & C / `HandsFreeFSM` | Temporizador de inatividade de 12 segundos com nudge visual amigável e botões táteis permanentes de escape ("Refazer corda" / "Pular"). |
| **RSK-07** | Bloqueio de áudio no iOS Safari por política de autoplay. | Sprint B / `CalibratePage` | O `AudioContext.resume()` é executado estritamente dentro de manipuladores síncronos de clique (`pointerdown`), lendo a taxa de amostragem nativa de hardware. |
| **RSK-08** | Degradação de performance e queda de FPS em smartphones móveis. | Sprints A, B, C / Arquitetura | Disciplina rigorosa de Zero-GC (zero alocações dinâmicas no loop de áudio e animação), orçamento de processamento DSP $< 2.8\text{ ms}$ por frame. |

---

## 8. Guia Passo a Passo de Execução para o @developer

O **@developer** deve seguir a ordem estrita de execução das fases e tarefas abaixo:

```
Passo 1: Sprint A (Core DSP & Estabilização de Pitch)
  ├── 1.1 Atualizar src/audio/types.ts com novos enums e interfaces
  ├── 1.2 Atualizar src/audio/audio-engine.ts com BiquadFilterNode adaptativo
  ├── 1.3 Criar src/audio/pitch-stabilizer.ts (Mediana, Schmitt, Sigmoidal EMA)
  ├── 1.4 Refatorar src/audio/tuner-engine.ts com Attack Blanking de 60ms
  └── 1.5 Criar tests/audio/pitch-stabilizer.test.ts e rodar npm test

Passo 2: Sprint B (Motor Hands-Free Zero Cliques)
  ├── 2.1 Criar src/audio/transient-detector.ts (ODF, RMS + Spectral Flux)
  ├── 2.2 Criar src/audio/hands-free-calibration-engine.ts (FSM 3 toques e auto-avanço)
  ├── 2.3 Atualizar src/audio/audio-synthesizer.ts com chimes 880Hz, 1174Hz e 1760Hz
  ├── 2.4 Atualizar src/audio/guitar-calibration.ts para schema v2 com migração
  ├── 2.5 Injetar perfil no TunerEngine e ChordRecognizer
  └── 2.6 Criar testes unitários em tests/audio/ e rodar npm test

Passo 3: Sprint C (Componentes Visuais do "Iniciante Zero")
  ├── 3.1 Criar src/components/tuner/guitar-headstock-viewer.tsx (SVG tarraxas + perigo E4)
  ├── 3.2 Criar src/components/guitar/animated-fretboard-guide.tsx (Braço e dedos 1,2,3,4)
  ├── 3.3 Criar src/components/calibration/hands-free-calibration-wizard.tsx
  ├── 3.4 Integrar headstock e mensagens em src/app/tuner/page.tsx
  ├── 3.5 Integrar hands-free wizard em src/app/calibrate/page.tsx
  ├── 3.6 Integrar fretboard guide em src/app/practice/[songId]/page.tsx
  └── 3.7 Criar testes de componentes e rodar npm test

Passo 4: Sprint D (Auditoria de QA, Simulação de Sinais e Deploy)
  ├── 4.1 Criar tests/audio/dsp-stabilization-audit.test.ts (Simulação E2, E4, pipoca)
  ├── 4.2 Rodar npm test com 100% de aprovação em todas as suítes
  ├── 4.3 Rodar npm run lint e npm run build para validar compilação
  ├── 4.4 Realizar commit e git push para o repositório
  └── 4.5 Homologar o deploy ativo na Vercel
```

---

## 9. Veredito de Prontidão do @planner

O presente plano cirúrgico atende 100% às diretrizes vinculantes do Parecer de Homologação (`docs/specs/brainstorming-refactor-consensus.md`) e está estruturado de forma granular e atômica.

**Status:** **HOMOLOGADO E LIBERADO PARA INÍCIO IMEDIATO DO SPRINT A PELO @developer.**
