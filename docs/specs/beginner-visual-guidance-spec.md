# EzViola — Especificação de UX e Guia Visual para Iniciantes Absolutos

**Documento:** Arquitetura de UX, Orientação Visual Animada e Interação Hands-Free para Iniciantes Absolutos  
**Versão:** 1.0.0  
**Status:** Aprovado para Implementação (Fase 2 / UX-Design)  
**Autor:** @ux-designer (Visual Guidance & Beginner UI Specialist)  
**Projeto:** EzViola (Plataforma Web de Aprendizado de Violão com Detecção de Áudio em Tempo Real)  
**Destinatários:** Engenharia Frontend, Engenharia de DSP/Áudio, Designers de Produto e Especialistas em Acessibilidade  
**Documentos Relacionados:**
- `docs/specs/ux-and-songs-specification.md` (UX Geral, Gamificação e Catálogo)
- `docs/specs/audio-dsp-specification.md` (Topologia de DSP e Reconhecimento de Áudio)
- `docs/specs/architecture-validation.md` (Auditoria e Validação Arquitetural)
- `docs/plans/implementation-plan.md` (Plano Mestre de Execução)

---

## 1. Resumo Executivo & A Persona do "Iniciante Zero"

### 1.1 O Desafio Crítico de Usabilidade no Violão
Aprender violão nos primeiros dias impõe uma carga física, motora e cognitiva extrema:
1. **Mãos Ocupadas:** O usuário está sentado com o corpo do violão repousado na coxa direita (ou esquerda), a mão esquerda sustentando o braço com os tendões sob tensão tentando não abafar cordas, e a mão direita segurando uma palheta ou posicionada para dedilhado. **Exigir que o usuário toque no mouse, no trackpad ou na tela do smartphone a cada passo da calibração ou treino é uma falha fatal de usabilidade.**
2. **Ansiedade de Danificar o Instrumento:** Quase todo iniciante absoluto tem medo de arrebentar cordas ao afinar ("se eu girar para o lado errado, a corda estoura no meu olho?").
3. **Barreira de Jargão Técnico:** Conceitos como "Frequência fundamental de 82.4 Hz", "E2", "Corda 6", "Subir 15 cents", "Tétrade menor com sétima" ou diagramas com símbolos abstratos geram paralisia cognitiva instantânea.
4. **Fadiga das Pontas dos Dedos:** O atrito das cordas de aço ou nylon na pele sem calos gera dor física após 10 a 15 minutos contínuos. A interface deve ser ultra-eficiente para que o tempo de treino renda o máximo com zero desperdício.

### 1.2 Persona Primária: Lucas, 22 anos — Iniciante Absoluto ("Do Zero")
- **Perfil:** Nunca tocou nenhum instrumento musical. Ganhou ou comprou um violão acústico e baixou o EzViola no navegador pelo celular ou notebook apoiado na mesa.
- **Conhecimento Prévio:** Zero teoria. Não sabe o nome das cordas, não sabe qual é a corda 1 ou a corda 6, não sabe ler tablatura, partitura ou cifras complexas.
- **Objetivo Principal:** Conseguir afinar o violão com segurança, tocar seus primeiros acordes simples sem dores desnecessárias e ter a sensação gratificante de tocar sua primeira música.
- **Gatilho de Desistência:** Mensagens de erro frias, interfaces que não respondem ao toque do violão, necessidade de largar o violão para clicar na tela, ou diagramas sem indicação de qual dedo usar.

---

## 2. A Regra de Ouro: Mãos Livres & Zero Ambiguidade Visual

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        LEIS FUNDAMENTAIS DO DESIGN INICIANTE                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1. MÃOS LIVRES ABSOLUTAS: Uma vez clicado "Iniciar", a sessão opera 100% por │
│    reconhecimento de áudio. Zero toques necessários na tela ou teclado.      │
│                                                                              │
│ 2. METÁFORA FÍSICA DIRETA: O violão na tela deve espelhar exatamente a       │
│    perspectiva do instrumentista olhando para baixo no próprio colo.         │
│                                                                              │
│ 3. ANATOMIA DE CORES POR DEDO: 1=Indicador (Azul), 2=Médio (Verde),          │
│    3=Anelar (Laranja), 4=Mínimo (Roxo).                                      │
│                                                                              │
│ 4. ORIENTAÇÃO MECÂNICA DAS TARRAXAS: Indicar não só se está alto/baixo, mas  │
│    QUAL pino girar e EM QUAL SENTIDO (Apertar vs Afrouxar).                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Metáforas Físicas vs. Jargão Abstrato
A interface substitui a notação isolada por metáforas espaciais e táteis:

| Notação Técnica Antiga | Metáfora Física para Iniciante (Nova UX) | Sinalização Visual Direta |
|---|---|---|
| **Corda 6 / E2** | **Corda mais grossa (Cima)** | Linha mais grossa pulsando no topo do braço, próxima ao queixo |
| **Corda 5 / A2** | **Segunda corda mais grossa** | Linha média-grossa iluminada |
| **Corda 4 / D3** | **Terceira corda (Meio)** | Linha intermediária iluminada |
| **Corda 3 / G3** | **Terceira corda (Meio-Baixo)** | Linha intermediária fina iluminada |
| **Corda 2 / B3** | **Segunda corda mais fina** | Linha fina iluminada |
| **Corda 1 / E4** | **Corda mais fina (Baixo)** | Linha ultrafina pulsando na base do braço, voltada para o chão |
| **+30 cents (Sharp)** | **Corda esticada demais — AFROUXE a tarraxa** | Seta curva girando no sentido de soltar a tensão |
| **-35 cents (Flat)** | **Corda frouxa — APERTE a tarraxa** | Seta curva girando no sentido de tensionar a corda |
| **Fret / Traste** | **Casas do Violão (Casa 1, Casa 2, Casa 3...)** | Divisões verticais numeradas com destaque de relevo |
| **Muted String (X)** | **NÃO toque nesta corda** | Símbolo ✕ vermelho luminoso sobre a corda |
| **Open String (0)** | **Toque solta (sem apertar nenhuma casa)** | Círculo ○ verde com indicação de palhetada |

---

## 3. Arquitetura da Máquina de Estados Hands-Free

Para garantir que o usuário nunca precise tirar as mãos do violão durante o fluxo de calibração ou afinação, a interface implementa uma máquina de estados finitos orientada a eventos acústicos (`Audio-Driven State Machine`).

```
                    ┌──────────────────────────────┐
                    │       ESTADO 1: OUVINDO      │
                    │   "Aguardando você tocar..." │
                    │   (Ícone de palheta pulsando)│
                    └──────────────┬───────────────┘
                                   │ Sinal RMS > Threshold_Open
                                   │ e F0 detectado
                                   ▼
                    ┌──────────────────────────────┐
                    │     ESTADO 2: CAPTURANDO     │
                    │ "Ouvindo a corda... deixe    │
                    │  vibrar!" (Onda sonora suave)│
                    └──────────────┬───────────────┘
                                   │ Pitch estável por 450ms
                                   ▼
                    ┌──────────────────────────────┐
                    │     ESTADO 3: PROGRESSO      │
                    │ "Ótimo! Toque mais N vezes"  │
                    │ (Contador visual: 1/3, 2/3)  │
                    └──────────────┬───────────────┘
                                   │ 3ª repetição confirmada
                                   ▼
                    ┌──────────────────────────────┐
                    │     ESTADO 4: SUCESSO        │
                    │ "Perfeito! Próxima corda..." │
                    │ (Flash verde + som suave)    │
                    └──────────────┬───────────────┘
                                   │ Delay automático de 800ms
                                   ▼
                    [Transição para a próxima corda]
```

### 3.1 Transições e Tolerâncias Temporais

```typescript
export interface HandsFreeCalibrationState {
  currentStage: "waiting" | "listening" | "counting" | "success" | "timeout";
  currentRepetition: number; // 0, 1, 2, 3
  targetRepetitions: number; // 3 toques exigidos para calibração sólida
  stabilityDurationMs: number; // tempo de estabilidade acústica acumulado
  lastOnsetTimestamp: number;
}
```

1. **Janela de Onset:** Quando o algoritmo YIN ou RMS detecta ataque de palhetada ($\text{RMS} > 0.015$), o sistema passa para o estado `listening` e desenha anéis de onda se propagando da corda.
2. **Buffer de Sustentação (Sustain Check):** A corda deve vibrar por pelo menos $350\text{ ms}$ sem interrupção de ruído para validar que foi um toque limpo e não um esbarrão acidental.
3. **Contador Visual 3x:**
   - 1º Toque: Badge acende 1/3 em âmbar dourado ("Ótimo! Toque mais 2 vezes...").
   - 2º Toque: Badge acende 2/3 em verde lima ("Muito bom! Só mais 1 vez...").
   - 3º Toque: Badge acende 3/3 em verde neon brilhante ("Perfeito!").
4. **Auto-Avanço:** Após $800\text{ ms}$ da 3ª confirmação, o assistente avança automaticamente para a próxima corda com animação deslizante do braço, sem necessidade de nenhum clique.

---

## 4. Guia Visual Animado na Calibração e no Afinador

### 4.1 Mockup Descritivo: Afinador com Orientação de Tarraxas e Metáfora Física

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  EZVIOLA AFINADOR — MODO INICIANTE DESCOMPLICADO                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         [ CABEÇA DO VIOLÃO & TARRAXAS ]                      │
│                                                                              │
│    Tarraxas de Cima (Graves)                   Tarraxas de Baixo (Agudas)    │
│    ┌────────┐                                                  ┌────────┐    │
│    │  (6)   │◄── [TARRAXA ATIVA]                               │  (3)   │    │
│    └────┬───┘                                                  └───┬────┘    │
│         │   GIRAR NESTE SENTIDO: ↺ APERTAR                         │         │
│    ┌────┴───┐                                                  ┌───┴────┐    │
│    │  (5)   │                                                  │  (2)   │    │
│    └────┬───┘                                                  └───┬────┘    │
│         │                                                          │         │
│    ┌────┴───┐                                                  ┌───┴────┐    │
│    │  (4)   │                                                  │  (1)   │    │
│    └────────┘                                                  └────────┘    │
│                                                                              │
│ ──────────────────────────────[ BRAÇO DO VIOLÃO ]─────────────────────────── │
│                                                                              │
│  (6) Corda mais grossa (Cima)  ══════════════════════════════ ◄ VIBRANDO!   │
│  (5) Segunda mais grossa       ──────────────────────────────                │
│  (4) Terceira corda            ──────────────────────────────                │
│  (3) Terceira mais fina        ──────────────────────────────                │
│  (2) Segunda mais fina         ──────────────────────────────                │
│  (1) Corda mais fina (Baixo)   ──────────────────────────────                │
│                                                                              │
│ ──────────────────────────[ PONTEIRO DE AFINAÇÃO ]────────────────────────── │
│                                                                              │
│                       FROUXA            PERFEITA          ESTICADA           │
│                      (Aperte)           (Afinada)         (Afrouxe)          │
│                          ◄──                 ▲                ──►            │
│                     ┌───────────┬────────────┴────────────┬───────────┐      │
│                     │ -50   -30 │   -10      0     +10    │ +30   +50 │      │
│                     └───────────┴────────────┬────────────┴───────────┘      │
│                                              │                               │
│                                          [PONTEIRO]                          │
│                                                                              │
│   STATUS EXPLÍCITO EM PORTUGUÊS:                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐   │
│   │  [ ÍCONE SETA CURVA ↺ ]                                              │   │
│   │  Corda frouxa — APERTE a tarraxa de cima devagar...                  │   │
│   │  (Gire no sentido da seta até o ponteiro chegar no centro verde)     │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Estados do Afinador com Indicação Textual Explícita

O afinador possui 3 zonas comportamentais inequívocas com feedback multimodal:

#### Estado A: Corda Frouxa (Abaixo da Afinação / $\Delta\text{cents} < -5$)
- **Cor Primária:** Âmbar suave (`#F59E0B`) transitando para Azul Céu (`#38BDF8`).
- **Mensagem Textual Principal:** `"Corda frouxa — APERTE a tarraxa"`
- **Subtexto Explicativo:** `"Gire devagar no sentido da seta para esticar a corda."`
- **Animação Visual:**
  - Seta curva animada pulsando sobre a tarraxa correspondente na cabeça do violão.
  - A corda selecionada no braço vibra com ondas de amplitude mais lenta.

#### Estado B: Corda Afinada (Zona Alvo / $|\Delta\text{cents}| \le 5$)
- **Cor Primária:** Verde Neon Brilhante (`#22C55E`) com glow difuso (`box-shadow: 0 0 25px rgba(34, 197, 94, 0.4)`).
- **Mensagem Textual Principal:** `"Perfeito! Corda afinada"`
- **Subtexto Explicativo:** `"Excelente! Deixe soar ou passe para a próxima corda."`
- **Feedback Multimodal:**
  - O ponteiro congela no centro com um halo luminoso verde.
  - Efeito opcional de micro-partículas douradas/verdes.
  - Trava automática por $1.2\text{s}$ para o usuário visualizar o sucesso antes de qualquer nova oscilação.

#### Estado C: Corda Esticada (Acima da Afinação / $\Delta\text{cents} > +5$)
- **Cor Primária:** Laranja / Carmesim de Atenção (`#EF4444`).
- **Mensagem Textual Principal:** `"Corda esticada — AFROUXE a tarraxa"`
- **Subtexto Explicativo:** `"Cuidado: gire no sentido contrário para soltar a corda."`
- **Mecanismo Anti-Pânico (Proteção de Estouro de Corda):**
  - Se a frequência estiver $> +60\text{ cents}$ ou próxima de 1 oitava acima, o sistema entra em alerta com banner pulsante em vermelho:
    `"PARE! A corda está muito tensionada. Afrouxe a tarraxa antes de continuar."`

---

## 5. Guia Visual Animado de Acordes (Fretboard Interativo)

Para o iniciante absoluto, cifras tradicionais em preto e branco são difíceis de decodificar. O componente de braço de violão do EzViola adota **design anatômico de alta densidade cognitiva**.

### 5.1 Codificação Cromática Universal dos Dedos

Cada dedo da mão esquerda (ou direita para canhotos) recebe uma cor fixa, adotada consistentemente em todos os diagramas, modais de Wait Mode e vídeos tutoriais:

```
               [ GUIA DE DEDOS DA MÃO ESQUERDA ]
               
                  (2) Médio [VERDE #10B981]
                       │
     (1) Indicador ────┼──── (3) Anelar [LARANJA #F97316]
     [AZUL #3B82F6]    │
                       └──── (4) Mínimo [ROXO #A855F7]
                       
              (P) Polegar: Apoio no verso do braço
```

- **Dedo 1 (Indicador):** Azul Real (`#3B82F6`) — Destaque de apoio inicial.
- **Dedo 2 (Médio):** Verde Esmeralda (`#10B981`) — Equilíbrio central.
- **Dedo 3 (Anelar):** Laranja Vibrante (`#F97316`) — Tensão e abertura.
- **Dedo 4 (Mínimo):** Roxo Violeta (`#A855F7`) — Extensão aguda.

### 5.2 Mockup Descritivo: Braço do Violão para Acordes com Casas Numeradas

Exemplo: Acorde **Em (Mi Menor)** — O acorde inaugural mais acessível do mundo:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ACORDE: MI MENOR (Em) — "O primeiro acorde perfeito"                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    Palhetada                                                                 │
│       │                                                                      │
│       ▼                                                                      │
│   [TOQUE TODAS]    CASA 1              CASA 2              CASA 3            │
│       │          (Traste 1)          (Traste 2)          (Traste 3)          │
│       │        ┌─────────────┬───────────────────────┬─────────────┐         │
│  (6)  ○ Solta ─┤             │                       │             │ (Grossa)│
│  (5)  ● Presa ─┤             │  (1) [AZUL] Dedo 1    │             │         │
│  (4)  ● Presa ─┤             │  (2) [VERDE] Dedo 2   │             │         │
│  (3)  ○ Solta ─┤             │                       │             │         │
│  (2)  ○ Solta ─┤             │                       │             │         │
│  (1)  ○ Solta ─┤             │                       │             │ (Fina)  │
│                └─────────────┴───────────────────────┴─────────────┘         │
│                     Traste               Traste              Traste          │
│                                                                              │
│  DICA PRÁTICA EM PORTUGUÊS CLARO:                                            │
│  "1. Coloque o Dedo 1 (Azul) na Casa 2 da Corda 5 (segunda mais grossa).     │
│   2. Coloque o Dedo 2 (Verde) na Casa 2 da Corda 4 (logo abaixo do dedo 1).  │
│   3. Palhete para baixo pegando TODAS as 6 cordas com suavidade!"            │
│                                                                              │
│  STATUS HANDS-FREE NO WAIT MODE:                                             │
│  [Ícone Onda Sonora] Aguardando você tocar o acorde no violão...             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Mockup Descritivo: Acordes com Cordas Abafadas (✕) e Sem Pestana

Exemplo: Acorde **Bm7 (Si Menor com Sétima Fácil)** de *Tempo Perdido*:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ACORDE: SI MENOR COM 7ª (Bm7 Fácil) — SEM PESTANA                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Palheta: NÃO toque a 6ª corda!                                             │
│       │                                                                      │
│  (6)  ✕ NÃO TOCAR ─────────────────────────────────────────────── (Grossa)   │
│  (5)  ● Presa ────┤             │ (1) [AZUL] Casa 2   │          │           │
│  (4)  ○ Solta ────┤             │                     │          │           │
│  (3)  ● Presa ────┤             │ (2) [VERDE] Casa 2  │          │           │
│  (2)  ● Presa ────┤             │                     │ (3) [LAR]│           │
│  (1)  ○ Solta ────┤             │                     │          │ (Fina)    │
│                   └─────────────┴─────────────────────┴──────────┘           │
│                       CASA 1            CASA 2            CASA 3             │
│                                                                              │
│  DICA PRÁTICA:                                                               │
│  "Sem pestana dolorosa!                                                      │
│   • Dedo 1 (Azul) na Casa 2 da Corda 5                                       │
│   • Dedo 2 (Verde) na Casa 2 da Corda 3                                      │
│   • Dedo 3 (Laranja) na Casa 3 da Corda 2                                    │
│   Passe a palheta da Corda 5 para baixo (deixe a corda mais grossa quieta)!" │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Dicionário Visual Pedagógico para Iniciantes (Catálogo Inaugural)

A tabela a seguir padroniza as instruções táteis para todos os acordes das lições da Fase 1, prontas para exibição dinâmica no componente de acorde e no Wait Mode:

```typescript
export interface BeginnerChordInstruction {
  chordId: string;
  beginnerName: string;
  shortTagline: string;
  fingerPlacements: {
    fingerNumber: 1 | 2 | 3 | 4;
    fingerName: "Indicador" | "Médio" | "Anelar" | "Mínimo";
    colorHex: string;
    stringNumber: number; // 1 to 6
    stringNameDescription: string;
    fretNumber: number;
  }[];
  strumInstructions: {
    targetStringsDescription: string;
    mutedStrings: number[]; // e.g. [6]
    openStrings: number[];  // e.g. [1, 2, 3, 4]
    strumDirection: "down" | "up" | "pinch";
  };
  pedagogicalTip: string;
}
```

### 6.1 Especificação Completa por Acorde

1. **Em (Mi Menor):**
   - *Nome Amigável:* "Mi Menor (O Acorde Mais Fácil)"
   - *Digitação:* Dedo 1 na Casa 2 da Corda 5 (segunda mais grossa); Dedo 2 na Casa 2 da Corda 4.
   - *Palhetada:* Toque todas as 6 cordas para baixo.
   - *Dica do Professor:* "Mantenha os dedos em pé, como martelinhos, para não encostar nas cordas de baixo."

2. **G (Sol Maior):**
   - *Nome Amigável:* "Sol Maior (Acorde Aberto Completo)"
   - *Digitação:* Dedo 2 na Casa 3 da Corda 6 (mais grossa); Dedo 1 na Casa 2 da Corda 5; Dedo 3 na Casa 3 da Corda 1 (mais fina).
   - *Palhetada:* Toque todas as 6 cordas com força e clareza.
   - *Dica do Professor:* "Posicione o dedo 2 bem no meio da casa 3. Este acorde soa brilhante e alegre!"

3. **C (Dó Maior):**
   - *Nome Amigável:* "Dó Maior (Escadinha Clássica)"
   - *Digitação:* Dedo 1 na Casa 1 da Corda 2 (segunda mais fina); Dedo 2 na Casa 2 da Corda 4; Dedo 3 na Casa 3 da Corda 5.
   - *Palhetada:* Toque da Corda 5 até a Corda 1. A corda 6 (mais grossa) não deve soar.
   - *Dica do Professor:* "Encoste de leve a ponta do dedo 3 na corda mais grossa para abafá-la se você errar a palhetada."

4. **D (Ré Maior):**
   - *Nome Amigável:* "Ré Maior (O Triângulo Agudo)"
   - *Digitação:* Dedo 1 na Casa 2 da Corda 3; Dedo 3 na Casa 3 da Corda 2; Dedo 2 na Casa 2 da Corda 1 (mais fina).
   - *Palhetada:* Toque apenas as 4 cordas de baixo (da corda 4 até a 1).
   - *Dica do Professor:* "Seus dedos formam um pequeno triângulo nas cordas finas. Não toque nas duas cordas mais grossas!"

5. **Am7 (Lá Menor com Sétima):**
   - *Nome Amigável:* "Lá Menor com 7ª (Apenas 2 Dedos)"
   - *Digitação:* Dedo 1 na Casa 1 da Corda 2; Dedo 2 na Casa 2 da Corda 4.
   - *Palhetada:* Toque da Corda 5 até a Corda 1.
   - *Dica do Professor:* "É quase um Dó Maior, só que tirando o dedo 3! Muito leve e fácil de trocar."

6. **Bm7_easy (Si Menor com Sétima Sem Pestana - Versão Legião Urbana):**
   - *Nome Amigável:* "Si Menor com 7ª (Sem Pestana)"
   - *Digitação:* Dedo 1 na Casa 2 da Corda 5; Dedo 2 na Casa 2 da Corda 3; Dedo 3 na Casa 3 da Corda 2.
   - *Palhetada:* Toque da Corda 5 para baixo. A corda mais grossa fica de fora.
   - *Dica do Professor:* "Essa é a versão secreta que o Renato Russo e o Dado Villa-Lobos usavam em Tempo Perdido para não cansar a mão com pestana!"

7. **D6add9/F# (A Horse with No Name):**
   - *Nome Amigável:* "Ré com Baixo em Fá Sustenido (O Acorde Desértico)"
   - *Digitação:* Dedo 1 na Casa 2 da Corda 6 (mais grossa); Dedo 2 na Casa 2 da Corda 3.
   - *Palhetada:* Toque todas as 6 cordas abertas.
   - *Dica do Professor:* "Apenas 2 dedos bem abertos. Deixe todas as outras cordas soltas vibrarem juntas!"

---

## 7. Componentes React / TypeScript para o Sistema de Design

Para transformar esta especificação em código robusto e reutilizável, definem-se 4 novos componentes de interface com acessibilidade nativa e desempenho a 60 FPS:

```
src/components/beginner/
├── guitar-headstock-viewer.tsx       # Ilustração SVG da cabeça com tarraxas animadas
├── animated-fretboard-guide.tsx      # Braço responsivo com casas numeradas e dedos coloridos
├── hands-free-tuner-card.tsx         # Card de afinação com seta de tarraxa e status português
└── hands-free-calibration-wizard.tsx # Wizard 100% acionado por áudio (Zero cliques)
```

### 7.1 Especificação de Props do `<GuitarHeadstockViewer />`

```typescript
export interface GuitarHeadstockViewerProps {
  activeStringIndex: number; // 0 (Corda 6 / E2) a 5 (Corda 1 / E4)
  tuningStatus: "too_flat" | "in_tune" | "too_sharp" | "silent";
  cents: number;
  directionToTurn: "tighten" | "loosen" | "none";
  width?: number;
  height?: number;
  className?: string;
}
```
- **Mapeamento Mecânico das Tarraxas:**
  - Corda 6, 5, 4: Tarraxas esquerdas/superiores.
  - Corda 3, 2, 1: Tarraxas direitas/inferiores.
- **Animação da Seta:** Seta circular SVG em SVG `<path>` com `@keyframes rotateTighten` e `rotateLoosen` para eliminar qualquer dúvida de qual direção girar a mão.

### 7.2 Especificação de Props do `<AnimatedFretboardGuide />`

```typescript
export interface AnimatedFretboardGuideProps {
  chordId?: string;
  activeStringNumber?: number; // Para calibração de corda única (1 a 6)
  fretsToShow?: number;        // Padrão 4 ou 5 casas
  showFingersLegend?: boolean; // Exibe o guia 1=Azul, 2=Verde...
  isVibrating?: boolean;       // Anima a vibração da corda selecionada
  vibrationAmplitude?: number; // 0.0 a 1.0 (conectado ao RMS real do microfone)
  onChordLearned?: () => void;
}
```

---

## 8. Considerações de Ergonomia, Distância de Uso & Acessibilidade

### 8.1 Ergonomia à Distância (Viewing Distance: 1.2m a 2.0m)
Quando o usuário toca violão, o celular ou notebook raramente está na ponta do nariz. O dispositivo repousa:
- Sobre uma mesa de centro ($1.2\text{m}$ de distância).
- Apoiado na cama ou estante de partitura ($1.5\text{m}$ a $2.0\text{m}$).
- No chão sobre o tapete ($1.0\text{m}$).

**Diretrizes de Legibilidade:**
1. **Tamanho Mínimo de Fonte de Status:** $24\text{px}$ a $32\text{px}$ com peso font-black (`font-weight: 900`) para mensagens vitais ("APERTE a tarraxa", "Ouvindo...").
2. **Ícones Gigantes de Ação:** Ícone de palheta e setas com no mínimo $48\times 48\text{px}$.
3. **Contrast Ratio WCAG AAA:** Todos os fundos utilizam Slate 950 (`#020617`) ou Slate 900 (`#0F172A`) com textos em Branco Puro (`#FFFFFF`) ou Verde Neon (`#22C55E`), alcançando taxa de contraste $> 12:1$.

### 8.2 Acessibilidade para Daltônicos (Colorblind Safe)
Não confiar unicamente na cor para transmitir instrução:
- Cada dedo tem o **Número Explicito (1, 2, 3, 4)** desenhado com alto contraste dentro do círculo colorido.
- Cada corda tem a indicação textual de sua posição física: `(Corda mais grossa)` ou `(Corda mais fina)`.
- O status de afinação combina cor (Verde/Amarelo/Vermelho) com **Forma Geométrica** (Seta para a esquerda $\leftarrow$, Checkmark central $\checkmark$, Seta para a direita $\rightarrow$) e **Palavras Textuais em Caixa Alta** ("APERTE", "PERFEITO", "AFROUXE").

### 8.3 Cronômetro de Descanso Muscular (Anti-Cramp Reminder)
A cada 15 minutos ininterruptos de calibração ou treino na esteira, uma notificação flutuante e amigável surge suavemente no rodapé:
`"Dica do Professor: Seus dedos estão doendo? Faça uma pausa de 2 minutos para relaxar os tendões!"`

---

## 9. Plano de Homologação e Testes de Usabilidade

Para comprovar a eficácia deste redesenho visual, o ciclo de testes de aceitação deve medir:
1. **Métrica "Zero-Touch Time":** Medir o tempo total da calibração completa das 6 cordas. O usuário deve concluir o processo com **0 cliques** após o clique inicial no botão "Iniciar".
2. **Taxa de Erro de Sentido de Tarraxa:** Em testes com 5 iniciantes absolutos, menos de $5\%$ de tentativas de giro devem ser no sentido inverso ao indicado pela seta.
3. **Tempo de Reconhecimento do Primeiro Acorde:** Um iniciante deve conseguir posicionar os dedos do acorde `Em` e `Bm7_easy` em menos de $15\text{ segundos}$ ao olhar para o `<AnimatedFretboardGuide />`.
4. **Taxa de Abandono no Wait Mode:** Redução de mais de $70\%$ no abandono do exercício durante pausas do Wait Mode, graças às instruções textuais passo a passo.

---

## 10. Conclusão e Próximos Passos

Esta especificação resolve a principal barreira de entrada do EzViola: a conversão do iniciante absoluto em instrumentista confiante. Ao transformar fórmulas acústicas e notações cifradas herméticas em **guias mecânicos visuais intuitivos, acompanhados de automação total mãos livres**, o EzViola estabelece um novo padrão de excelência em UX musical na web.

**Ações Imediatas:**
1. Criação dos componentes `<GuitarHeadstockViewer />` e `<AnimatedFretboardGuide />`.
2. Refatoração do `GuitarCalibrationWizard` para o fluxo Hands-Free com contagem visual 1/3, 2/3, 3/3.
3. Atualização do `TunerGauge` com a indicação textual explícita e setas dinâmicas de rotação de tarraxa.
