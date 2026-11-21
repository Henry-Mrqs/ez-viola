# EzViola — Especificação de UX, Gamificação e Catálogo de Músicas (Fase 1)

**Documento:** UX, Gamificação e Catálogo Inicial de Músicas & Exercícios  
**Versão:** 1.0.0  
**Status:** Aprovado para Desenvolvimento  
**Autor:** @researcher (Product & UX Researcher)  
**Projeto:** EzViola (Web App Interativo de Aprendizado de Violão com Detecção de Áudio em Tempo Real)  

---

## 1. Resumo Executivo e Visão de Produto

O **EzViola** é uma plataforma web progressiva (PWA) projetada para democratizar o aprendizado do violão acústico e clássico por meio de gamificação em tempo real inspirada no Yousician e Guitar Hero, operando diretamente no navegador sem necessidade de plugins ou cabos especiais. Utilizando a Web Audio API e algoritmos de processamento de sinal digital (DSP) para detecção de tom e reconhecimento polifônico de acordes via microfone embutido, o EzViola remove a barreira inicial de aprendizado ("a curva de dor dos dedos e da teoria").

Este documento consolida as diretrizes fundamentais de Experiência do Usuário (UX), mecânicas de gamificação, calibração de ambiente, esquema de dados padronizado (`SongSchema`) e o catálogo pedagógico inaugural de 5 módulos práticos estruturados para iniciantes.

---

## 2. Mecânicas de Gamificação e Interação Estilo Yousician

### 2.1 Esteira / Timeline Horizontal (Conveyor Belt)

A interface central de treino consiste em uma esteira horizontal contínua onde blocos visuais representando notas individuais ou acordes completos se deslocam da direita para a esquerda em direção a um marcador fixo denominado **Hit Zone** (Linha de Execução).

```
                      HIT ZONE (Linha de Execução)
                            │
  [Cordas/Braço]            │      [Timeline / Esteira com Rolagem Suave]
  ──────────────────────────┼──────────────────────────────────────────────────────────
  (1) E4 ───────────────┬───│─────────○ [Nota E4]──────────────────────────────────────
  (2) B3 ───────────────┼───│──────────────────────○ [Nota B3]─────────────────────────
  (3) G3 ───────────────┼───│──────────────────────────────────────────────────────────
  (4) D3 ───────────────┴───│───────────────────────────────────┌────────────┐─────────
  (5) A2 ───────────────────│───────────────────────────────────│  Acorde Em │─────────
  (6) E2 ───────────────────│───────────────────────────────────└────────────┘─────────
                            │                                   ◄─── Direção do Fluxo
                            │
                    [Cursor de Leitura]
```

#### Especificações Técnicas de Renderização e Física:
1. **Motor de Renderização:** Canvas 2D acelerado por hardware ou WebGL (ex: PixiJS / Three.js 2D orthographic). A taxa de quadros alvo é estritamente 60 FPS / 120 FPS, sincronizada via `requestAnimationFrame`.
2. **Relógio Mestre de Áudio (Audio Clock Anchor):** A renderização nunca deve depender exclusivamente de `performance.now()` ou `Date.now()`. O sincronismo utiliza `AudioContext.currentTime` como fonte primária de verdade temporal para evitar desvios (*audio-visual drift*) entre o metrônomo/playback e o deslocamento gráfico.
3. **Fórmula de Velocidade da Esteira:**
   $$\text{pixelsPerSecond} = \frac{\text{BPM}}{60} \times \text{pixelsPerBeat}$$
   - Padrão recomendado: $\text{pixelsPerBeat} = 120\text{px}$ a 100 BPM ($\approx 200\text{px/s}$).
   - **Lookahead Time (Visão Antecipada):** A tela deve projetar entre $2.5$ a $3.5$ segundos de música adiante da Hit Zone, permitindo que o córtex motor do usuário antecipe a troca de pestana ou o posicionamento dos dedos.
4. **Anatomia dos Elementos na Esteira:**
   - **Blocos de Acorde:** Faixas verticais ou retângulos arredondados cobrindo a extensão das cordas ativas. A largura do bloco reflete a duração do acorde (ex: compasso 4/4 completo = 4 beats de largura gráfica). Exibe a cifra grande (ex: **Em**), o nome dos dedos recomendados e miniatura do diagrama de braço ao se aproximar.
   - **Tokens de Notas Individuais:** Marcadores circulares ou elípticos centralizados exatamente sobre a linha correspondente à corda (1ª a 6ª corda). O número dentro do círculo indica o traste a ser pressionado ($0$ = corda solta).
   - **Codificação de Cores por Corda / Dedo:**
     - Corda 1 (E4): Roxo (`#8B5CF6`)
     - Corda 2 (B3): Azul Celeste (`#0EA5E9`)
     - Corda 3 (G3): Verde Esmeralda (`#10B981`)
     - Corda 4 (D3): Âmbar Dourado (`#F59E0B`)
     - Corda 5 (A2): Laranja Vibrante (`#F97316`)
     - Corda 6 (E2): Carmesim (`#EF4444`)

---

### 2.2 Feedback Visual Instantâneo e Sistema de Pontuação

Para gerar o *loop de dopamina* característico de jogos de ritmo, a Hit Zone reage instantaneamente aos eventos detectados pelo motor de áudio.

```
                  ┌──────────────────────────────────────────────┐
                  │             HIT DETECTION ENGINE             │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     [Janela Temporal (Timing)]                      [Validação Harmônica]
  Janela: ±120ms da Hit Zone                      Frequência F0 ou Cromagrama
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                      ┌──────────────────────────────────────┐
                      │          RESULTADO DA AVALIAÇÃO      │
                      └──────────────────┬───────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
  [PERFECT HIT]                     [GOOD HIT]                      [MISS / WRONG]
  Δt ≤ ±50ms                        ±50ms < Δt ≤ ±120ms             Δt > ±120ms ou
  Pitch/Acorde Exato                Pitch/Acorde Exato              Tom Incorreto
  Cor: Verde Neon (#22C55E)         Cor: Âmbar Ouro (#F59E0B)       Cor: Vermelho Rubi (#EF4444)
  Partículas + Pulso                Pulso Suave                     Shake Horizontal
  Score: +100 x Combo               Score: +50 x Combo              Combo Zerado
```

#### Tabela de Janelas de Tolerância e Resposta Visual:

| Classificação | Tolerância Temporal ($\Delta t$) | Precisão do Tom / Acorde | Efeito Visual | Efeito Sonoro | Pontuação Base | Impacto no Combo |
|---|---|---|---|---|---|---|
| **Perfect** | $\le \pm 50\text{ ms}$ | Frequência fundamental $\pm 25\text{ cents}$ ou Acorde $\ge 85\%$ correlação | Explosão de partículas verdes (`#22C55E`), escala $1.15\times$ do token, texto "+100" flutuante | Ting de confirmação cristalino (opcional) | 100 pts | Multiplicador incrementa (+1) |
| **Good** | $\pm 51\text{ ms}$ a $\pm 120\text{ ms}$ | Frequência fundamental $\pm 45\text{ cents}$ ou Acorde $\ge 70\%$ correlação | Brilho amarelo/âmbar (`#F59E0B`), leve ondulação na barra, texto "+50" | Sem som obstrutivo | 50 pts | Mantém combo atual |
| **Miss / Wrong** | Fora da janela ($> \pm 120\text{ ms}$) ou nota/acorde errado | Nota errada detectada ou ausência de sinal | Flash vermelho (`#EF4444`) na Hit Zone com animação de tremor (*shake* de $6\text{px}$ por $200\text{ms}$), texto "X" | Som sutil de corda abafada (*thud*) | 0 pts | Reseta combo para 1x |

#### Indicador de Combo e Multiplicadores:
- **Nível 1:** 0 a 9 acertos consecutivos $\rightarrow 1\times$
- **Nível 2:** 10 a 19 acertos consecutivos $\rightarrow 1.5\times$
- **Nível 3:** 20 a 39 acertos consecutivos $\rightarrow 2\times$
- **Nível 4 (Fever Mode):** 40+ acertos consecutivos $\rightarrow 3\times$ (a Hit Zone adquire aura cintilante de fogo azul/dourado).

#### Cálculo de Precisão Final (%):
$$\text{Accuracy (\%)} = \left( \frac{N_{\text{perfect}} \times 1.0 + N_{\text{good}} \times 0.6}{N_{\text{total\_events}}} \right) \times 100$$
- **Classificação por Estrelas:**
  - 3 Estrelas Douradas: $\ge 95\%$ de precisão e sem interrupções críticas.
  - 2 Estrelas: $80\% \le \text{precisão} < 95\%$.
  - 1 Estrela: $60\% \le \text{precisão} < 80\%$.
  - Repetir Exercício: $< 60\%$ (mensagem acolhedora encorajando treino no Modo Lento).

---

### 2.3 Modo de Treino Lento (Slow Practice Mode)

O domínio motor do violão exige treino lento deliberado para fixar a memória muscular dos tendões e troca de acordes sem vícios posturais.

#### Especificações de Funcionalidade:
1. **Seletores de Velocidade Dinâmicos:**
   - Botões pré-definidos de acesso rápido: **50% (Meia Velocidade)**, **75% (Modo Estudo)** e **100% (Velocidade Real)**.
   - Slider contínuo de passo fino de 40% a 120% para ajustes sob medida.
2. **Arquitetura de Áudio Sem Artefatos de Tom:**
   - **Backing Tracks em Áudio Gravado:** Usa algoritmos de *time-stretching* em tempo real com preservação de formantes e afinação (Pitch Preservation) através de bibliotecas como SoundTouchJS ou Phase Vocoder via Web Audio Worklet.
   - **Acompanhamento MIDI / SoundFont:** Para exercícios mecânicos e tablaturas sintéticas, as trilhas utilizam SoundFonts (.sf2 convertidos para Web Audio). Alterar o BPM altera meramente o intervalo entre notas geradas, garantindo fidelidade acústica $100\%$ pura sem nenhuma distorção de fase.
3. **Metrônomo Integrado:**
   - Click sonoro claro nos tempos fortes (downbeat: 1000 Hz, tempos fracos: 800 Hz) gerado por osciladores nativos do Web Audio (`OscillatorNode`).
   - Feedback visual: pisca-pisca discreto na Hit Zone sincronizado a cada batida do compasso.

---

### 2.4 "Wait Mode" (Modo Espera / Yousician Practice)

O **Wait Mode** é a ferramenta pedagógica mais eficiente para eliminar a ansiedade do iniciante. Em vez de a música passar direto enquanto o aluno luta para posicionar os dedos, o software assume o papel de um professor paciente sentado ao lado.

#### Mecânica Operacional Passo a Passo:
1. **Gatilho de Pausa:** Quando um evento (acorde ou nota) atinge a Hit Zone ($t = t_{\text{alvo}}$) e não é detectado imediatamente dentro da janela inicial de $100\text{ ms}$, a esteira desacelera suavemente em $150\text{ ms}$ até repousar na linha de execução.
2. **Estado de Congelamento:**
   - A timeline e o playback do áudio de fundo pausam.
   - O elemento na Hit Zone começa a pulsar levemente em tom azul/âmbar neutro.
   - Uma janela modal flutuante não-obstrutiva ou HUD no canto exibe o diagrama do acorde expandido, destacando com precisão os trastes, os dedos (1=Indicador, 2=Médio, 3=Anelar, 4=Mínimo) e quais cordas devem soar abertas (O) ou ser abafadas (X).
3. **Escuta Ativa Contínua no Microfone:**
   - O motor de áudio (AudioWorklet) mantém a captura do microfone operando a 44.1 kHz / 48 kHz.
   - O aluno dedilha ou toca o acorde no violão real.
   - Se o aluno tocar cordas desafinadas ou errar a digitação, o sistema exibe indicadores visuais sutis: ex: "Corda 2 desafinada ou abafada!".
4. **Desbloqueio e Retomada:**
   - No momento exato em que o acorde correto for reconhecido com confiança acústica $> 0.75$, a Hit Zone acende imediatamente em **Verde**, toca o acorde sintetizado de confirmação, aguarda $300\text{ ms}$ (buffer de estabilização) e retoma a rolagem suave da esteira em direção ao próximo evento.

---

### 2.5 Calibração de Ruído (Noise Gate) Amigável

Microfones de notebooks, smartphones e fones de ouvido capturam ruído ambiente constante (ventiladores, ar-condicionado, ecos de sala e digitação), o que pode causar falsos positivos ou mascarar harmônicos fracos das cordas do violão.

```
       [Microfone] ──► [Filtro Passa-Altas 70Hz] ──► [RMS Detector]
                                                          │
   ┌──────────────────────────────────────────────────────┴─────────────┐
   ▼                                                                    ▼
Sinal < Threshold_Close (-36dB)                          Sinal > Threshold_Open (-30dB)
   │                                                                    │
   ▼                                                                    ▼
[GATE FECHADO: Áudio Mudo]                              [GATE ABERTO: Envia ao Pitch Engine]
```

#### Arquitetura de Áudio (Histerese & Schmitt Trigger):
Para evitar o fenômeno de "chattering" (quando o gate abre e fecha violentamente dezenas de vezes por segundo em sinais limiares), implementa-se um **Schmitt Trigger com histerese de 6 dB**:
- **Abertura do Gate (`Threshold_Open`):** $-30\text{ dBFS}$ (ajustável).
- **Fechamento do Gate (`Threshold_Close`):** $-36\text{ dBFS}$ (6 dB abaixo da abertura).
- **Attack:** $5\text{ ms}$ (abertura ultra rápida para não cortar o ataque inicial da palhetada).
- **Release:** $120\text{ ms}$ (fechamento suave para permitir que o sustain natural do violão se extinga organicamente).

#### Fluxo do Usuário (Wizard em 3 Passos):
1. **Passo 1: Medição do Silêncio da Sala (3 segundos)**
   - Instrução na tela: *"Fique em silêncio por 3 segundos para calibrarmos o ambiente..."*
   - Uma barra de progresso circular se preenche enquanto o sistema calcula a média quadrática (RMS) e o ruído de fundo da sala ($N_{\text{floor}}$, ex: $-45\text{ dBFS}$).
2. **Passo 2: Toque Forte de Teste (Detecção de Pico)**
   - Instrução na tela: *"Agora toque um acorde qualquer com firmeza no seu violão!"*
   - O sistema detecta o ataque transitório e o pico de amplitude ($S_{\text{peak}}$, ex: $-12\text{ dBFS}$).
3. **Passo 3: Ajuste Automático e Feedback em Tempo Real**
   - O algoritmo calcula automaticamente:
     $$\text{Threshold}_{\text{Open}} = N_{\text{floor}} + 0.35 \times (S_{\text{peak}} - N_{\text{floor}})$$
   - Apresenta um VU meter horizontal moderno e amigável:
     - Zona cinza: *"Ruído ambiente bloqueado"*.
     - Zona verde cintilante: *"Sinal do violão detectado perfeitamente"*.
     - Um marcador interativo permite ao usuário arrastar o limiar manualmente caso deseje sensibilidade maior ou menor.

---

## 3. Especificação do Esquema JSON (`SongSchema`)

Para assegurar interoperabilidade total entre o banco de dados, o frontend de renderização e o analisador de áudio, as faixas e lições obedecem à especificação formal detalhada a seguir.

### 3.1 Definição Formal JSON Schema (Draft-07)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "EzViolaSongSchema",
  "description": "Esquema padronizado para exercícios, lições e músicas interativas no EzViola",
  "type": "object",
  "required": [
    "id",
    "title",
    "artist",
    "bpm",
    "difficulty",
    "durationSec",
    "timeSignature",
    "tuning",
    "chordsUsed",
    "timeline"
  ],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Identificador único em formato kebab-case"
    },
    "title": {
      "type": "string",
      "description": "Título oficial da música ou nome do exercício pedagógico"
    },
    "artist": {
      "type": "string",
      "description": "Nome do artista, compositor ou autoria pedagógica"
    },
    "album": {
      "type": "string"
    },
    "genre": {
      "type": "string",
      "enum": ["Exercise", "Folk", "Rock", "Pop", "MPB", "Classical", "Blues"]
    },
    "difficulty": {
      "type": "string",
      "enum": ["beginner", "elementary", "intermediate", "advanced"],
      "description": "Nível de proficiência recomendado"
    },
    "difficultyRating": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5,
      "description": "Escala numérica de 1 a 5 estrelas de dificuldade"
    },
    "bpm": {
      "type": "number",
      "minimum": 30,
      "maximum": 280,
      "description": "Andamento padrão em batidas por minuto"
    },
    "timeSignature": {
      "type": "object",
      "required": ["numerator", "denominator"],
      "properties": {
        "numerator": { "type": "integer", "minimum": 1 },
        "denominator": { "type": "integer", "enum": [2, 4, 8, 16] }
      }
    },
    "durationSec": {
      "type": "number",
      "minimum": 1
    },
    "capo": {
      "type": "integer",
      "minimum": 0,
      "maximum": 12,
      "default": 0,
      "description": "Casa onde o capotraste é posicionado (0 = sem capotraste)"
    },
    "tuning": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 6,
      "maxItems": 6,
      "description": "Afinação padrão da 6ª corda à 1ª corda: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']"
    },
    "chordsUsed": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["chordId", "displayName", "frets", "fingers", "baseFret"],
        "properties": {
          "chordId": { "type": "string" },
          "displayName": { "type": "string" },
          "baseFret": {
            "type": "integer",
            "minimum": 1,
            "maximum": 20,
            "description": "Casa inicial representada no diagrama (1 para acordes abertos)"
          },
          "frets": {
            "type": "array",
            "items": { "type": "integer", "minimum": -1, "maximum": 24 },
            "minItems": 6,
            "maxItems": 6,
            "description": "Trastes tocados da corda 6 para a corda 1 (-1 = mudo/x, 0 = solta)"
          },
          "fingers": {
            "type": "array",
            "items": { "type": "integer", "minimum": 0, "maximum": 4 },
            "minItems": 6,
            "maxItems": 6,
            "description": "Dedo recomendado da corda 6 para 1 (0=nenhum, 1=indicador, 2=médio, 3=anelar, 4=mínimo)"
          },
          "barres": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["fret", "fromString", "toString", "finger"],
              "properties": {
                "fret": { "type": "integer", "minimum": 1 },
                "fromString": { "type": "integer", "minimum": 1, "maximum": 6 },
                "toString": { "type": "integer", "minimum": 1, "maximum": 6 },
                "finger": { "type": "integer", "minimum": 1, "maximum": 4 }
              }
            }
          },
          "notes": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Notas resultantes de cada corda ativada"
          }
        }
      }
    },
    "timeline": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "timeSec", "beat", "durationBeats", "durationSec", "type"],
        "properties": {
          "id": { "type": "string" },
          "timeSec": { "type": "number", "minimum": 0 },
          "beat": { "type": "number", "minimum": 0 },
          "measure": { "type": "integer", "minimum": 1 },
          "durationBeats": { "type": "number", "minimum": 0.1 },
          "durationSec": { "type": "number", "minimum": 0.05 },
          "type": {
            "type": "string",
            "enum": ["chord", "single-note", "rest", "arpeggio"]
          },
          "chordId": {
            "type": "string",
            "description": "Referência à chave presente em chordsUsed"
          },
          "strumDirection": {
            "type": "string",
            "enum": ["down", "up", "none"]
          },
          "notes": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["string", "fret", "pitch"],
              "properties": {
                "string": { "type": "integer", "minimum": 1, "maximum": 6 },
                "fret": { "type": "integer", "minimum": 0, "maximum": 24 },
                "pitch": { "type": "string" },
                "finger": { "type": "integer", "minimum": 0, "maximum": 4 },
                "hand": { "type": "string", "enum": ["P", "I", "M", "A"] }
              }
            }
          },
          "lyrics": { "type": "string" }
        }
      }
    }
  }
}
```

### 3.2 Tipagens Estritas em TypeScript

```typescript
export type GuitarTuning = [string, string, string, string, string, string]; // [E2, A2, D3, G3, B3, E4]

export type FingerNumber = 0 | 1 | 2 | 3 | 4; // 0: Solta/Nenhum, 1: Indicador, 2: Médio, 3: Anelar, 4: Mínimo
export type PluckingFinger = 'P' | 'I' | 'M' | 'A'; // Polegar, Indicador, Médio, Anelar

export interface BarreDefinition {
  fret: number;
  fromString: number; // 1 a 6 (6 = E grave, 1 = E aguda)
  toString: number;
  finger: FingerNumber;
}

export interface ChordDefinition {
  chordId: string;
  displayName: string;
  baseFret: number;
  frets: [number, number, number, number, number, number]; // -1 = mudo, 0 = solta, >0 = traste
  fingers: [FingerNumber, FingerNumber, FingerNumber, FingerNumber, FingerNumber, FingerNumber];
  barres?: BarreDefinition[];
  notes?: string[];
}

export interface SingleNoteEvent {
  string: number; // 1 a 6
  fret: number;
  pitch: string; // Ex: "E2", "G3"
  finger?: FingerNumber;
  hand?: PluckingFinger;
}

export type TimelineEventType = 'chord' | 'single-note' | 'rest' | 'arpeggio';
export type StrumDirection = 'down' | 'up' | 'none';

export interface TimelineEvent {
  id: string;
  timeSec: number;
  beat: number;
  measure: number;
  durationBeats: number;
  durationSec: number;
  type: TimelineEventType;
  chordId?: string;
  strumDirection?: StrumDirection;
  notes?: SingleNoteEvent[];
  lyrics?: string;
}

export interface SongSchema {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre: 'Exercise' | 'Folk' | 'Rock' | 'Pop' | 'MPB' | 'Classical' | 'Blues';
  difficulty: 'beginner' | 'elementary' | 'intermediate' | 'advanced';
  difficultyRating: number; // 1 a 5
  bpm: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  durationSec: number;
  capo: number;
  tuning: GuitarTuning;
  chordsUsed: Record<string, ChordDefinition>;
  timeline: TimelineEvent[];
}
```

---

## 4. Dicionário e Diagramas de Acordes do Catálogo

A tabela a seguir padroniza todos os acordes fundamentais presentes nas músicas e lições iniciais, mapeando as 6 cordas da mais grave (Corda 6 / Mi grave) para a mais aguda (Corda 1 / Mi agudo).

### 4.1 Mapeamento Estruturado dos Acordes

| Acorde | Cifra | Cordas (`[6, 5, 4, 3, 2, 1]`) | Dedos (`[6, 5, 4, 3, 2, 1]`) | Pestana | Notas Emitidas |
|---|---|---|---|---|---|
| **Mi menor** | `Em` | `[0, 2, 2, 0, 0, 0]` | `[0, 2, 3, 0, 0, 0]` | Nenhuma | E2, B2, E3, G3, B3, E4 |
| **Sol maior (3 Dedos)** | `G` | `[3, 2, 0, 0, 0, 3]` | `[2, 1, 0, 0, 0, 3]` | Nenhuma | G2, B2, D3, G3, B3, G4 |
| **Sol maior Folk (4 Dedos)** | `G5` / `G` | `[3, 2, 0, 0, 3, 3]` | `[2, 1, 0, 0, 3, 4]` | Nenhuma | G2, B2, D3, G3, D4, G4 |
| **Ré maior** | `D` | `[-1, -1, 0, 2, 3, 2]` | `[0, 0, 0, 1, 3, 2]` | Nenhuma | D3, A3, D4, F#4 |
| **Dó maior** | `C` | `[-1, 3, 2, 0, 1, 0]` | `[0, 3, 2, 0, 1, 0]` | Nenhuma | C3, E3, G3, C4, E4 |
| **Ré com 6ª e 9ª / Fá#** | `D6add9/F#` | `[2, 0, 0, 2, 0, 0]` | `[2, 0, 0, 3, 0, 0]` | Nenhuma | F#2, A2, D3, A3, B3, E4 |
| **Lá menor com 7ª** | `Am7` | `[-1, 0, 2, 0, 1, 0]` | `[0, 0, 2, 0, 1, 0]` | Nenhuma | A2, E3, G3, C4, E4 |
| **Si menor (Pestana)** | `Bm` | `[-1, 2, 4, 4, 3, 2]` | `[0, 1, 3, 4, 2, 1]` | Casa 2 (C1 a C5) | B2, F#3, B3, D4, F#4 |
| **Si menor com 7ª (Sem Pestana)** | `Bm7_easy` | `[-1, 2, 0, 2, 0, 2]` | `[0, 1, 0, 2, 0, 3]` | Nenhuma | B2, D3, A3, B3, F#4 |

---

### 4.2 Diagramas Visuais em ASCII

#### Acorde Em (Mi Menor):
```
    E  A  D  G  B  E
    ○  │  │  ○  ○  ○   <- Traste 0 (Cordas soltas)
 1 ┌───┼──┼───┼──┼───┐
   │   │  │   │  │   │
 2 ├───●──●───┼──┼───┤  <- Dedo 2 na Corda 5, Dedo 3 na Corda 4
   │   2  3   │  │   │
 3 ├───┼──┼───┼──┼───┤
   │   │  │   │  │   │
```

#### Acorde G (Sol Maior - Clássico Aberto):
```
    E  A  D  G  B  E
    │  │  ○  ○  ○  │
 1 ┌───┼──┼───┼──┼───┐
   │   │  │   │  │   │
 2 ├───●──┼───┼──┼───┤  <- Dedo 1 na Corda 5
   │   1  │   │  │   │
 3 ●───┼──┼───┼──┼───●  <- Dedo 2 na Corda 6, Dedo 3 na Corda 1
   2   │  │   │  │   3
```

#### Acorde D (Ré Maior):
```
    E  A  D  G  B  E
    ✕  ✕  ○  │  │  │   <- Cordas 6 e 5 abafadas (✕)
 1 ┌───┼──┼───┼──┼───┐
   │   │  │   │  │   │
 2 ├───┼──┼───●──┼───●  <- Dedo 1 na Corda 3, Dedo 2 na Corda 1
   │   │  │   1  │   2
 3 ├───┼──┼───┼──●───┤  <- Dedo 3 na Corda 2
   │   │  │   │  3   │
```

#### Acorde C (Dó Maior):
```
    E  A  D  G  B  E
    ✕  │  │  ○  │  ○
 1 ┌───┼──┼───┼──●───┐  <- Dedo 1 na Corda 2
   │   │  │   │  1   │
 2 ├───┼──●───┼──┼───┤  <- Dedo 2 na Corda 4
   │   │  2   │  │   │
 3 ├───●──┼───┼──┼───┤  <- Dedo 3 na Corda 5
   │   3  │   │  │   │
```

#### Acorde D6add9/F# (America - "Horse with No Name"):
```
    E  A  D  G  B  E
    │  ○  ○  │  ○  ○   <- Apenas 2 dedos na casa 2!
 1 ┌───┼──┼───┼──┼───┐
   │   │  │   │  │   │
 2 ●───┼──┼───●──┼───┤  <- Dedo 2 na Corda 6, Dedo 3 na Corda 3
   2   │  │   3  │   │
 3 ├───┼──┼───┼──┼───┤
```

#### Acorde Am7 (Lá Menor com Sétima):
```
    E  A  D  G  B  E
    ✕  ○  │  ○  │  ○
 1 ┌───┼──┼───┼──●───┐  <- Dedo 1 na Corda 2
   │   │  │   │  1   │
 2 ├───┼──●───┼──┼───┤  <- Dedo 2 na Corda 4
   │   │  2   │  │   │
 3 ├───┼──┼───┼──┼───┤
```

#### Acorde Bm (Si Menor com Pestana):
```
  Casa 2
    E  A  D  G  B  E
    ✕  ══════════════   <- Pestana com Dedo 1 da corda 5 à 1 na casa 2
 2 ├───[1──1──1──1──1]
   │   │  │   │  │   │
 3 ├───┼──┼───┼──●───┤  <- Dedo 2 na Corda 2 (Casa 3)
   │   │  │   │  2   │
 4 ├───┼──●───●──┼───┤  <- Dedo 3 na Corda 4, Dedo 4 na Corda 3 (Casa 4)
   │   │  3   4  │   │
```

---

## 5. Especificação do Catálogo Inicial com JSONs Completos

Abaixo estão os 5 arquivos de dados prontos para consumo pela esteira e motor de áudio.

---

### 5.1 Exemplo 1: Exercício Cordas Soltas & Dedilhado Básico

- **ID:** `exercise-open-strings-fingerpicking`
- **Foco Pedagógico:** Afinação de ouvido, estabilidade rítmica da mão direita (P-I-M-A), memorização das 6 cordas abertas.
- **Andamento:** 60 BPM (1 batida por segundo).

```json
{
  "id": "exercise-open-strings-fingerpicking",
  "title": "Cordas Soltas e Dedilhado Fundamental",
  "artist": "EzViola Academy",
  "genre": "Exercise",
  "difficulty": "beginner",
  "difficultyRating": 1,
  "bpm": 60,
  "timeSignature": {
    "numerator": 4,
    "denominator": 4
  },
  "durationSec": 20.0,
  "capo": 0,
  "tuning": ["E2", "A2", "D3", "G3", "B3", "E4"],
  "chordsUsed": {},
  "timeline": [
    {
      "id": "ev-01",
      "timeSec": 0.0,
      "beat": 0.0,
      "measure": 1,
      "durationBeats": 1.0,
      "durationSec": 1.0,
      "type": "single-note",
      "notes": [{ "string": 6, "fret": 0, "pitch": "E2", "finger": 0, "hand": "P" }]
    },
    {
      "id": "ev-02",
      "timeSec": 1.0,
      "beat": 1.0,
      "measure": 1,
      "durationBeats": 1.0,
      "durationSec": 1.0,
      "type": "single-note",
      "notes": [{ "string": 5, "fret": 0, "pitch": "A2", "finger": 0, "hand": "P" }]
    },
    {
      "id": "ev-03",
      "timeSec": 2.0,
      "beat": 2.0,
      "measure": 1,
      "durationBeats": 1.0,
      "durationSec": 1.0,
      "type": "single-note",
      "notes": [{ "string": 4, "fret": 0, "pitch": "D3", "finger": 0, "hand": "P" }]
    },
    {
      "id": "ev-04",
      "timeSec": 3.0,
      "beat": 3.0,
      "measure": 1,
      "durationBeats": 1.0,
      "durationSec": 1.0,
      "type": "single-note",
      "notes": [{ "string": 3, "fret": 0, "pitch": "G3", "finger": 0, "hand": "I" }]
    },
    {
      "id": "ev-05",
      "timeSec": 4.0,
      "beat": 4.0,
      "measure": 2,
      "durationBeats": 1.0,
      "durationSec": 1.0,
      "type": "single-note",
      "notes": [{ "string": 2, "fret": 0, "pitch": "B3", "finger": 0, "hand": "M" }]
    },
    {
      "id": "ev-06",
      "timeSec": 5.0,
      "beat": 5.0,
      "measure": 2,
      "durationBeats": 1.0,
      "durationSec": 1.0,
      "type": "single-note",
      "notes": [{ "string": 1, "fret": 0, "pitch": "E4", "finger": 0, "hand": "A" }]
    },
    {
      "id": "ev-07",
      "timeSec": 6.0,
      "beat": 6.0,
      "measure": 2,
      "durationBeats": 2.0,
      "durationSec": 2.0,
      "type": "single-note",
      "notes": [{ "string": 1, "fret": 0, "pitch": "E4", "finger": 0, "hand": "A" }]
    },
    {
      "id": "ev-08",
      "timeSec": 8.0,
      "beat": 8.0,
      "measure": 3,
      "durationBeats": 1.0,
      "durationSec": 1.0,
      "type": "single-note",
      "notes": [{ "string": 1, "fret": 0, "pitch": "E4", "finger": 0, "hand": "A" }]
    },
    {
      "id": "ev-09",
      "timeSec": 9.0,
      "beat": 9.0,
      "measure": 3,
      "durationBeats": 1.0,
      "durationSec": 1.0,
      "type": "single-note",
      "notes": [{ "string": 2, "fret": 0, "pitch": "B3", "finger": 0, "hand": "M" }]
    },
    {
      "id": "ev-10",
      "timeSec": 10.0,
      "beat": 10.0,
      "measure": 3,
      "durationBeats": 1.0,
      "durationSec": 1.0,
      "type": "single-note",
      "notes": [{ "string": 3, "fret": 0, "pitch": "G3", "finger": 0, "hand": "I" }]
    },
    {
      "id": "ev-11",
      "timeSec": 11.0,
      "beat": 11.0,
      "measure": 3,
      "durationBeats": 1.0,
      "durationSec": 1.0,
      "type": "single-note",
      "notes": [{ "string": 4, "fret": 0, "pitch": "D3", "finger": 0, "hand": "P" }]
    },
    {
      "id": "ev-12",
      "timeSec": 12.0,
      "beat": 12.0,
      "measure": 4,
      "durationBeats": 1.0,
      "durationSec": 1.0,
      "type": "single-note",
      "notes": [{ "string": 5, "fret": 0, "pitch": "A2", "finger": 0, "hand": "P" }]
    },
    {
      "id": "ev-13",
      "timeSec": 13.0,
      "beat": 13.0,
      "measure": 4,
      "durationBeats": 3.0,
      "durationSec": 3.0,
      "type": "single-note",
      "notes": [{ "string": 6, "fret": 0, "pitch": "E2", "finger": 0, "hand": "P" }]
    }
  ]
}
```

---

### 5.2 Exemplo 2: Progressão Básica de Acordes Abertos (Em - G - D - C)

- **ID:** `exercise-open-chords-em-g-d-c`
- **Foco Pedagógico:** Transição rítmica entre os quatro pilares harmônicos do violão ocidental. Cada acorde dura 1 compasso inteiro (4 tempos) para dar tempo de posicionar a mão.
- **Andamento:** 65 BPM.

```json
{
  "id": "exercise-open-chords-em-g-d-c",
  "title": "Os Quatro Cavaleiros: Em - G - D - C",
  "artist": "EzViola Academy",
  "genre": "Exercise",
  "difficulty": "beginner",
  "difficultyRating": 1,
  "bpm": 65,
  "timeSignature": {
    "numerator": 4,
    "denominator": 4
  },
  "durationSec": 32.0,
  "capo": 0,
  "tuning": ["E2", "A2", "D3", "G3", "B3", "E4"],
  "chordsUsed": {
    "Em": {
      "chordId": "Em",
      "displayName": "Em (Mi menor)",
      "baseFret": 1,
      "frets": [0, 2, 2, 0, 0, 0],
      "fingers": [0, 2, 3, 0, 0, 0],
      "notes": ["E2", "B2", "E3", "G3", "B3", "E4"]
    },
    "G": {
      "chordId": "G",
      "displayName": "G (Sol maior)",
      "baseFret": 1,
      "frets": [3, 2, 0, 0, 0, 3],
      "fingers": [2, 1, 0, 0, 0, 3],
      "notes": ["G2", "B2", "D3", "G3", "B3", "G4"]
    },
    "D": {
      "chordId": "D",
      "displayName": "D (Ré maior)",
      "baseFret": 1,
      "frets": [-1, -1, 0, 2, 3, 2],
      "fingers": [0, 0, 0, 1, 3, 2],
      "notes": ["D3", "A3", "D4", "F#4"]
    },
    "C": {
      "chordId": "C",
      "displayName": "C (Dó maior)",
      "baseFret": 1,
      "frets": [-1, 3, 2, 0, 1, 0],
      "fingers": [0, 3, 2, 0, 1, 0],
      "notes": ["C3", "E3", "G3", "C4", "E4"]
    }
  },
  "timeline": [
    {
      "id": "chord-em-1",
      "timeSec": 0.0,
      "beat": 0.0,
      "measure": 1,
      "durationBeats": 4.0,
      "durationSec": 3.692,
      "type": "chord",
      "chordId": "Em",
      "strumDirection": "down"
    },
    {
      "id": "chord-g-1",
      "timeSec": 3.692,
      "beat": 4.0,
      "measure": 2,
      "durationBeats": 4.0,
      "durationSec": 3.692,
      "type": "chord",
      "chordId": "G",
      "strumDirection": "down"
    },
    {
      "id": "chord-d-1",
      "timeSec": 7.385,
      "beat": 8.0,
      "measure": 3,
      "durationBeats": 4.0,
      "durationSec": 3.692,
      "type": "chord",
      "chordId": "D",
      "strumDirection": "down"
    },
    {
      "id": "chord-c-1",
      "timeSec": 11.077,
      "beat": 12.0,
      "measure": 4,
      "durationBeats": 4.0,
      "durationSec": 3.692,
      "type": "chord",
      "chordId": "C",
      "strumDirection": "down"
    },
    {
      "id": "chord-em-2",
      "timeSec": 14.769,
      "beat": 16.0,
      "measure": 5,
      "durationBeats": 4.0,
      "durationSec": 3.692,
      "type": "chord",
      "chordId": "Em",
      "strumDirection": "down"
    },
    {
      "id": "chord-g-2",
      "timeSec": 18.461,
      "beat": 20.0,
      "measure": 6,
      "durationBeats": 4.0,
      "durationSec": 3.692,
      "type": "chord",
      "chordId": "G",
      "strumDirection": "down"
    },
    {
      "id": "chord-d-2",
      "timeSec": 22.154,
      "beat": 24.0,
      "measure": 7,
      "durationBeats": 4.0,
      "durationSec": 3.692,
      "type": "chord",
      "chordId": "D",
      "strumDirection": "down"
    },
    {
      "id": "chord-c-2",
      "timeSec": 25.846,
      "beat": 28.0,
      "measure": 8,
      "durationBeats": 4.0,
      "durationSec": 3.692,
      "type": "chord",
      "chordId": "C",
      "strumDirection": "down"
    }
  ]
}
```

---

### 5.3 Exemplo 3: "A Horse with No Name" — America

- **ID:** `song-horse-with-no-name`
- **Foco Pedagógico:** A música mais acessível da história do violão para iniciantes (utiliza apenas 2 acordes de 2 dedos cada, mantendo 4 cordas soltas).
- **Andamento:** 120 BPM (ou 60 BPM no Modo de Treino Lento).

```json
{
  "id": "song-horse-with-no-name",
  "title": "A Horse with No Name",
  "artist": "America",
  "genre": "Folk",
  "difficulty": "beginner",
  "difficultyRating": 1,
  "bpm": 120,
  "timeSignature": {
    "numerator": 4,
    "denominator": 4
  },
  "durationSec": 24.0,
  "capo": 0,
  "tuning": ["E2", "A2", "D3", "G3", "B3", "E4"],
  "chordsUsed": {
    "Em": {
      "chordId": "Em",
      "displayName": "Em",
      "baseFret": 1,
      "frets": [0, 2, 2, 0, 0, 0],
      "fingers": [0, 2, 3, 0, 0, 0],
      "notes": ["E2", "B2", "E3", "G3", "B3", "E4"]
    },
    "D6add9_Fsharp": {
      "chordId": "D6add9_Fsharp",
      "displayName": "D6add9/F#",
      "baseFret": 1,
      "frets": [2, 0, 0, 2, 0, 0],
      "fingers": [2, 0, 0, 3, 0, 0],
      "notes": ["F#2", "A2", "D3", "A3", "B3", "E4"]
    }
  },
  "timeline": [
    {
      "id": "hwnn-01",
      "timeSec": 0.0,
      "beat": 0.0,
      "measure": 1,
      "durationBeats": 2.0,
      "durationSec": 1.0,
      "type": "chord",
      "chordId": "Em",
      "strumDirection": "down",
      "lyrics": "On the first"
    },
    {
      "id": "hwnn-02",
      "timeSec": 1.0,
      "beat": 2.0,
      "measure": 1,
      "durationBeats": 2.0,
      "durationSec": 1.0,
      "type": "chord",
      "chordId": "Em",
      "strumDirection": "down",
      "lyrics": "part of the"
    },
    {
      "id": "hwnn-03",
      "timeSec": 2.0,
      "beat": 4.0,
      "measure": 2,
      "durationBeats": 2.0,
      "durationSec": 1.0,
      "type": "chord",
      "chordId": "D6add9_Fsharp",
      "strumDirection": "down",
      "lyrics": "journey"
    },
    {
      "id": "hwnn-04",
      "timeSec": 3.0,
      "beat": 6.0,
      "measure": 2,
      "durationBeats": 2.0,
      "durationSec": 1.0,
      "type": "chord",
      "chordId": "D6add9_Fsharp",
      "strumDirection": "down"
    },
    {
      "id": "hwnn-05",
      "timeSec": 4.0,
      "beat": 8.0,
      "measure": 3,
      "durationBeats": 2.0,
      "durationSec": 1.0,
      "type": "chord",
      "chordId": "Em",
      "strumDirection": "down",
      "lyrics": "I was looking"
    },
    {
      "id": "hwnn-06",
      "timeSec": 5.0,
      "beat": 10.0,
      "measure": 3,
      "durationBeats": 2.0,
      "durationSec": 1.0,
      "type": "chord",
      "chordId": "Em",
      "strumDirection": "down",
      "lyrics": "at all the"
    },
    {
      "id": "hwnn-07",
      "timeSec": 6.0,
      "beat": 12.0,
      "measure": 4,
      "durationBeats": 2.0,
      "durationSec": 1.0,
      "type": "chord",
      "chordId": "D6add9_Fsharp",
      "strumDirection": "down",
      "lyrics": "life"
    },
    {
      "id": "hwnn-08",
      "timeSec": 7.0,
      "beat": 14.0,
      "measure": 4,
      "durationBeats": 2.0,
      "durationSec": 1.0,
      "type": "chord",
      "chordId": "D6add9_Fsharp",
      "strumDirection": "down"
    },
    {
      "id": "hwnn-09",
      "timeSec": 8.0,
      "beat": 16.0,
      "measure": 5,
      "durationBeats": 2.0,
      "durationSec": 1.0,
      "type": "chord",
      "chordId": "Em",
      "strumDirection": "down",
      "lyrics": "There were plants"
    },
    {
      "id": "hwnn-10",
      "timeSec": 9.0,
      "beat": 18.0,
      "measure": 5,
      "durationBeats": 2.0,
      "durationSec": 1.0,
      "type": "chord",
      "chordId": "Em",
      "strumDirection": "down",
      "lyrics": "and birds"
    },
    {
      "id": "hwnn-11",
      "timeSec": 10.0,
      "beat": 20.0,
      "measure": 6,
      "durationBeats": 2.0,
      "durationSec": 1.0,
      "type": "chord",
      "chordId": "D6add9_Fsharp",
      "strumDirection": "down",
      "lyrics": "and rocks"
    },
    {
      "id": "hwnn-12",
      "timeSec": 11.0,
      "beat": 22.0,
      "measure": 6,
      "durationBeats": 2.0,
      "durationSec": 1.0,
      "type": "chord",
      "chordId": "D6add9_Fsharp",
      "strumDirection": "down",
      "lyrics": "and things"
    }
  ]
}
```

---

### 5.4 Exemplo 4: "Knockin' on Heaven's Door" — Bob Dylan

- **ID:** `song-knockin-on-heavens-door`
- **Foco Pedagógico:** Estrutura clássica de estrofe folk com duas frases simétricas: `G - D - Am7` alternando com `G - D - C`.
- **Andamento:** 68 BPM.

```json
{
  "id": "song-knockin-on-heavens-door",
  "title": "Knockin' on Heaven's Door",
  "artist": "Bob Dylan",
  "genre": "Rock",
  "difficulty": "beginner",
  "difficultyRating": 2,
  "bpm": 68,
  "timeSignature": {
    "numerator": 4,
    "denominator": 4
  },
  "durationSec": 28.235,
  "capo": 0,
  "tuning": ["E2", "A2", "D3", "G3", "B3", "E4"],
  "chordsUsed": {
    "G": {
      "chordId": "G",
      "displayName": "G",
      "baseFret": 1,
      "frets": [3, 2, 0, 0, 0, 3],
      "fingers": [2, 1, 0, 0, 0, 3],
      "notes": ["G2", "B2", "D3", "G3", "B3", "G4"]
    },
    "D": {
      "chordId": "D",
      "displayName": "D",
      "baseFret": 1,
      "frets": [-1, -1, 0, 2, 3, 2],
      "fingers": [0, 0, 0, 1, 3, 2],
      "notes": ["D3", "A3", "D4", "F#4"]
    },
    "Am7": {
      "chordId": "Am7",
      "displayName": "Am7",
      "baseFret": 1,
      "frets": [-1, 0, 2, 0, 1, 0],
      "fingers": [0, 0, 2, 0, 1, 0],
      "notes": ["A2", "E3", "G3", "C4", "E4"]
    },
    "C": {
      "chordId": "C",
      "displayName": "C",
      "baseFret": 1,
      "frets": [-1, 3, 2, 0, 1, 0],
      "fingers": [0, 3, 2, 0, 1, 0],
      "notes": ["C3", "E3", "G3", "C4", "E4"]
    }
  },
  "timeline": [
    {
      "id": "kd-01",
      "timeSec": 0.0,
      "beat": 0.0,
      "measure": 1,
      "durationBeats": 2.0,
      "durationSec": 1.765,
      "type": "chord",
      "chordId": "G",
      "strumDirection": "down",
      "lyrics": "Mama take this"
    },
    {
      "id": "kd-02",
      "timeSec": 1.765,
      "beat": 2.0,
      "measure": 1,
      "durationBeats": 2.0,
      "durationSec": 1.765,
      "type": "chord",
      "chordId": "D",
      "strumDirection": "down",
      "lyrics": "badge off of me"
    },
    {
      "id": "kd-03",
      "timeSec": 3.529,
      "beat": 4.0,
      "measure": 2,
      "durationBeats": 4.0,
      "durationSec": 3.529,
      "type": "chord",
      "chordId": "Am7",
      "strumDirection": "down"
    },
    {
      "id": "kd-04",
      "timeSec": 7.059,
      "beat": 8.0,
      "measure": 3,
      "durationBeats": 2.0,
      "durationSec": 1.765,
      "type": "chord",
      "chordId": "G",
      "strumDirection": "down",
      "lyrics": "I can't use it"
    },
    {
      "id": "kd-05",
      "timeSec": 8.824,
      "beat": 10.0,
      "measure": 3,
      "durationBeats": 2.0,
      "durationSec": 1.765,
      "type": "chord",
      "chordId": "D",
      "strumDirection": "down",
      "lyrics": "anymore"
    },
    {
      "id": "kd-06",
      "timeSec": 10.588,
      "beat": 12.0,
      "measure": 4,
      "durationBeats": 4.0,
      "durationSec": 3.529,
      "type": "chord",
      "chordId": "C",
      "strumDirection": "down"
    },
    {
      "id": "kd-07",
      "timeSec": 14.118,
      "beat": 16.0,
      "measure": 5,
      "durationBeats": 2.0,
      "durationSec": 1.765,
      "type": "chord",
      "chordId": "G",
      "strumDirection": "down",
      "lyrics": "Knock knock"
    },
    {
      "id": "kd-08",
      "timeSec": 15.882,
      "beat": 18.0,
      "measure": 5,
      "durationBeats": 2.0,
      "durationSec": 1.765,
      "type": "chord",
      "chordId": "D",
      "strumDirection": "down",
      "lyrics": "knockin' on"
    },
    {
      "id": "kd-09",
      "timeSec": 17.647,
      "beat": 20.0,
      "measure": 6,
      "durationBeats": 4.0,
      "durationSec": 3.529,
      "type": "chord",
      "chordId": "Am7",
      "strumDirection": "down",
      "lyrics": "heaven's door"
    },
    {
      "id": "kd-10",
      "timeSec": 21.176,
      "beat": 24.0,
      "measure": 7,
      "durationBeats": 2.0,
      "durationSec": 1.765,
      "type": "chord",
      "chordId": "G",
      "strumDirection": "down",
      "lyrics": "Knock knock"
    },
    {
      "id": "kd-11",
      "timeSec": 22.941,
      "beat": 26.0,
      "measure": 7,
      "durationBeats": 2.0,
      "durationSec": 1.765,
      "type": "chord",
      "chordId": "D",
      "strumDirection": "down",
      "lyrics": "knockin' on"
    },
    {
      "id": "kd-12",
      "timeSec": 24.706,
      "beat": 28.0,
      "measure": 8,
      "durationBeats": 4.0,
      "durationSec": 3.529,
      "type": "chord",
      "chordId": "C",
      "strumDirection": "down",
      "lyrics": "heaven's door"
    }
  ]
}
```

---

### 5.5 Exemplo 5: "Tempo Perdido" — Legião Urbana (Adaptação para Iniciantes)

- **ID:** `song-tempo-perdido`
- **Foco Pedagógico:** Clássico do rock nacional brasileiro. Oferece a progressão de 4 acordes `C - Am7 - Bm7 - Em` (utilizando a digitação de `Bm7` sem pestana para viabilizar execução fluida a iniciantes, com suporte documentado ao `Bm` com pestana no catálogo).
- **Andamento:** 85 BPM.

```json
{
  "id": "song-tempo-perdido",
  "title": "Tempo Perdido",
  "artist": "Legião Urbana",
  "genre": "Rock",
  "difficulty": "elementary",
  "difficultyRating": 2,
  "bpm": 85,
  "timeSignature": {
    "numerator": 4,
    "denominator": 4
  },
  "durationSec": 22.588,
  "capo": 0,
  "tuning": ["E2", "A2", "D3", "G3", "B3", "E4"],
  "chordsUsed": {
    "C": {
      "chordId": "C",
      "displayName": "C (Dó maior)",
      "baseFret": 1,
      "frets": [-1, 3, 2, 0, 1, 0],
      "fingers": [0, 3, 2, 0, 1, 0],
      "notes": ["C3", "E3", "G3", "C4", "E4"]
    },
    "Am7": {
      "chordId": "Am7",
      "displayName": "Am7 (Lá menor com 7ª)",
      "baseFret": 1,
      "frets": [-1, 0, 2, 0, 1, 0],
      "fingers": [0, 0, 2, 0, 1, 0],
      "notes": ["A2", "E3", "G3", "C4", "E4"]
    },
    "Bm7_easy": {
      "chordId": "Bm7_easy",
      "displayName": "Bm7 (Si menor com 7ª fácil)",
      "baseFret": 1,
      "frets": [-1, 2, 0, 2, 0, 2],
      "fingers": [0, 1, 0, 2, 0, 3],
      "notes": ["B2", "D3", "A3", "B3", "F#4"]
    },
    "Bm": {
      "chordId": "Bm",
      "displayName": "Bm (Si menor com Pestana)",
      "baseFret": 2,
      "frets": [-1, 2, 4, 4, 3, 2],
      "fingers": [0, 1, 3, 4, 2, 1],
      "barres": [
        {
          "fret": 2,
          "fromString": 5,
          "toString": 1,
          "finger": 1
        }
      ],
      "notes": ["B2", "F#3", "B3", "D4", "F#4"]
    },
    "Em": {
      "chordId": "Em",
      "displayName": "Em (Mi menor)",
      "baseFret": 1,
      "frets": [0, 2, 2, 0, 0, 0],
      "fingers": [0, 2, 3, 0, 0, 0],
      "notes": ["E2", "B2", "E3", "G3", "B3", "E4"]
    }
  },
  "timeline": [
    {
      "id": "tp-01",
      "timeSec": 0.0,
      "beat": 0.0,
      "measure": 1,
      "durationBeats": 4.0,
      "durationSec": 2.824,
      "type": "chord",
      "chordId": "C",
      "strumDirection": "down",
      "lyrics": "Todos os dias"
    },
    {
      "id": "tp-02",
      "timeSec": 2.824,
      "beat": 4.0,
      "measure": 2,
      "durationBeats": 4.0,
      "durationSec": 2.824,
      "type": "chord",
      "chordId": "Am7",
      "strumDirection": "down",
      "lyrics": "quando acordo"
    },
    {
      "id": "tp-03",
      "timeSec": 5.647,
      "beat": 8.0,
      "measure": 3,
      "durationBeats": 4.0,
      "durationSec": 2.824,
      "type": "chord",
      "chordId": "Bm7_easy",
      "strumDirection": "down",
      "lyrics": "Não tenho mais"
    },
    {
      "id": "tp-04",
      "timeSec": 8.471,
      "beat": 12.0,
      "measure": 4,
      "durationBeats": 4.0,
      "durationSec": 2.824,
      "type": "chord",
      "chordId": "Em",
      "strumDirection": "down",
      "lyrics": "o tempo que passou"
    },
    {
      "id": "tp-05",
      "timeSec": 11.294,
      "beat": 16.0,
      "measure": 5,
      "durationBeats": 4.0,
      "durationSec": 2.824,
      "type": "chord",
      "chordId": "C",
      "strumDirection": "down",
      "lyrics": "Mas tenho muito tempo"
    },
    {
      "id": "tp-06",
      "timeSec": 14.118,
      "beat": 20.0,
      "measure": 6,
      "durationBeats": 4.0,
      "durationSec": 2.824,
      "type": "chord",
      "chordId": "Am7",
      "strumDirection": "down",
      "lyrics": "Temos todo o tempo"
    },
    {
      "id": "tp-07",
      "timeSec": 16.941,
      "beat": 24.0,
      "measure": 7,
      "durationBeats": 4.0,
      "durationSec": 2.824,
      "type": "chord",
      "chordId": "Bm7_easy",
      "strumDirection": "down",
      "lyrics": "do mundo"
    },
    {
      "id": "tp-08",
      "timeSec": 19.765,
      "beat": 28.0,
      "measure": 8,
      "durationBeats": 4.0,
      "durationSec": 2.824,
      "type": "chord",
      "chordId": "Em",
      "strumDirection": "down"
    }
  ]
}
```

---

## 6. Próximos Passos para Engenharia & Arquitetura de Áudio

1. **Audio DSP Engine:** Integração com AudioWorklet offloading a transformada rápida de Fourier (FFT), autocorrelação YIN/MPM e extração de Cromagrama (12 pitch classes) para matching polifônico com os `chordsUsed` do `SongSchema`.
2. **Componente de Renderização Canvas:** Construção do componente React `<ConveyorBelt />` consumindo `timeline` e sincronizado via `AudioContext.currentTime`.
3. **Módulo de Calibração Noise Gate:** Criação do modal UI interativo baseado nas diretrizes da Seção 2.5.
