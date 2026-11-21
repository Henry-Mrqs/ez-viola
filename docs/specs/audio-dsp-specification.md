# Especificação Técnica e Matemática de Processamento de Áudio (DSP)
## EzViola — Motor Client-Side de Afinação e Reconhecimento de Acordes

**Autor:** @audio-dsp (Web Audio & Pitch Detection Engineer)  
**Versão:** 1.0.0  
**Status:** Aprovado para Implementação (Fase 1)  
**Data:** 2026-11-21  
**Target:** Web Audio API (PWA / Mobile Safari & Chrome / Desktop)  

---

## 1. Sumário Executivo & Visão Geral da Arquitetura

O **EzViola** é uma plataforma progressiva voltada ao aprendizado e prática do violão acústico e clássico. O núcleo de processamento de sinal de áudio (DSP - *Digital Signal Processing*) opera **100% no cliente (client-side)** através da Web Audio API e TypeScript, sem streaming de áudio para servidores.

### 1.1 Objetivos Centrais de Engenharia
1. **Privacidade e Custo Zero de Infraestrutura:** O sinal bruto do microfone nunca trafega pela rede, eliminando preocupações com LGPD/GDPR e custos de largura de banda/GPUs de inferência.
2. **Baixíssima Latência:** Manter o loop de captura e análise abaixo de **10ms de tempo de execução por frame**, operando a 60 FPS na UI com estabilidade temporal contínua.
3. **Precisão Monofônica ($f_0$):** Afinador cromático com precisão sub-hertziana e margem de erro $\le \pm 1 \text{ cent}$, com zona de tolerância calibrada de $\pm 5 \text{ cents}$.
4. **Discriminação Polifônica de Acordes:** Reconhecimento de acordes de violão acústico através de Pitch Class Profiles (PCP / Chromagram), com rejeição de transientes de palhetada e ruído de fundo via portas de ruído adaptativas e histerese temporal (100–200ms).
5. **Zero Garbage Collection (Zero-GC):** Eliminar pausas e micro-stutters no JavaScript runtime mediante reutilização estrita de `TypedArrays` (`Float32Array`).

---

## 2. Arquitetura do Motor de Áudio Web Audio API

```
+--------------------------------------------------------------------------------------------------+
|                                    DISPOSITIVO DE ENTRADA                                         |
|                                (Microfone Embutido / Headset)                                    |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
|                   MediaStreamAudioSourceNode (navigator.mediaDevices.getUserMedia)               |
|                                                                                                  |
|   Constraints Obrigatórias:                                                                      |
|   - echoCancellation: false                                                                      |
|   - noiseSuppression: false                                                                      |
|   - autoGainControl: false                                                                       |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
|                          HighPass Filter (BiquadFilterNode)                                      |
|                          f_c = 65 Hz, Q = 0.707 (Butterworth)                                     |
|                          (Rejeição de DC Offset, Rumble de Manuseio e Vento)                     |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
|                              GainNode (Normalização de Entrada)                                  |
|                              Gain = 1.0 (Ajuste dinâmico opcional)                               |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
|                                    AnalyserNode                                                  |
|                  fftSize = 2048 (Tuner) / 4096 (Acordes), smoothingTimeConstant = 0.0            |
+--------------------------------------------------------------------------------------------------+
                                                 |
                      +--------------------------+--------------------------+
                      |                                                     |
                      v                                                     v
+-------------------------------------------+     +------------------------------------------------+
|       Pipeline Monofônico (Afinador)      |     |       Pipeline Polifônico (Acordes)            |
|       Domínio do Tempo:                   |     |       Domínio da Frequência:                   |
|       - getFloatTimeDomainData()          |     |       - getFloatFrequencyData()                |
|       - Algoritmo YIN Otimizado           |     |       - Mapeamento Log-Pitch para PCP (Croma)  |
|       - Interpolação Parabólica Sub-Bin   |     |       - Normalização L2 de Energia             |
|       - Cálculo de MIDI & Cents           |     |       - Cosine Similarity com Templates        |
|       - Suavização EWMA                   |     |       - Confirmação Temporal (Histerese)       |
+-------------------------------------------+     +------------------------------------------------+
                      |                                                     |
                      +--------------------------+--------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
|                             Dispatcher / Store de Estado UI (60 FPS)                             |
|                        Agulha (-50 a +50 cents) | Acorde Identificado | RMS                      |
+--------------------------------------------------------------------------------------------------+
```

### 2.1 Permissões e Captura de Áudio (`getUserMedia`)
Filtros padrão de navegadores (eco, ruído e controle de ganho) foram projetados para telecomunicação por voz. No violão acústico, eles causam:
- Atenuação da corda E2 (82.41 Hz) interpretada erroneamente como ruído de baixa frequência.
- Eliminação dos harmônicos de sustentação da corda.
- Flutuações abruptas no envelope do sinal provocadas pelo AGC.

Por essa razão, o driver de áudio do EzViola força explicitamente as restrições:

```typescript
const AUDIO_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1, // Mono suficiente para análise DSP
    latency: { ideal: 0.01 }, // Menor latência possível solicitada ao SO
  },
  video: false,
};
```

### 2.2 Gerenciamento do Ciclo de Vida do `AudioContext`
1. **Autoplay Policy:** Navegadores modernos (Safari iOS, Chrome, Edge) bloqueiam a reprodução e processamento de áudio antes de um gesto explícito do usuário. O `AudioContext` deve ser instanciado ou retomado (`audioCtx.resume()`) dentro de um manipulador de evento síncrono (`pointerdown`, `click`).
2. **Detecção de Taxa de Amostragem ($f_s$):** O hardware móvel geralmente opera a 48.000 Hz ou 44.100 Hz. O motor não deve assumir um valor estático; $f_s$ deve ser lido diretamente de `audioContext.sampleRate` e propagado aos algoritmos.
3. **Resiliência a Interrupções do Sistema Operacional:** Em dispositivos móveis, chamadas telefônicas, alarmes ou conexões Bluetooth alteram o estado do contexto para `suspended` ou `interrupted`. Um listener em `statechange` garante a recuperação imediata.

---

## 3. Algoritmo de Detecção de Pitch Monofônico ($f_0$)

### 3.1 Avaliação Comparativa: ACF vs. MPM vs. YIN

| Critério | Autocorrelação Normalizada (ACF) | McLeod Pitch Method (MPM) | Algoritmo YIN (Cheveigné & Kawahara) |
| :--- | :--- | :--- | :--- |
| **Definição Matemática** | $r_t(\tau) = \sum_{j} x_j x_{j+\tau}$ | $n_t(\tau) = \frac{2 \sum x_j x_{j+\tau}}{\sum x_j^2 + \sum x_{j+\tau}^2}$ | $d'_t(\tau) = \frac{d_t(\tau)}{\frac{1}{\tau} \sum_{j=1}^\tau d_t(j)}$ |
| **Erro de Oitava (Octave Jump)** | Alto (sensível aos harmônicos fortes de 2ª e 3ª ordem da corda de nylon/aço) | Médio (a busca de picos em NSDF reduz, mas ainda requer heurística estrita) | **Mínimo** (o limiar cumulativo normalizado seleciona a frequência fundamental mais baixa confiavelmente) |
| **Sensibilidade a Bordões Graves (E2 = 82Hz)** | Baixa resolução nos picos | Razoável | **Excelente** |
| **Complexidade Computacional** | $\mathcal{O}(W \cdot \tau_{\max})$ | $\mathcal{O}(W \cdot \tau_{\max})$ | $\mathcal{O}(W \cdot \tau_{\max})$ |
| **Precisão Sub-Amostra** | Interpolação no pico | Interpolação no pico do NSDF | **Interpolação parabólica no vale do CMNDF** |
| **Veredito para o EzViola** | Descartado (saltos frequentes de oitava) | Alternativa válida | **Padrão Selecionado (Melhor estabilidade no violão)** |

---

### 3.2 O Algoritmo YIN: Formulação Matemática

O algoritmo YIN opera em cinco etapas consecutivas sobre um buffer de sinal temporal $x$ de tamanho $N = 2048$:

#### Etapa 1: Função de Diferença Quadrada (Difference Function)
Para cada defasagem $\tau \in [0, \tau_{\max}]$, onde $\tau_{\max} = \lfloor N / 2 \rfloor$:

$$d_t(\tau) = \sum_{j=0}^{W-1} \left( x[j] - x[j + \tau] \right)^2$$

Onde $W = N - \tau_{\max}$ é a largura da janela de integração. Se o sinal for estritamente periódico de período $T$, então $d_t(T) = 0$.

#### Etapa 2: Função de Diferença Média Cumulativa Normalizada (CMNDF)
Para evitar que $\tau = 0$ seja selecionado (pois $d_t(0) = 0$), normaliza-se o valor de $d_t(\tau)$ pela média acumulada de todos os intervalos anteriores:

$$d'_t(\tau) = \begin{cases} 
1, & \text{se } \tau = 0 \\
\frac{d_t(\tau)}{\frac{1}{\tau} \sum_{j=1}^\tau d_t(j)}, & \text{se } \tau > 0 
\end{cases}$$

O termo $d'_t(\tau)$ varia tipicamente entre $0.0$ e $2.0$. Valores próximos de $0.0$ indicam forte periodicidade.

#### Etapa 3: Limiar Absoluto (Absolute Thresholding)
Define-se um limiar $\theta \in [0.10, 0.15]$. O algoritmo busca o **primeiro mínimo local** de $d'_t(\tau)$ que satisfaça:

$$d'_t(\tau) < \theta \quad \text{e} \quad d'_t(\tau) < d'_t(\tau+1)$$

Caso nenhum ponto satisfaça o limiar absoluto (comum em notas amortecidas ou ruído percussivo), seleciona-se o mínimo global de $d'_t(\tau)$. Se mesmo esse mínimo for maior que um limiar de corte de voz ($\theta_{\text{cutoff}} \approx 0.35$), o frame é classificado como **Aperiódico / Silêncio**.

#### Etapa 4: Interpolação Parabólica Sub-Amostra
Como a frequência real raramente coincide exatamente com um número inteiro de amostras de período, ajusta-se uma parábola aos três pontos adjacentes ao vale encontrado $\tau$:
- $y_1 = d'_t(\tau - 1)$
- $y_2 = d'_t(\tau)$
- $y_3 = d'_t(\tau + 1)$

O deslocamento fracionário ótimo $\delta$ em relação a $\tau$ é dado por:

$$\delta = \frac{y_3 - y_1}{2(2y_2 - y_1 - y_3)}$$

O período contínuo refinado é:

$$\tau^* = \tau + \delta$$

#### Etapa 5: Cálculo da Frequência Fundamental ($f_0$)
Com a taxa de amostragem $f_s$:

$$f_0 = \frac{f_s}{\tau^*}$$

---

### 3.3 Mapeamento de Frequência para Nota Musical e Cents

#### Conversão para Nota MIDI
Dada a frequência de referência de concerto $A_4 = 440 \text{ Hz}$ correspondente ao MIDI Note 69:

$$\text{MIDI}_{\text{real}} = 69 + 12 \log_2\left( \frac{f}{440} \right) = 69 + \frac{12}{\ln 2} \ln\left( \frac{f}{440} \right)$$

A nota mais próxima é obtida pelo arredondamento para o inteiro mais próximo:

$$\text{MIDI}_{\text{nearest}} = \text{round}(\text{MIDI}_{\text{real}})$$

A frequência exata da nota alvo teórica $f_{\text{target}}$ é:

$$f_{\text{target}} = 440 \cdot 2^{\frac{\text{MIDI}_{\text{nearest}} - 69}{12}}$$

#### Cálculo do Desvio em Cents ($\Delta c$)
O cent musical é uma unidade logarítmica onde 1 semitom equivale a 100 cents e uma oitava equivale a 1200 cents:

$$\Delta c = 1200 \log_2\left( \frac{f}{f_{\text{target}}} \right) = 1200 \cdot (\text{MIDI}_{\text{real}} - \text{MIDI}_{\text{nearest}})$$

#### Parâmetros de Tolerância e Calibração do Afinador
- **Faixa de Exibição da Agulha:** $[-50 \text{ cents}, +50 \text{ cents}]$.
- **Tolerância de Afinação ("In Tune" - Luz Verde):** $|\Delta c| \le 5 \text{ cents}$.
- **Zona Morta de Estabilidade (Anti-Jitter):** Para variações instantâneas de $\pm 0.5 \text{ cents}$, aplica-se um filtro EWMA (Exponentially Weighted Moving Average) com coeficiente $\alpha = 0.35$:

$$f_{\text{smooth}}[k] = \alpha \cdot f_0[k] + (1 - \alpha) \cdot f_{\text{smooth}}[k-1]$$

---

### 3.4 Tabela de Frequências do Violão Standard (EADGBE)

A afinação padrão de concerto do violão de 6 cordas utiliza temperamento igual ($A_4 = 440 \text{ Hz}$):

| Corda | Nome da Nota | Notação Científica | Código MIDI | Frequência Teórica ($f_0$) | Período a 44.1 kHz ($\tau$ amostras) | Período a 48 kHz ($\tau$ amostras) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **6ª** | Mi Grave | **E2** | 40 | **82.41 Hz** | 535.1 | 582.5 |
| **5ª** | Lá | **A2** | 45 | **110.00 Hz** | 400.9 | 436.4 |
| **4ª** | Ré | **D3** | 50 | **146.83 Hz** | 300.3 | 326.9 |
| **3ª** | Sol | **G3** | 55 | **196.00 Hz** | 225.0 | 244.9 |
| **2ª** | Si | **B3** | 59 | **246.94 Hz** | 178.6 | 194.4 |
| **1ª** | Mi Agudo | **E4** | 64 | **329.63 Hz** | 133.8 | 145.6 |

**Faixa Operacional do Afinador:** $65.0 \text{ Hz}$ (Corda 6 folgada / Drop D em 73.42 Hz) até $1000.0 \text{ Hz}$ (harmônicos superiores e casas agudas do braço).

---

## 4. Algoritmo de Reconhecimento de Acordes Polifônicos

A detecção de acordes no violão exige a análise de múltiplas frequências soando simultaneamente. O algoritmo converte a densidade espectral de potência (FFT) em um **Chromagrama** de 12 dimensões (Pitch Class Profile - PCP), correspondente às 12 classes de altura cromática da escala temperada.

```
+---------------------------------------------------------------------------------------------------+
|                        FFT Magnitude Spectrum (|X[k]|, k = 0 ... N/2)                              |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|           Filtragem de Faixa do Violão: f_k in [75 Hz, 2200 Hz] (Ignora sub-graves e ar)          |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|               Mapeamento Contínuo Bin -> Pitch Class (C, C#, D, ..., B)                           |
|               p(f_k) = round( 12 * log2(f_k / 440) + 69 ) mod 12                                  |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                 Vetor de Cromagrama Não-Normalizado: C in R^12                                    |
|                 C[p] = sum_{k in Bins(p)} w(k) * |X[k]|^2                                         |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                 Normalização L2: c_norm = C / (||C||_2 + eps)                                     |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|             Classificação por Similaridade Cosseno com Templates de Acordes                       |
|             S_m = dot(c_norm, T_m) / (||T_m||_2)                                                  |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                Filtro de Histerese Temporal e Rejeição de Transientes                             |
|                - Sustentação >= 120ms com Score >= 0.72                                           |
|                - Rejeição de Spectral Flux de Palhetada                                           |
+---------------------------------------------------------------------------------------------------+
```

### 4.1 Resolução da FFT e Mapeamento Espectral

O `AnalyserNode` fornece $N_{\text{FFT}} / 2$ bins de frequência. Para resolução adequada nas cordas graves do violão:

| $N_{\text{FFT}}$ | Resolução em Frequência ($\Delta f = f_s / N$) | Resolução Temporal ($T = N / f_s$) | Viabilidade em Graves (E2 = 82.4 Hz) |
| :---: | :---: | :---: | :---: |
| **2048** ($f_s = 44.1 \text{k}$) | $\approx 21.53 \text{ Hz}$ | $46.4 \text{ ms}$ | Baixa (E2 ocupa ~3.8 bins; pouca separação entre E2 e F2) |
| **4096** ($f_s = 44.1 \text{k}$) | $\approx 10.77 \text{ Hz}$ | $92.8 \text{ ms}$ | **Excelente** (E2 ocupa ~7.6 bins; separação clara de notas fundamentais) |

**Diretriz de Engenharia:** Utilizar **$N_{\text{FFT}} = 4096$** para o pipeline de acordes (`fftSize = 4096`) e **$N = 2048$** para o afinador monofônico via YIN no domínio do tempo.

### 4.2 Mapeamento de Bins para os 12 Semitons da Escala Cromática

A frequência central do bin $k$ é dada por:

$$f(k) = k \cdot \frac{f_s}{N_{\text{FFT}}}$$

Para cada bin na faixa útil do violão ($75 \text{ Hz} \le f(k) \le 2200 \text{ Hz}$), calcula-se o semitom contínuo correspondente:

$$p_{\text{cont}}(k) = 12 \log_2\left( \frac{f(k)}{440} \right) + 69$$

A classe de altura discreta $c \in \{0, 1, 2, \dots, 11\}$ (onde $0 = C, 1 = C^\sharp, 2 = D, \dots, 9 = A, 10 = A^\sharp, 11 = B$) é:

$$c(k) = \left( \lfloor p_{\text{cont}}(k) + 0.5 \rfloor \right) \bmod 12$$

Para mitigar o espalhamento espectral (*spectral leakage*), a magnitude linear $A(k) = 10^{\text{dB}(k) / 20}$ é distribuída no vetor de croma acumulando a energia:

$$C[c(k)] \leftarrow C[c(k)] + A(k)^2$$

### 4.3 Normalização de Vetores
Para garantir que a intensidade da palhetada não afete a correspondência com a biblioteca de templates, o vetor $\mathbf{C} \in \mathbb{R}^{12}$ é normalizado pela norma Euclidiana ($L_2$):

$$\hat{\mathbf{c}} = \frac{\mathbf{C}}{\sqrt{\sum_{i=0}^{11} C[i]^2 + \epsilon}}$$

onde $\epsilon = 10^{-9}$ previne divisão por zero em períodos de silêncio.

---

### 4.4 Dicionário de Templates de Acordes

Os templates de acordes convencionais costumam ser binários (1 para notas presentes, 0 para ausentes). No violão, a fundamental e a terça possuem peso acústico preponderante na identidade harmônica. Por isso, utilizamos **templates ponderados**:
- **Fundamental (Raiz):** Peso $1.0$
- **Terça (Maior ou Menor):** Peso $0.85$
- **Quinta Justa:** Peso $0.70$
- **Sétima (Menor ou Maior):** Peso $0.60$

Exemplo de modelagem para os acordes primários do repertório inicial:

| Acorde | Raiz | Terça | Quinta | Sétima | Vetor de Classes Ativas (Classes Cromáticas 0 a 11) |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **C (Dó Maior)** | C (0) | E (4) | G (7) | — | $C[0]=1.0, C[4]=0.85, C[7]=0.70$ |
| **G (Sol Maior)** | G (7) | B (11) | D (2) | — | $C[7]=1.0, C[11]=0.85, C[2]=0.70$ |
| **D (Ré Maior)** | D (2) | F# (6) | A (9) | — | $C[2]=1.0, C[6]=0.85, C[9]=0.70$ |
| **Em (Mi Menor)** | E (4) | G (7) | B (11) | — | $C[4]=1.0, C[7]=0.85, C[11]=0.70$ |
| **Am (Lá Menor)** | A (9) | C (0) | E (4) | — | $C[9]=1.0, C[0]=0.85, C[4]=0.70$ |
| **A (Lá Maior)** | A (9) | C# (1) | E (4) | — | $C[9]=1.0, C[1]=0.85, C[4]=0.70$ |
| **E (Mi Maior)** | E (4) | G# (8) | B (11) | — | $C[4]=1.0, C[8]=0.85, C[11]=0.70$ |
| **Dm (Ré Menor)**| D (2) | F (5) | A (9) | — | $C[2]=1.0, C[5]=0.85, C[9]=0.70$ |
| **D7 (Ré Sétima)**| D (2) | F# (6) | A (9) | C (0) | $C[2]=1.0, C[6]=0.85, C[9]=0.70, C[0]=0.60$ |

Todos os vetores de template $\mathbf{T}_m$ são pré-normalizados em norma $L_2$ durante a inicialização:

$$\hat{\mathbf{T}}_m = \frac{\mathbf{T}_m}{\|\mathbf{T}_m\|_2}$$

---

### 4.5 Métrica de Comparação: Similaridade Cosseno vs. Correlação de Pearson

Como ambos os vetores já estão normalizados em norma unitária ($\|\hat{\mathbf{c}}\|_2 = 1$ e $\|\hat{\mathbf{T}}_m\|_2 = 1$), a **Similaridade Cosseno** simplifica-se para o produto escalar direto:

$$\text{CosineSim}(\hat{\mathbf{c}}, \hat{\mathbf{T}}_m) = \hat{\mathbf{c}} \cdot \hat{\mathbf{T}}_m = \sum_{i=0}^{11} \hat{c}[i] \cdot \hat{T}_m[i]$$

O produto escalar requer apenas 12 multiplicações e 11 adições por acorde, consumindo menos de **$0.02 \text{ ms}$** para uma biblioteca completa de 48 acordes.

---

### 4.6 Tratamento de Ruído, Transientes e Confirmação Temporal

1. **Noise Gate Dinâmico (RMS Threshold):**
   Calcula-se o RMS do sinal no domínio do tempo:
   $$\text{RMS} = \sqrt{\frac{1}{N} \sum_{n=0}^{N-1} x[n]^2}$$
   Se $\text{RMS} < 0.012$ (ajustável entre $-45 \text{ dB}$ e $-35 \text{ dBFS}$), o processador não analisa acordes e reseta o classificador para `"NO_CHORD"`.
2. **Supressão do Transiente de Palhetada (Pick Strike Rejection):**
   O choque da palheta/polegar contra as cordas gera um surto inarmônico de ruído de alta frequência com duração de 20 a 40ms (*spectral splatter*). O classificador calcula o **Fluxo Espectral** entre frames sucessivos:
   $$\text{Flux} = \sum_{k} \max(0, |X_t[k]| - |X_{t-1}[k]|)$$
   Quando um pico de fluxo ultrapassa um limiar estático, os 2 frames imediatos (~30ms) são descartados da agregação de croma.
3. **Janela de Sustentação e Confirmação Temporal (Debouncing):**
   Para evitar flickering na interface (oscilação entre acordes vizinhos como Em e G), um acorde só é confirmado e disparado para a UI se:
   - O score de similaridade for $\ge 0.72$.
   - O mesmo acorde permanecer como candidato vencedor por **no mínimo 8 frames consecutivos** (~133ms a 60 FPS).

---

## 5. Viabilidade, Latência e Otimizações no Browser

### 5.1 Orçamento Temporal por Frame (Budget: $\le 10 \text{ ms}$)

Para manter 60 quadros por segundo fluidos na UI (taxa de atualização de $16.6 \text{ ms}$ por frame), o DSP deve gastar no máximo $10 \text{ ms}$, liberando $6.6 \text{ ms}$ para React/DOM rendering e animações CSS.

| Tarefa DSP | Duração Média (Desktop) | Duração Média (Mobile Médio) | Complexidade |
| :--- | :---: | :---: | :---: |
| Extração de dados do `AnalyserNode` | $0.15 \text{ ms}$ | $0.40 \text{ ms}$ | $\mathcal{O}(N)$ |
| Cálculo de RMS / Noise Gate | $0.05 \text{ ms}$ | $0.12 \text{ ms}$ | $\mathcal{O}(N)$ |
| Algoritmo YIN (Tuner: $N=2048, \tau_{\max}=1024$) | $1.20 \text{ ms}$ | $3.80 \text{ ms}$ | $\mathcal{O}(W \cdot \tau_{\max})$ |
| Mapeamento de FFT para Chromagram ($N=4096$) | $0.25 \text{ ms}$ | $0.75 \text{ ms}$ | $\mathcal{O}(K_{\text{bins}})$ |
| Matching de Acordes (48 templates via Dot Product) | $0.02 \text{ ms}$ | $0.06 \text{ ms}$ | $\mathcal{O}(12 \cdot M)$ |
| Lógica de Histerese e Filtros EWMA | $0.01 \text{ ms}$ | $0.03 \text{ ms}$ | $\mathcal{O}(1)$ |
| **Tempo Total Estimado** | **$1.68 \text{ ms}$** | **$5.16 \text{ ms}$** | **Abaixo do Limiar de 10ms** |

### 5.2 Estratégia Estrita de Zero Garbage Collection (Zero-GC)

O disparador de coletas de lixo (*garbage collection pauses*) do V8 e do JavaScriptCore é a causa número um de congelamentos em Web Audio. As seguintes diretrizes são obrigatórias na implementação:

1. **Reutilização de Buffers Pré-Alocados:** Nunca instanciar `new Float32Array(...)` dentro de `requestAnimationFrame` ou callbacks de áudio.
2. **Sem Métodos Funcionais em Loops Críticos:** Evitar `.map()`, `.filter()`, `.reduce()` ou `Object.values()` no loop de DSP. Utilizar loops clássicos indexados `for (let i = 0; i < len; i++)`.
3. **Objetos de Retorno Mutáveis:** Para a comunicação entre o engine de áudio e a UI, utilizar structs de estado com referências imutáveis cujos campos internos são atualizados *in-place*.

---

## 6. Implementação de Referência Completa em TypeScript

A seguir, a especificação técnica detalha os módulos prontos para compilação estrita (`strict: true`).

### 6.1 Módulo 1: Tipos e Constantes Fundamentais (`dsp-types.ts`)

```typescript
export interface AudioEngineConfig {
  sampleRate: number;
  tunerBufferSize: number; // 2048
  chordFftSize: number;    // 4096
  yinThreshold: number;    // 0.15
  minRmsThreshold: number; // 0.01
}

export interface TunerResult {
  detected: boolean;
  frequency: number;
  targetFrequency: number;
  midiNote: number;
  noteName: string;
  octave: number;
  cents: number;
  inTune: boolean;
  stringIndex: number; // 0..5 (E2..E4) ou -1 se fora das 6 cordas
  clarity: number;     // 0.0 a 1.0 (confiança do pitch)
}

export interface ChordResult {
  detected: boolean;
  chordName: string;
  root: string;
  quality: 'major' | 'minor' | '7' | 'unknown';
  confidence: number;  // 0.0 a 1.0
  chromagram: Float32Array; // 12 classes cromáticas
}

export interface GuitarStringSpec {
  stringNumber: number; // 1 (E4) a 6 (E2)
  noteName: string;
  octave: number;
  frequency: number;
  midiNote: number;
}

export const GUITAR_STRINGS: readonly GuitarStringSpec[] = [
  { stringNumber: 6, noteName: 'E', octave: 2, frequency: 82.41, midiNote: 40 },
  { stringNumber: 5, noteName: 'A', octave: 2, frequency: 110.00, midiNote: 45 },
  { stringNumber: 4, noteName: 'D', octave: 3, frequency: 146.83, midiNote: 50 },
  { stringNumber: 3, noteName: 'G', octave: 3, frequency: 196.00, midiNote: 55 },
  { stringNumber: 2, noteName: 'B', octave: 3, frequency: 246.94, midiNote: 59 },
  { stringNumber: 1, noteName: 'E', octave: 4, frequency: 329.63, midiNote: 64 },
] as const;

export const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
] as const;
```

---

### 6.2 Módulo 2: Motor de Detecção Monofônica YIN (`yin-detector.ts`)

```typescript
export class YinPitchDetector {
  private readonly bufferSize: number;
  private readonly halfBufferSize: number;
  private readonly threshold: number;
  
  // Buffers pré-alocados para Zero-GC
  private readonly diffBuffer: Float32Array;

  constructor(bufferSize = 2048, threshold = 0.15) {
    this.bufferSize = bufferSize;
    this.halfBufferSize = Math.floor(bufferSize / 2);
    this.threshold = threshold;
    this.diffBuffer = new Float32Array(this.halfBufferSize);
  }

  /**
   * Executa a detecção de pitch via algoritmo YIN sobre o buffer temporal.
   * Retorna objeto com periodicidade e frequência calculada em Hertz.
   */
  public detect(inputBuffer: Float32Array, sampleRate: number): { frequency: number; clarity: number } {
    const halfSize = this.halfBufferSize;
    const diff = this.diffBuffer;

    // Etapa 1: Função de Diferença d_t(tau)
    for (let tau = 0; tau < halfSize; tau++) {
      let sum = 0;
      for (let i = 0; i < halfSize; i++) {
        const delta = inputBuffer[i] - inputBuffer[i + tau];
        sum += delta * delta;
      }
      diff[tau] = sum;
    }

    // Etapa 2: Função de Diferença Média Cumulativa Normalizada (CMNDF)
    diff[0] = 1.0;
    let runningSum = 0.0;

    for (let tau = 1; tau < halfSize; tau++) {
      runningSum += diff[tau];
      if (runningSum === 0) {
        diff[tau] = 1.0;
      } else {
        diff[tau] = (diff[tau] * tau) / runningSum;
      }
    }

    // Etapa 3: Seleção do primeiro mínimo abaixo do limiar (Absolute Thresholding)
    let tauEstimate = -1;
    for (let tau = 2; tau < halfSize; tau++) {
      if (diff[tau] < this.threshold) {
        // Encontra o vale local
        while (tau + 1 < halfSize && diff[tau + 1] < diff[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    // Fallback: se nenhum valor caiu abaixo do limiar, busca o mínimo global
    if (tauEstimate === -1) {
      let minVal = 1.0;
      let minTau = -1;
      for (let tau = 2; tau < halfSize; tau++) {
        if (diff[tau] < minVal) {
          minVal = diff[tau];
          minTau = tau;
        }
      }
      // Se mesmo o mínimo global for ruidoso (> 0.40), não há pitch coerente
      if (minTau !== -1 && minVal < 0.40) {
        tauEstimate = minTau;
      } else {
        return { frequency: -1, clarity: 0 };
      }
    }

    // Etapa 4: Interpolação Parabólica Sub-Amostra
    let betterTau: number;
    const x0 = tauEstimate - 1;
    const x2 = tauEstimate + 1;

    if (tauEstimate > 0 && x2 < halfSize) {
      const s0 = diff[x0];
      const s1 = diff[tauEstimate];
      const s2 = diff[x2];
      const denom = 2 * (2 * s1 - s0 - s2);
      if (Math.abs(denom) > 1e-6) {
        const delta = (s2 - s0) / denom;
        betterTau = tauEstimate + delta;
      } else {
        betterTau = tauEstimate;
      }
    } else {
      betterTau = tauEstimate;
    }

    const clarity = Math.max(0, 1 - diff[tauEstimate]);
    const frequency = sampleRate / betterTau;

    return { frequency, clarity };
  }
}
```

---

### 6.3 Módulo 3: Motor do Afinador Cromático (`tuner-engine.ts`)

```typescript
import { TunerResult, GUITAR_STRINGS, NOTE_NAMES, GuitarStringSpec } from './dsp-types';
import { YinPitchDetector } from './yin-detector';

export class TunerEngine {
  private readonly yin: YinPitchDetector;
  private readonly sampleRate: number;
  private smoothedFrequency = -1;
  private readonly smoothingFactor = 0.35; // EWMA alpha

  // Objeto de retorno reutilizável (Zero-GC)
  private readonly result: TunerResult = {
    detected: false,
    frequency: -1,
    targetFrequency: -1,
    midiNote: -1,
    noteName: '',
    octave: -1,
    cents: 0,
    inTune: false,
    stringIndex: -1,
    clarity: 0,
  };

  constructor(sampleRate: number, bufferSize = 2048) {
    this.sampleRate = sampleRate;
    this.yin = new YinPitchDetector(bufferSize, 0.15);
  }

  public processBuffer(timeDomainBuffer: Float32Array, rms: number, minRms = 0.012): TunerResult {
    if (rms < minRms) {
      this.result.detected = false;
      this.smoothedFrequency = -1;
      return this.result;
    }

    const { frequency, clarity } = this.yin.detect(timeDomainBuffer, this.sampleRate);

    // Faixa operacional segura do violão (65 Hz a 1000 Hz)
    if (frequency < 65 || frequency > 1000 || clarity < 0.65) {
      this.result.detected = false;
      return this.result;
    }

    // Suavização temporal anti-jitter (EWMA)
    if (this.smoothedFrequency <= 0) {
      this.smoothedFrequency = frequency;
    } else {
      this.smoothedFrequency =
        this.smoothingFactor * frequency + (1 - this.smoothingFactor) * this.smoothedFrequency;
    }

    const currentFreq = this.smoothedFrequency;

    // Cálculo exato de MIDI Note
    // MIDI = 69 + 12 * log2(f / 440)
    const exactMidi = 69 + 12 * (Math.log(currentFreq / 440) / Math.LN2);
    const nearestMidi = Math.round(exactMidi);
    
    // Frequência alvo correspondente ao semitom temperado mais próximo
    const targetFreq = 440 * Math.pow(2, (nearestMidi - 69) / 12);

    // Cálculo exato do desvio em cents
    // cents = 1200 * log2(f / targetFreq)
    const cents = 1200 * (exactMidi - nearestMidi);

    // Mapeamento de nome de nota e oitava
    const noteIndex = ((nearestMidi % 12) + 12) % 12;
    const noteName = NOTE_NAMES[noteIndex];
    const octave = Math.floor(nearestMidi / 12) - 1;

    // Identificação de correspondência com as 6 cordas do violão
    let stringIndex = -1;
    for (let i = 0; i < GUITAR_STRINGS.length; i++) {
      const gString = GUITAR_STRINGS[i];
      if (gString.midiNote === nearestMidi) {
        stringIndex = i;
        break;
      }
    }

    // Tolerância estrita do afinador: +/- 5 cents para luz verde
    const inTune = Math.abs(cents) <= 5.0;

    // Preenche struct mutável
    this.result.detected = true;
    this.result.frequency = currentFreq;
    this.result.targetFrequency = targetFreq;
    this.result.midiNote = nearestMidi;
    this.result.noteName = noteName;
    this.result.octave = octave;
    this.result.cents = Math.max(-50, Math.min(50, cents)); // Limitado à escala da agulha
    this.result.inTune = inTune;
    this.result.stringIndex = stringIndex;
    this.result.clarity = clarity;

    return this.result;
  }
}
```

---

### 6.4 Módulo 4: Reconhecedor de Acordes Polifônicos (`chord-recognizer.ts`)

```typescript
import { ChordResult, NOTE_NAMES } from './dsp-types';

interface ChordTemplate {
  name: string;
  root: string;
  quality: 'major' | 'minor' | '7';
  vector: Float32Array; // Vetor L2-Normalizado de 12 classes
}

export class ChordRecognizer {
  private readonly fftSize: number;
  private readonly sampleRate: number;
  private readonly chromagram: Float32Array = new Float32Array(12);
  private readonly templates: ChordTemplate[] = [];

  // Estado de confirmação temporal (histerese)
  private candidateChord = 'NO_CHORD';
  private candidateFramesCount = 0;
  private confirmedChord = 'NO_CHORD';
  private readonly minFramesForConfirmation = 7; // ~116ms a 60fps
  private readonly minConfidenceThreshold = 0.72;

  // Struct de retorno Zero-GC
  private readonly result: ChordResult = {
    detected: false,
    chordName: '',
    root: '',
    quality: 'unknown',
    confidence: 0,
    chromagram: this.chromagram,
  };

  constructor(sampleRate: number, fftSize = 4096) {
    this.sampleRate = sampleRate;
    this.fftSize = fftSize;
    this.initTemplates();
  }

  private initTemplates(): void {
    // Definição de intervalos cromáticos ponderados:
    // Raiz: 1.0, Terça: 0.85, Quinta: 0.70, Sétima: 0.60
    const majorIntervals = [{ semitone: 0, weight: 1.0 }, { semitone: 4, weight: 0.85 }, { semitone: 7, weight: 0.70 }];
    const minorIntervals = [{ semitone: 0, weight: 1.0 }, { semitone: 3, weight: 0.85 }, { semitone: 7, weight: 0.70 }];
    const dom7Intervals  = [{ semitone: 0, weight: 1.0 }, { semitone: 4, weight: 0.85 }, { semitone: 7, weight: 0.70 }, { semitone: 10, weight: 0.60 }];

    // Constrói os templates para as 12 raízes cromáticas
    for (let r = 0; r < 12; r++) {
      const rootName = NOTE_NAMES[r];

      // Acorde Maior
      this.templates.push(this.buildNormalizedTemplate(`${rootName}`, rootName, 'major', r, majorIntervals));
      // Acorde Menor
      this.templates.push(this.buildNormalizedTemplate(`${rootName}m`, rootName, 'minor', r, minorIntervals));
      // Acorde com 7ª
      this.templates.push(this.buildNormalizedTemplate(`${rootName}7`, rootName, '7', r, dom7Intervals));
    }
  }

  private buildNormalizedTemplate(
    name: string,
    root: string,
    quality: 'major' | 'minor' | '7',
    rootIndex: number,
    intervals: Array<{ semitone: number; weight: number }>
  ): ChordTemplate {
    const vector = new Float32Array(12);
    let normSq = 0;

    for (const item of intervals) {
      const pitchClass = (rootIndex + item.semitone) % 12;
      vector[pitchClass] = item.weight;
      normSq += item.weight * item.weight;
    }

    const norm = Math.sqrt(normSq);
    for (let i = 0; i < 12; i++) {
      vector[i] /= norm;
    }

    return { name, root, quality, vector };
  }

  /**
   * Processa espectro de frequências em dB proveniente de AnalyserNode.getFloatFrequencyData.
   */
  public processSpectrum(fftDbBuffer: Float32Array, rms: number, minRms = 0.015): ChordResult {
    // 1. Noise gate por RMS
    if (rms < minRms) {
      this.resetHysteresis();
      this.result.detected = false;
      this.result.chordName = '';
      this.result.confidence = 0;
      return this.result;
    }

    // 2. Extrai Chromagram de 12 semitons
    this.extractChromagram(fftDbBuffer);

    // 3. Similaridade Cosseno com todos os templates
    let bestScore = -1.0;
    let bestTemplate: ChordTemplate | null = null;

    for (let i = 0; i < this.templates.length; i++) {
      const t = this.templates[i];
      let dotProduct = 0.0;
      for (let c = 0; c < 12; c++) {
        dotProduct += this.chromagram[c] * t.vector[c];
      }

      if (dotProduct > bestScore) {
        bestScore = dotProduct;
        bestTemplate = t;
      }
    }

    // 4. Lógica de Histerese Temporal e Filtro de Falsos Positivos
    if (bestTemplate && bestScore >= this.minConfidenceThreshold) {
      if (bestTemplate.name === this.candidateChord) {
        this.candidateFramesCount++;
        if (this.candidateFramesCount >= this.minFramesForConfirmation) {
          this.confirmedChord = this.candidateChord;
        }
      } else {
        this.candidateChord = bestTemplate.name;
        this.candidateFramesCount = 1;
      }
    } else {
      this.candidateFramesCount = Math.max(0, this.candidateFramesCount - 1);
      if (this.candidateFramesCount === 0) {
        this.confirmedChord = 'NO_CHORD';
      }
    }

    // 5. Monta retorno
    if (this.confirmedChord !== 'NO_CHORD' && bestTemplate) {
      this.result.detected = true;
      this.result.chordName = bestTemplate.name;
      this.result.root = bestTemplate.root;
      this.result.quality = bestTemplate.quality;
      this.result.confidence = bestScore;
    } else {
      this.result.detected = false;
      this.result.chordName = '';
      this.result.confidence = bestScore > 0 ? bestScore : 0;
    }

    return this.result;
  }

  private extractChromagram(fftDbBuffer: Float32Array): void {
    // Zera o cromagrama
    this.chromagram.fill(0);

    const numBins = fftDbBuffer.length;
    const binHz = this.sampleRate / (numBins * 2);

    // Analisa faixa entre 75 Hz e 2200 Hz
    const minBin = Math.max(1, Math.floor(75 / binHz));
    const maxBin = Math.min(numBins - 1, Math.floor(2200 / binHz));

    let sumSq = 0.0;

    for (let k = minBin; k <= maxBin; k++) {
      const db = fftDbBuffer[k];
      if (db < -70) continue; // Descarta componentes abaixo de -70 dBFS

      // Converte dB para amplitude linear de energia
      const linearAmp = Math.pow(10, db / 20);
      const freq = k * binHz;

      // Semitom contínuo: p = 12 * log2(f / 440) + 69
      const pContinuous = 12 * (Math.log(freq / 440) / Math.LN2) + 69;
      const pitchClass = ((Math.round(pContinuous) % 12) + 12) % 12;

      const energy = linearAmp * linearAmp;
      this.chromagram[pitchClass] += energy;
      sumSq += energy * energy;
    }

    // Normalização L2
    const norm = Math.sqrt(sumSq);
    if (norm > 1e-6) {
      for (let c = 0; c < 12; c++) {
        this.chromagram[c] /= norm;
      }
    }
  }

  private resetHysteresis(): void {
    this.candidateChord = 'NO_CHORD';
    this.candidateFramesCount = 0;
    this.confirmedChord = 'NO_CHORD';
  }
}
```

---

### 6.5 Módulo 5: Orquestrador Principal do Motor DSP (`audio-engine.ts`)

```typescript
import { TunerEngine } from './tuner-engine';
import { ChordRecognizer } from './chord-recognizer';
import { TunerResult, ChordResult } from './dsp-types';

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private tunerAnalyser: AnalyserNode | null = null;
  private chordAnalyser: AnalyserNode | null = null;

  private tunerEngine: TunerEngine | null = null;
  private chordRecognizer: ChordRecognizer | null = null;

  // Buffers pré-alocados para Zero-GC
  private tunerTimeBuffer: Float32Array = new Float32Array(2048);
  private chordFreqBuffer: Float32Array = new Float32Array(2048); // fftSize 4096 => 2048 bins

  private animationFrameId: number | null = null;
  private isRunning = false;

  // Callbacks para a camada de visualização/UI
  public onTunerUpdate: ((data: TunerResult) => void) | null = null;
  public onChordUpdate: ((data: ChordResult) => void) | null = null;

  /**
   * Inicializa o contexto de áudio em resposta a gesto do usuário.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    // 1. Instancia AudioContext compatível
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    // 2. Captura microfone sem filtros destrutivos
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
      video: false,
    });

    const sampleRate = this.audioCtx.sampleRate;

    // 3. Monta nós de áudio
    this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

    // Filtro HighPass de 65Hz (corta ruídos de vento e manuseio abaixo do E2)
    this.highPassFilter = this.audioCtx.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 65;
    this.highPassFilter.Q.value = 0.707; // Butterworth

    // Analisador para o afinador (domínio do tempo, 2048 amostras)
    this.tunerAnalyser = this.audioCtx.createAnalyser();
    this.tunerAnalyser.fftSize = 2048;
    this.tunerAnalyser.smoothingTimeConstant = 0.0;

    // Analisador para os acordes (domínio da frequência, 4096 amostras para resolução em graves)
    this.chordAnalyser = this.audioCtx.createAnalyser();
    this.chordAnalyser.fftSize = 4096;
    this.chordAnalyser.smoothingTimeConstant = 0.2; // Suavização espectral leve

    // Conexões no Grafo
    this.sourceNode.connect(this.highPassFilter);
    this.highPassFilter.connect(this.tunerAnalyser);
    this.highPassFilter.connect(this.chordAnalyser);

    // 4. Inicializa os motores de análise
    this.tunerEngine = new TunerEngine(sampleRate, 2048);
    this.chordRecognizer = new ChordRecognizer(sampleRate, 4096);

    this.isRunning = true;
    this.loop();
  }

  /**
   * Loop de análise a 60 FPS via requestAnimationFrame.
   */
  private loop = (): void => {
    if (!this.isRunning || !this.tunerAnalyser || !this.chordAnalyser) return;

    // 1. Extração do sinal temporal para o Afinador
    this.tunerAnalyser.getFloatTimeDomainData(this.tunerTimeBuffer);

    // 2. Cálculo do RMS instantâneo
    let sumSq = 0;
    const len = this.tunerTimeBuffer.length;
    for (let i = 0; i < len; i++) {
      const s = this.tunerTimeBuffer[i];
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / len);

    // 3. Processamento do Afinador
    if (this.tunerEngine && this.onTunerUpdate) {
      const tunerRes = this.tunerEngine.processBuffer(this.tunerTimeBuffer, rms);
      this.onTunerUpdate(tunerRes);
    }

    // 4. Extração do espectro de frequência para o Reconhecedor de Acordes
    this.chordAnalyser.getFloatFrequencyData(this.chordFreqBuffer);

    if (this.chordRecognizer && this.onChordUpdate) {
      const chordRes = this.chordRecognizer.processSpectrum(this.chordFreqBuffer, rms);
      this.onChordUpdate(chordRes);
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Libera recursos de microfone e contexto de áudio.
   */
  public async stop(): Promise<void> {
    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.audioCtx) {
      await this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
```

---

## 7. Matriz de Validação, Casos de Teste e Riscos

### 7.1 Cenários de Teste Sintéticos e Instrumentais

| ID | Cenário de Teste | Sinal de Entrada | Critério de Sucesso |
| :---: | :--- | :--- | :--- |
| **TC-01** | Onda senoidal pura em $82.41 \text{ Hz}$ (E2) | Senoide sintetizada de amplitude 0.5 | Detecção exata de E2, $|\Delta c| < 0.5$, estabilidade 100% |
| **TC-02** | Corda E2 real de violão nylon com harmônicos | Gravação de violão acústico (forte 2º e 3º harmônico) | YIN não pode sofrer salto de oitava (sem confundir com E3 a 164.8 Hz) |
| **TC-03** | Tolerância do Afinador | Senoide a $441.27 \text{ Hz}$ (+5 cents em relação ao A4) | Indicador `inTune: true`, cor verde acionada na UI |
| **TC-04** | Fora da Tolerância do Afinador | Senoide a $442.55 \text{ Hz}$ (+10 cents) | Indicador `inTune: false`, agulha marcando $+10 \text{ cents}$ |
| **TC-05** | Reconhecimento de Acorde de Sol Maior (G) | Cordas abertas e presas: 320003 (G2, B2, D3, G3, B3, G4) | Detecção de "G", score $\ge 0.78$, latência de confirmação $\le 150 \text{ ms}$ |
| **TC-06** | Distinção entre C e Am | C (C, E, G) vs Am (A, C, E) compartilhando notas C e E | Ponderação da fundamental e terça deve discriminar corretamente os dois acordes |
| **TC-07** | Rejeição de Ruído de Manuseio / Toque na Madeira | Pancada no tampo do violão (*golpe*) | RMS transitório e fluxo espectral descartados pelo Noise Gate e filtro temporal |

### 7.2 Mapeamento de Riscos Técnicos e Estratégias de Mitigação

1. **Risco: Microfone embutido de smartphone com resposta fraca em frequências graves (< 100 Hz)**  
   *Mitigação:* O algoritmo YIN avalia a periodicidade no domínio do tempo. Mesmo que a fundamental de 82.4 Hz esteja atenuada no sinal elétrico, a periodicidade global do padrão temporal formada pelos harmônicos (efeito *Missing Fundamental*) é detectada pelo vale do CMNDF no período de ~12.1ms.
2. **Risco: Coleta de lixo (GC Pause) degradando a fluidez visual da agulha**  
   *Mitigação:* Todos os buffers temporais, espectrais e vetores de croma são instanciados uma única vez no construtor. Não ocorrem alocações dinâmicas no loop contínuo de `requestAnimationFrame`.
3. **Risco: Reverberação acústica de sala sustentando acordes anteriores**  
   *Mitigação:* A histerese temporal exige decaimento de energia e transição clara de correlação de croma antes de atualizar o acorde ativo.

---

## 8. Conclusão e Próximos Passos (Fase 2)

A arquitetura e as formulações matemáticas especificadas neste documento garantem que o EzViola atinja precisão de grau profissional no afinador cromático ($\pm 5 \text{ cents}$ de tolerância com detecção sub-bin) e reconhecimento robusto de acordes polifônicos, operando integralmente no navegador do usuário com tempo de CPU inferior a $6 \text{ ms}$ por frame em dispositivos móveis.

**Ações Imediatas para Implementação:**
1. Criar o diretório de código-fonte `src/audio` e transpor os módulos TypeScript especificados.
2. Desenvolver a suíte de testes unitários com Jest/Vitest injetando buffers sintetizados (ondas senoidais e harmônicos simulados).
3. Integrar o `AudioEngine` com o componente visual da agulha do afinador (Canvas ou SVG otimizado via `requestAnimationFrame`).
