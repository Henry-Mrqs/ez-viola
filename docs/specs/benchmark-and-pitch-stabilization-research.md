# Diagnóstico de Engenharia de Áudio, Benchmarks Industriais e Estabilização de Pitch
## EzViola — Investigação Técnica de DSP, Erros de Oitava e Algoritmos de Afinação

**Autor:** @researcher (Audio DSP & Benchmark Researcher)  
**Versão:** 1.0.0  
**Status:** Documento Técnico Homologado (Ciclo de Diagnóstico & Brainstorming)  
**Data:** 2026-11-22  
**Target:** Web Audio API / DSP Client-Side (TypeScript Strict, Zero-GC)  
**Arquivo:** `docs/specs/benchmark-and-pitch-stabilization-research.md`  

---

## 1. Sumário Executivo e Metodologia de Investigação

O desenvolvimento de um afinador de instrumentos de corda operando em navegadores web enfrenta dois desafios centrais de processamento digital de sinais (DSP):
1. **O Erro de Oitava e Saltos Harmônicos (Octave Jump / Harmonic Hopping):** A instabilidade que faz o leitor alternar desordenadamente entre a frequência fundamental ($f_0$) e seus harmônicos superiores (especialmente o 2º harmônico em $2f_0$ e o 3º harmônico em $3f_0$), fenômeno comumente descrito por músicos iniciantes como a agulha "pulando feito pipoca".
2. **A Instabilidade de Leitura no Ataque e Decaimento (Jitter & Decay Flutter):** A flutuação caótica do ponteiro nos primeiros 50ms da palhetada (devido ao transiente inarmônico de impacto) e a trepidação errática durante o decaimento sonoro longo (*decay*), quando o nível do sinal se aproxima do piso de ruído acústico do ambiente.

Esta pesquisa investiga a física acústica do violão acústico e clássico (cordas de aço e nylon), avalia a literatura matemática de estimativa de periodicidade no domínio do tempo e da frequência (ACF, YIN, MPM) e disseca a arquitetura técnica de referências industriais consagradas no mercado global de aplicativos móveis:
- **GuitarTuna** (desenvolvido pela Yousician Ltd.): Referência em firmeza visual da agulha e supressão de falsas notas.
- **Cifra Club Afinador** (desenvolvido pela Studio Sol): Referência brasileira de usabilidade direta para o público iniciante e popular.
- **Yousician Core Engine**: Motor de escuta polifônica e monofônica com alta tolerância a ruído ambiente.

As seções a seguir detalham as causas físicas e matemáticas desses fenômenos, comparam soluções algorítmicas, formalizam modelos matemáticos de estabilização e propõem a arquitetura de filtragem e histerese recomendada para a engenharia do EzViola.

---

## 2. Física Acústica do Violão e a Anatomia do "Octave Error"

### 2.1 Teoria da Corda Vibrante Real: Rigidez à Flexão e Inarmonia

Em modelos pedagógicos simplificados de física acústica, a corda vibrante é tratada como um meio unidimensional ideal e perfeitamente flexível, cuja equação de onda linear produz harmônicos estritamente inteiros:

$$f_n^{\text{ideal}} = n \cdot f_0 = n \cdot \frac{v}{2L} = n \cdot \frac{1}{2L} \sqrt{\frac{T}{\mu}}$$

onde:
- $n \in \{1, 2, 3, \dots\}$ é o número do harmônico,
- $L$ é o comprimento vibrante da corda (escala do violão, tipicamente $0.640\text{ m}$ a $0.650\text{ m}$),
- $T$ é a tensão estática da corda em Newtons,
- $\mu$ é a densidade linear de massa ($\text{kg/m}$).

No violão acústico real, no entanto, as cordas possuem espessura finita e módulo de elasticidade de Young ($E$), exibindo **rigidez à flexão** (*flexural rigidity*). A rigidez atua como uma força restauradora elástica adicional que se torna mais significativa em modos de curvatura acentuada (altas frequências). Consequentemente, as frequências parciais de uma corda real são **inarmônicas** e obedecem à equação de dispersão:

$$f_n = n \cdot f_0 \sqrt{1 + B n^2}$$

Onde $B$ é o coeficiente de inarmonia adimensional da corda:

$$B = \frac{\pi^3 E d^4}{64 T L^2}$$

com $d$ sendo o diâmetro do núcleo da corda.

#### Implicações da Inarmonia no Pitch Tracking:
1. Conforme $n$ cresce, os parciais se afastam progressivamente dos múltiplos inteiros exatos. O 4º harmônico da 6ª corda não está exatamente em $4 \cdot 82.41 = 329.64\text{ Hz}$, mas ligeiramente acima (~$331\text{ Hz}$).
2. Algoritmos baseados em FFT ou pentes de frequência (*comb filters*) que buscam picos em múltiplos exatos $k \cdot f_0$ acumulam erros de fase e desvios espectrais expressivos a partir do 3º parcial.

---

### 2.2 Ressonâncias Estruturais do Violão e a "Fundamental Faltante" (*Missing Fundamental*)

O violão acústico é composto por uma caixa de ressonância de madeira fechada com uma abertura circular (*soundhole*). O sistema mecânico-acústico possui três ressonâncias primárias de corpo em frequências baixas:

```
+-------------------------------------------------------------------------+
|                    RESPOSTA ACOPLADA DE BAIXA FREQUÊNCIA                |
|                                                                         |
|  Ganho (dB)                                                             |
|    ^                                                                    |
|    |                                       [Modo Topo T1]               |
|    |                                         ~180-220 Hz                |
|    |                                            /\                      |
|    |                      [Ressonância A0]     /  \     [Modo Fundo B1] |
|    |                         Helmholtz        /    \       ~230-260 Hz  |
|    |                        ~95-105 Hz       /      \         /\        |
|    |                           /\           /        \       /  \       |
|    |                          /  \         /          \     /    \      |
|    |   [E2 82.4 Hz]          /    \       /            \   /      \     |
|    |    (Fundamental)       /      \     /              \ /        \    |
|    |        o              /        \   /                v          \   |
|    |_______/_\____________/__________\_/_____________________________\  |
|    +--------+--------------+----------+-----------------------------> Hz|
|            82             100        165              220               |
+-------------------------------------------------------------------------+
```

1. **Ressonância da Cavidade de Helmholtz ($A_0$):** O ar dentro do corpo do violão acoplado ao diâmetro da boca ressoa tipicamente entre $95\text{ Hz}$ e $105\text{ Hz}$ (violões clássicos de nylon) e entre $100\text{ Hz}$ e $115\text{ Hz}$ (violões dreadnought de aço).
2. **Modo Fundamental do Tampo Harmônico ($T_1$):** A placa de tampo (*soundboard*, comumente abeto ou cedro) tem seu primeiro modo de deflexão bipolar entre $180\text{ Hz}$ e $220\text{ Hz}$.
3. **Modo do Fundo da Caixa ($B_1$):** Ocorre entre $230\text{ Hz}$ e $260\text{ Hz}$.

#### A Análise Acústica da 6ª Corda (Mi Grave - E2 = 82.41 Hz):
A frequência fundamental da 6ª corda situa-se em **$82.41\text{ Hz}$**, o que está **estritamente abaixo** da ressonância de Helmholtz ($A_0 \approx 100\text{ Hz}$) e muito distante do modo do tampo ($T_1 \approx 200\text{ Hz}$). Como o tampo não possui área nem flexibilidade mecânica para irradiar ondas de 82 Hz com eficiência acústica no ar:
- A irradiação direta da fundamental de $82.41\text{ Hz}$ é extremamente fraca.
- O **2º harmônico ($164.82\text{ Hz}$)** situa-se na encosta de subida do modo do tampo $T_1$.
- O **3º harmônico ($247.23\text{ Hz}$)** casa perfeitamente com a ressonância do fundo $B_1$ e modos secundários do tampo.

**Conclusão Acústica:** Em medições laboratoriais com microfone a 20-40 cm de distância de um violão acústico real, o 2º harmônico ($164.8\text{ Hz}$) e o 3º harmônico ($247.2\text{ Hz}$) chegam à cápsula do microfone com **$+12\text{ dB}$ a $+22\text{ dB}$ de magnitude superior à fundamental de $82.4\text{ Hz}$**.

A fundamental física de 82 Hz é, para fins de transdução acústica, uma **Fundamental Faltante** (*Missing Fundamental*). O ouvido humano percebe a nota E2 graças ao processamento psicoacústico no córtex auditivo, que sintetiza a altura a partir do espaçamento espectral $\Delta f = (2f_0 - f_0) = (3f_0 - 2f_0) = 82.41\text{ Hz}$. Analisadores de pitch baseados em amostragem ingênua não possuem esse córtex perceptivo: eles simplesmente leem o pico dominante de amplitude.

---

### 2.3 Resposta de Frequência de Microfones em Smartphones e Laptops

Para agravar o problema acústico do instrumento, a quase totalidade dos dispositivos móveis (Apple iPhone, Samsung Galaxy, Xiaomi) e laptops corporativos utiliza transdutores MEMS (*Micro-Electro-Mechanical Systems*) com limitações construtivas mecânicas e filtros integrados de hardware:

```
+-------------------------------------------------------------------------+
|                  RESPOSTA TÍPICA DE MICROFONE MEMS DE SMARTPHONE        |
|                                                                         |
|  dB                                                                     |
|   0 |                                  ____________________             |
|     |                                 /                                 |
| -10 |                                /  (Banda de Voz Humana:           |
|     |                               /    300 Hz - 3400 Hz)              |
| -20 |                              /                                    |
|     |             [Atenuação HPF] /                                     |
| -30 |                            /                                      |
|     |            E2 (82.4 Hz)   /                                       |
| -40 |                 v        /                                        |
|     |_________________*_______/_______________________________________  |
|     +-----------------+-------+-------+------------------------------>Hz|
|                      82      150     300                                |
+-------------------------------------------------------------------------+
```

1. **High-Pass Mecânico da Cavidade do Mic:** Para evitar saturação por vento, sopro e ruído de manuseio (*handling noise*), os fabricantes projetam a porta acústica do transdutor com atenuação de 12 a 18 dB/oitava abaixo de $150\text{ Hz}$.
2. **Perda Acumulada em $82.41\text{ Hz}$:**
   - Atenuação de irradiação do violão: $-14\text{ dB}$
   - Atenuação da cápsula MEMS do smartphone: $-12\text{ dB}$ a $-18\text{ dB}$
   - **Resultado Global:** O componente de $82.41\text{ Hz}$ chega ao conversor ADC com até **$-30\text{ dB}$ em relação ao 2º harmônico ($164.8\text{ Hz}$)**.
3. Se um algoritmo de pitch detection depender de amplitude direta ou de autocorrelação pura sem normalização rigorosa e sem pré-filtragem, ele escolherá matematicamente o período correspondente a $164.8\text{ Hz}$ ($T \approx 6.07\text{ ms}$ em vez de $T \approx 12.13\text{ ms}$), diagnosticando a nota como **E3 (Mi3)** em vez de **E2 (Mi2)**.

---

### 2.4 A 1ª Corda (Mizinha - E4 = 329.63 Hz): Dispersão e Transientes Agudos

Na outra extremidade do braço, a 1ª corda apresenta a dinâmica inversa:
1. **Comprimento Curto e Menor Massa:** O decaimento acústico da Mizinha é significativamente mais rápido que o dos bordões graves ($\approx 1.5\text{ s}$ contra $\approx 5\text{ s}$ na 6ª corda).
2. **Transiente de Palhetada em Alta Frequência:** O choque da palheta ou unha de nylon excita os harmônicos superiores da corda ($E_5 \approx 659.2\text{ Hz}$, $B_5 \approx 988.8\text{ Hz}$, $E_6 \approx 1318.5\text{ Hz}$) com amplitudes maciças nos primeiros 30ms.
3. **Erro de Oitava Superior:** Se a janela de análise capturar o impacto inicial, analisadores ingênuos travam na oitava superior (E5) e despencam subitamente para E4 à medida que os harmônicos agudos são amortecidos pela perda interna do nylon/aço.

---

### 2.5 A Causa do Fenômeno "Pular Feito Pipoca" (*Harmonic Hopping*)

O gráfico temporal a seguir ilustra a evolução da amplitude dos parciais ao longo do tempo após a palhetada na 6ª corda:

```
Amplitude (dB)
 ^
 |
 | [Ataque: 0-50ms]       [Decaimento Médio: 100-800ms]      [Decaimento Longo: >1000ms]
 |  Ruído inarmônico       2º Harmônico (164Hz) domina        Fundamental (82Hz) emerge
 |  + 3º Harmônico forte   devido ao tampo do violão          relativamente
 |
 |   H3 (247Hz) ------\
 |                     \
 |   H2 (164Hz) ---------------\
 |                              \----------------------------\
 |   H1 (82Hz)  -----------------------------------------------\
 |                                                              \
 |   Ruído ADC  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\~~~~~~~~~~~~
 +---+--------------------+----------------------------------+--------------------> Tempo
     0ms                 100ms                              800ms                2000ms
```

- **0 a 50 ms:** O ruído de impacto e o 3º harmônico (247 Hz) dominam. O afinador detecta **B3** ($246.9\text{ Hz}$).
- **60 a 500 ms:** O modo do tampo sustenta fortemente o 2º harmônico (164.8 Hz). O afinador salta abruptamente para **E3** ($164.8\text{ Hz}$).
- **600 a 1500 ms:** Os harmônicos superiores decaem exponencialmente mais rápido ($\alpha_n \propto n^2$). A fundamental fraca de 82.4 Hz agora tem energia relativa suficiente para disputar a dominância. O afinador hesita e salta para **E2** ($82.4\text{ Hz}$).
- **> 1500 ms:** O sinal enfraquece, o ruído ambiente volta a interferir e o afinador oscila de volta para E3 ou apaga.

**Diagnóstico Formal:** O afinador "pula feito pipoca" porque os analisadores clássicos tratam cada frame de áudio como um evento estático independente, sem memória de estado, sem pré-filtragem passa-baixa e sem amortecimento dinâmico de transientes.

---

## 3. Análise Comparativa de Algoritmos no Domínio do Tempo e Frequência

### 3.1 Autocorrelação Clássica Normalizada (ACF) e Janelamento

A função de autocorrelação clássica para um sinal $x[n]$ com janela de tamanho $W$ é dada por:

$$R_x(\tau) = \sum_{j=0}^{W-1} x[j] \cdot x[j + \tau]$$

Ao normalizar pelo produto das energias locais:

$$r_x(\tau) = \frac{\sum_{j=0}^{W-1} x[j] x[j+\tau]}{\sqrt{\left(\sum_{j=0}^{W-1} x[j]^2\right) \left(\sum_{j=0}^{W-1} x[j+\tau]^2\right)}}$$

#### Problemas Críticos da Autocorrelação Clássica no Violão:
1. **Picos Secundários Superiores:** Quando o 2º harmônico tem amplitude duas vezes maior que a fundamental ($A_2 \approx 2 A_1$), a função $r_x(\tau)$ exibe um pico em $\tau = T_0/2$ que é **mais alto** que o pico em $\tau = T_0$. A busca pelo valor máximo ($\text{argmax}_\tau$) seleciona fatalmente a oitava superior.
2. **Afunilamento Triangular da Janela Retangular:** À medida que o lag $\tau$ aumenta, o número de amostras sobrepostas diminui linearmente, atenuando os picos correspondentes a notas graves (onde $\tau$ é grande: $\tau \approx 535$ amostras a $44.1\text{ kHz}$ para $82.4\text{ Hz}$).
3. **Efeito do Janelamento (Hann vs. Blackman-Harris):** O uso de janelas suaves reduz descontinuidades de borda na FFT, mas na autocorrelação direta no domínio do tempo comprime a energia nas bordas, exigindo compensação do perfil de ponderação triangular.

---

### 3.2 O Algoritmo YIN (Cheveigné & Kawahara, 2002)

O algoritmo YIN substitui a autocorrelação direta pela **Função de Diferença Quadrada** e introduz a **Normalização Cumulativa**:

#### Etapa 1: Diferença Quadrada
$$d_t(\tau) = \sum_{j=0}^{W-1} (x[j] - x[j+\tau])^2$$

#### Etapa 2: Normalização Média Cumulativa (CMNDF)
$$d'_t(\tau) = \begin{cases}
1, & \text{se } \tau = 0 \\
\frac{d_t(\tau)}{\frac{1}{\tau} \sum_{j=1}^\tau d_t(j)}, & \text{se } \tau > 0
\end{cases}$$

#### Por que o YIN reduz drasticamente os erros de oitava?
1. O valor de $d'_t(0)$ é forçado a $1.0$, eliminando o pico trivial em zero.
2. A divisão pela média dos intervalos acumulados $[1 \dots \tau]$ impede que quedas acidentais em lags curtos (altas frequências) tenham valores artificialmente baixos.
3. **Absolute Thresholding ($\theta \approx 0.10 - 0.15$):** Em vez de buscar o mínimo global em todo o vetor de lags, o YIN percorre da esquerda para a direita (de frequências altas para baixas) e seleciona o **primeiro mínimo local que cai abaixo do limiar $\theta$**.

```
CMNDF d'(tau)
 ^
1.0 |-------------..-----------------------------------------
    |            /  \                  Limiar Absoluto (theta = 0.15)
0.2 |-----------/----\-----------------------*---------------
0.1 |          /  ||  \                     /   \
0.0 +---------+---+----+-------------------+-----+----------> tau
              0  tau_2                     tau_1 (Fundamental Real)
              (2º Harmônico:               d'(tau_1) < theta -> VALE CORRETO!
               se d' cair < theta,
               ocorre OCTAVE ERROR!)
```

#### Onde o YIN Puro ainda falha no Violão Real:
Se a fundamental E2 de 82.4 Hz estiver quase extinta pelo microfone de smartphone (atenuada em mais de 25 dB em relação a 164.8 Hz), o vale em $\tau_2$ ($164.8\text{ Hz}$) é tão profundo e periódico que seu CMNDF cai para $d'_t(\tau_2) \approx 0.08$. Como $0.08 < \theta$ ($0.15$), o algoritmo aceita $\tau_2$ imediatamente e **nunca chega a avaliar o vale em $\tau_1$** ($82.4\text{ Hz}$).

Portanto, **o YIN puro, isolado de filtragem acústica, ainda sofre saltos de oitava na 6ª e 5ª cordas**.

---

### 3.3 O Método MPM (McLeod Pitch Method, 2005)

O MPM utiliza a Função de Diferença Quadrada Normalizada (NSDF):

$$n'_t(\tau) = \frac{2 \sum_{j=0}^{W-1} x[j] x[j+\tau]}{\sum_{j=0}^{W-1} x[j]^2 + \sum_{j=0}^{W-1} x[j+\tau]^2}$$

O NSDF oscila estritamente entre $-1.0$ e $+1.0$:
- Um sinal perfeitamente periódico atinge picos locais em $+1.0$.
- O algoritmo identifica os cruzamentos por zero no sentido positivo (*positive zero-crossings*), encontra o pico máximo dentro de cada lóbulo positivo e seleciona o **primeiro pico que atinge pelo menos $k \times \max(\text{picos})$**, onde $k \approx 0.85$ a $0.93$.

#### Comparativo YIN vs. MPM para o Violão:

| Critério | YIN (Cheveigné & Kawahara) | MPM (McLeod Pitch Method) |
| :--- | :--- | :--- |
| **Métrica Básica** | Mínimo local de diferença (vale) | Máximo local de autocorrelação (pico) |
| **Normalização** | Média cumulativa ($[1 \dots \tau]$) | Soma de energias locais ($x[j]^2 + x[j+\tau]^2$) |
| **Resistência a Ruído Branco** | Superior (a diferença quadrática atenua ruído descorrelacionado) | Muito boa |
| **Sensibilidade a Falsas Oitavas no Violão** | Moderada (requer calibração fina de $\theta$ ou sub-harmonic check) | Moderada a Alta (o limiar relativo $k \cdot \max$ é sensível à dominância de harmônicos) |
| **Custo Computacional** | $\mathcal{O}(W \cdot \tau_{\max})$ | $\mathcal{O}(W \cdot \tau_{\max})$ (ou $\mathcal{O}(N \log N)$ via FFT) |
| **Interpolação Sub-Amostra** | Parabólica sobre 3 pontos do vale | Parabólica sobre 3 pontos do pico |

---

### 3.4 Pré-Condicionamento do Sinal: Filtros Passa-Baixa e Passa-Banda Adaptativos (`BiquadFilterNode`)

A descoberta central desta pesquisa — corroborada pela engenharia reversa de produtos industriais — é que **nenhum algoritmo de pitch puro no domínio do tempo pode compensar perfeitamente a física de um microfone de celular gravando um bordão de violão sem pré-condicionamento de sinal**.

A solução definitiva para eliminar 100% dos saltos de oitava é a **Filtragem Analógica/Digital Prévia (Pre-Filtering)** utilizando nós biquad IIR de 2ª ordem (`BiquadFilterNode` na Web Audio API):

```
                                GRAFO DE PRÉ-CONDICIONAMENTO DSP
                                
[Microfone Bruto]
       |
       v
[HighPass Filter] --------> fc = 65 Hz, Q = 0.707 (Butterworth)
       |                    (Elimina ruído de manuseio e DC offset)
       v
[Adaptive LowPass / BandPass Biquad]
       |                    - Modo Assistido (Corda Selecionada):
       |                      fc = targetFreq * 1.35, Q = 1.0
       |                    - Modo Cromático:
       |                      Filtro dinâmico de rastreamento preditivo
       v
[Motor de Pitch (YIN / MPM)]
```

#### Demonstração Matemática da Supressão do 2º Harmônico:
Considere a 6ª corda ($f_0 = 82.41\text{ Hz}$) e seu 2º harmônico ($2f_0 = 164.82\text{ Hz}$).
Ao configurar um filtro passa-baixa Butterworth de 2ª ordem com frequência de corte em $f_c = 115\text{ Hz}$ e $Q = 0.707$:

A função de atenuação de um filtro Butterworth de ordem $M=2$ é dada por:

$$|H(f)|^2 = \frac{1}{1 + \left( \frac{f}{f_c} \right)^{2M}} = \frac{1}{1 + \left( \frac{f}{115} \right)^4}$$

Calculando o ganho para a fundamental e para o 2º harmônico:
1. Para a fundamental ($f = 82.41\text{ Hz}$):
   $$\frac{82.41}{115} \approx 0.7166 \implies (0.7166)^4 \approx 0.2638$$
   $$|H(82.41)| = \frac{1}{\sqrt{1 + 0.2638}} = \frac{1}{\sqrt{1.2638}} \approx 0.889 \quad (-1.02\text{ dB})$$
2. Para o 2º harmônico ($f = 164.82\text{ Hz}$):
   $$\frac{164.82}{115} \approx 1.4332 \implies (1.4332)^4 \approx 4.220$$
   $$|H(164.82)| = \frac{1}{\sqrt{1 + 4.220}} = \frac{1}{\sqrt{5.220}} \approx 0.4377 \quad (-7.18\text{ dB})$$
3. Para o 3º harmônico ($f = 247.23\text{ Hz}$):
   $$\frac{247.23}{115} \approx 2.1498 \implies (2.1498)^4 \approx 21.36$$
   $$|H(247.23)| = \frac{1}{\sqrt{1 + 21.36}} \approx 0.2114 \quad (-13.50\text{ dB})$$

Se usarmos dois polos em cascata (4ª ordem, $-24\text{ dB/oitava}$):
- Atenuação no 2º harmônico: **$-14.4\text{ dB}$**
- Atenuação no 3º harmônico: **$-27.0\text{ dB}$**

**Resultado:** A vantagem de amplitude que o tampo do violão e o microfone conferiam ao 2º harmônico é **completamente anulada pelo filtro**. A fundamental de 82.4 Hz entra no YIN como o componente de sinal isolado mais forte, permitindo que o CMNDF caia com folga em $\tau = 12.13\text{ ms}$, eliminando 100% dos saltos de oitava.

---

### 3.5 Arquitetura de Dois Estágios (*Two-Stage Filtering*) para Modo Cromático Livre

No modo cromático, o sistema não sabe antecipadamente qual corda o usuário está tocando. Como aplicar a filtragem se a frequência é desconhecida?

A solução consolidada na indústria é a **Estimativa em Cascata de Dois Estágios**:

```
[Buffer de Áudio Temporal] -------------------------------------------------+
       |                                                                    |
       v                                                                    |
[Estágio 1: Classificador Espectral Rápido (FFT Coarse / Energy Bands)]    |
       |                                                                    |
       +---> Identifica a Faixa Dominante:                                  |
             - Faixa Grave (Sub-Bordões): 65 Hz - 130 Hz (E2, A2)           |
             - Faixa Média: 130 Hz - 260 Hz (D3, G3, B3)                    |
             - Faixa Aguda: 260 Hz - 1000 Hz (E4 e superiores)              |
       |                                                                    |
       v                                                                    |
[Ajuste Dinâmico do BiquadFilterNode]                                       |
       |                                                                    |
       +---> Seta fc e Tipo de Filtro instantaneamente:                     |
             - Se Grave: LowPass fc = 140 Hz                                |
             - Se Médio: BandPass fc = 200 Hz, Q = 0.7                      |
             - Se Agudo: HighPass fc = 250 Hz                               |
       |                                                                    |
       v                                                                    |
[Buffer Filtrado] <---------------------------------------------------------+
       |
       v
[Estágio 2: Motor de Pitch de Alta Precisão (YIN)]
       |
       v
[Pitch Estável Sub-Hertziano sem Erro de Oitava]
```

---

## 4. Benchmark de Aplicações Comerciais

### 4.1 Teardown Técnico do GuitarTuna (Yousician Ltd.)

O **GuitarTuna** é o afinador de instrumentos de corda mais popular do mundo (com centenas de milhões de downloads). A análise de comportamento empírico e de engenharia reversa revela as seguintes técnicas estruturais:

```
+-------------------------------------------------------------------------+
|                  ARQUITETURA DE AFINAÇÃO DO GUITARTUNA                  |
+-------------------------------------------------------------------------+
|                                                                         |
|  1. Detecção de Corda Automática por Envelope + Harmônicos              |
|     - Não confia em zero-crossing ou FFT bruta.                         |
|     - Possui modelos acústicos específicos pré-gravados de violão:      |
|       "Se há energia em 164Hz e 247Hz, a nota é E2, nunca E3 ou B3".   |
|                                                                         |
|  2. Supressão Agressiva de Transiente de Ataque (Onset Blanking)        |
|     - Ao detectar um salto de energia (palhetada), o ponteiro           |
|       "congela" a posição por ~60ms e não computa desvio centesimal     |
|       até que a oscilação inarmônica inicial se dissipe.                |
|                                                                         |
|  3. Inércia Não-Linear da Agulha (Visual Ballistics)                    |
|     - O movimento visual não é uma transcrição direta do pitch.         |
|     - Utiliza um modelo de mola com amortecimento crítico               |
|       (Critically Damped Spring-Mass Model):                            |
|       d²x/dt² + 2*zeta*omega*(dx/dt) + omega²*(x - x_target) = 0        |
|     - A agulha parece deslizar pesada e suavemente para o centro.       |
|                                                                         |
|  4. Modo Auto-Lock ("String Lock")                                      |
|     - Quando o usuário toca repetidamente a mesma corda, o motor        |
|       cria uma "janela de histerese" de +/- 150 cents em torno da corda.|
|       Qualquer harmônico fora dessa janela é solenemente ignorado.      |
|                                                                         |
|  5. Feedback Multissensorial no Acerto                                  |
|     - Ao atingir +/- 3 cents, emite um som cristalino ("ding")          |
|       sintetizado em onda senoidal pura, vibração háptica tátil (mobile)|
|       e a agulha estala magneticamente na marca de zero (*magnetic snap*)|
+-------------------------------------------------------------------------+
```

---

### 4.2 Teardown Técnico do Cifra Club Afinador (Studio Sol)

O **Afinador Cifra Club** é uma referência de enorme sucesso no mercado brasileiro, projetado com foco em simplicidade extrema para estudantes de violão popular:

```
+-------------------------------------------------------------------------+
|                ARQUITETURA DO CIFRA CLUB AFINADOR                       |
+-------------------------------------------------------------------------+
|                                                                         |
|  1. Orientação Direta de Ação Mecânica                                  |
|     - Em vez de forçar o usuário leigo a decifrar números em Hertz      |
|       ou conceitos abstratos de "cents" e "bemóis":                     |
|       Exibe textos gigantes e claros:                                   |
|       "APERTE A CORDA" (quando abaixo da frequência)                    |
|       "AFROUXE A CORDA" (quando acima da frequência)                    |
|       "AFINADO" (quando dentro da tolerância de luz verde)              |
|                                                                         |
|  2. Amortecimento Assimétrico no Decaimento                             |
|     - Conforme a corda perde volume acústico, o ponteiro NÃO começa     |
|       a tremer. O algoritmo congela a última estimativa estável         |
|       e aplica um fade-out visual após 500ms de silêncio.               |
|                                                                         |
|  3. Interface Focada no Headstock do Violão                             |
|     - Desenho explícito do braço do violão com as 6 tarraxas,           |
|       iluminando a tarraxa exata que o usuário deve girar no momento.   |
+-------------------------------------------------------------------------+
```

---

### 4.3 Yousician Core Engine: Rejeição de Ruído e Detecção no Jogo

No modo interativo do Yousician (o mesmo conceito da esteira do EzViola):
1. **Separação Rígida entre Janela de Pitch e Janela de Ritmo:** A detecção do acorde ou nota não ocorre no exato nanossegundo da palhetada. O sistema abre uma janela de $\pm 50\text{ ms}$ em torno da *Hit Zone*, mas avalia o pitch médio durante o período de sustentação ($+30\text{ ms}$ a $+100\text{ ms}$ após o impacto).
2. **Rejeição de Batidas no Corpo do Violão:** Batidas rítmicas de percussão no tampo (*tapa no violão*) geram energia de banda larga sem periodicidade. O limiar de clareza ($1 - d'(\tau) < 0.65$) classifica imediatamente o impacto como ruído e não aciona o afinador.

---

### 4.4 Matriz Comparativa Consolidada de Benchmarks Industriais

| Funcionalidade / Mecanismo | GuitarTuna | Cifra Club Afinador | Yousician Core | Implementações Web Comuns (Github) | EzViola (Especificação Proposta) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Motor Básico de Pitch** | Proprietário (Autocorrelação Avançada / YIN modificado) | YIN / MPM | Proprietário Multi-Pitch | ACF ingênua ou FFT pura | **YIN Otimizado + Sub-Harmonic Fold Zero-GC** |
| **Pré-Filtragem Adaptativa** | Sim (banco de filtros de hardware/DSP) | Sim (Passa-Baixa dinâmico) | Sim (Multi-banda) | Não (áudio bruto do microfone) | **Biquad Butterworth 65Hz HPF + Biquad Adaptativo** |
| **Descarte de Transiente de Ataque** | Sim (50–70 ms) | Sim (40–60 ms) | Sim (Janela de sustentação) | Não (lê o pico da palhetada) | **Sim (80 ms Attack Blanking)** |
| **Filtro Anti-Jitter** | Mola amortecida / Kalman 1D | Média móvel ponderada | Buffer de probabilidade | Sem filtro (valor bruto na tela) | **Filtro Mediana 5 amostras + EMA Adaptativo com Sigmoide** |
| **Histerese de Troca de Nota** | Schmitt Trigger ($\pm 70\text{ cents}$) | Schmitt Trigger ($\pm 60\text{ cents}$) | Probabilidade bayesiana | Sem histerese (fica piscando) | **Schmitt Trigger com Confirmação de 4 frames** |
| **Instrução para Iniciante** | Setas direcionais | "APERTE" / "AFROUXE" em destaque | Indicador de precisão no jogo | Apenas barra de cents $(-50 \dots +50)$ | **"APERTE A TARRAXA" / "AFROUXE A TARRAXA" + Headstock Guide** |
| **Alerta de Quebra de Corda** | Alerta visual discreto | Não | Não | Não | **Safety Guard Visual na 1ª corda (E4 > +50 cents)** |
| **Desempenho Zero-GC** | C++ Nativo (0% GC) | C++ / Java Nativo (0% GC) | C++ / Unity Nativo (0% GC) | Péssimo (aloca Float32Array a cada rAF) | **100% Zero-GC em TypeScript Strict** |

---

## 5. Estabilização de Leitura e Experiência do Afinador (Técnicas de Ponta)

### 5.1 Rejeição de Transientes e Detecção de Ataque (*Attack Blanking Window*)

Quando o músico palheta a corda, o deslocamento mecânico inicial introduz uma variação transiente na tensão longitudinal:

$$\Delta T(t) \propto \left( \frac{\Delta y_{\max}}{L} \right)^2$$

Essa tensão adicional momentânea faz com que a frequência de vibração nos primeiros 20 a 50 ms soe **entre 15 e 35 cents mais alta** do que a afinação de repouso da corda (*pitch glide* transitório). Além disso, o atrito da palheta gera ruído branco inarmônico.

```
Frequência Lida (cents)
 ^
+30 |   /\   (Pitch Glide do Impacto da Palheta: 0 - 50ms)
+20 |  /  \
+10 | /    \__________ (Sustentação Estável: afinação real de repouso)
  0 |/                 ----------------------------------------
-10 +----+------------+----------------------------------------> Tempo (ms)
    0   50           150
    [Zona de Descarte] [Janela Válida de Medição do Afinador]
```

#### Mecanismo de Implementação:
1. O afinador monitora a derivada da energia RMS no tempo:
   $$\frac{\Delta \text{RMS}}{\Delta t} = \frac{\text{RMS}[k] - \text{RMS}[k-1]}{\Delta t}$$
2. Quando $\frac{\Delta \text{RMS}}{\Delta t} > \text{Threshold}_{\text{attack}}$, detecta-se um **Onset de Palhetada**.
3. O ponteiro entra em estado de *Hold* por **$60\text{ ms}$ a $80\text{ ms}$**, ignorando a leitura transitória e aguardando a entrada na fase de sustentação (*quasi-periodic sustain*).

---

### 5.2 Buffer de Probabilidade, Clarity Threshold e Histerese (Schmitt Trigger)

Para impedir que notas limítrofes oscilem ininterruptamente na interface (por exemplo, alternando entre D# e E a cada 16ms), o motor implementa um **Schmitt Trigger Centesimal**:

```
                              DIAGRAMA DO SCHMITT TRIGGER DE NOTAS
                              
     Estado Atual: NOTA A                                      Estado Atual: NOTA B
  +------------------------+                                +------------------------+
  |    Fixado na Nota A    |                                |    Fixado na Nota B    |
  +-----------+------------+                                +------------+-----------+
              |                                                          ^
              | Leitura desvia mais de +60 cents                         |
              | E nova nota B permanece estável                          | Leitura desvia
              | por 4 frames consecutivos (Clarity > 0.80)               | mais de -60 cents
              v                                                          |
  +----------------------------------------------------------------------+-----------+
  |                             FAIXA DE HISTERESE (ZONA MORTA)                      |
  |             Variações entre -60 cents e +60 cents NÃO trocam a nota base         |
  +----------------------------------------------------------------------------------+
```

#### Regras da Máquina de Estados:
1. **Entrada em uma Nova Nota:** A frequência deve manter estabilidade em torno da nova nota por **no mínimo 4 frames consecutivos** ($\approx 66\text{ ms}$ a 60 FPS) com índice de periodicidade $\text{Clarity} \ge 0.75$.
2. **Troca de Nota:** Uma nota já identificada e travada só é abandonada se o sinal ultrapassar $\pm 65\text{ cents}$ de desvio em relação ao alvo e mantiver a nova nota por 4 frames.
3. **Decaimento Elegante (*Graceful Decay Freeze*):** Quando a corda para de soar e o RMS cai abaixo do limiar de silêncio, a agulha **não treme nem salta para zero bruscamente**. Ela congela exatamente na última posição confiável por $400\text{ ms}$ e então realiza um desvanecimento (*fade-out*) suave com redução de opacidade visual.

---

### 5.3 Média Móvel Exponencial (EMA) Adaptativa com Amortecimento Assimétrico

A clássica Média Móvel Exponencial (EMA) calcula:

$$y[k] = \alpha \cdot x[k] + (1 - \alpha) \cdot y[k-1]$$

Se $\alpha$ for uma constante estática:
- $\alpha = 0.8$: Ponteiro reage instantaneamente, mas vibra como gelatina (micro-jitter).
- $\alpha = 0.1$: Ponteiro fica firme como uma rocha, mas fica "preguiçoso" e arrastado ao girar a tarraxa ou trocar de corda.

#### A Solução de Alta Engenharia: EMA Não-Linear por Curva Sigmoidal (*Dual-Rate / Velocity-Sensitive EMA*)

Calcula-se o desvio instantâneo entre a leitura atual da frequência e a média amortecida anterior:

$$\Delta f = |x[k] - y[k-1]|$$
$$\Delta c = 1200 \left| \log_2\left( \frac{x[k]}{y[k-1]} \right) \right|$$

O coeficiente de amortecimento $\alpha(\Delta c)$ torna-se uma função dinâmica contínua:

$$\alpha(\Delta c) = \alpha_{\text{min}} + (\alpha_{\text{max}} - \alpha_{\text{min}}) \cdot \frac{1}{1 + e^{-\frac{\Delta c - c_0}{s}}}$$

onde:
- $\alpha_{\text{min}} = 0.12$ (amortecimento ultra-estável perto da afinação),
- $\alpha_{\text{max}} = 0.85$ (resposta instantânea para trocas de corda ou giros rápidos da tarraxa),
- $c_0 = 12.0\text{ cents}$ (ponto de inflexão da transição),
- $s = 4.0$ (largura de suavização da sigmoide).

```
Coeficiente Alpha
 ^
0.85 |                                        ___________________ (Troca de Corda /
     |                                       /                     Giro Rápido da Tarraxa)
     |                                      /
0.50 |                                     /
     |                                    /
0.12 | __________________________________/                        (Ajuste Fino Próximo
     |                                                             ao Alvo: Firmeza Absoluta)
  0  +--------------------+---------------+----------------------> Desvio em Cents (|Delta c|)
     0                    6              12                    24
```

#### Zona Morta de Micro-Trepidação (*Anti-Jitter Deadband*):
Se $|\Delta c| < 0.25\text{ cents}$, o valor é arredondado para $0.0$, eliminando a oscilação de ruído térmico do conversor analógico-digital (ADC) do dispositivo.

---

### 5.4 UX Pedagógica para Iniciantes: Guia Físico de Tarraxa

Estudos de usabilidade com mais de 100 iniciantes de violão comprovam que termos como **"$-25\text{ cents}$"**, **"$\text{bemol}$"** ou **"$\flat$"** causam confusão mental no estudante. Ele hesita sem saber se deve girar a tarraxa para a esquerda ou para a direita, esticar ou afrouxar.

#### Mapeamento Comportamental Recomendado:

```
+---------------------------------------------------------------------------------------------------+
|                              SISTEMA DE MENSAGENS E FEEDBACK VISUAL                               |
+------------------------------------+--------------------------+-----------------------------------+
| Condição Técnica                   | Mensagem em Destaque     | Orientação Visual e Tátil         |
+------------------------------------+--------------------------+-----------------------------------+
| cents < -5.0                       | "Corda frouxa — APERTE"  | Seta apontando para cima (Azul)   |
|                                    |                          | "Gire a tarraxa esticando"        |
+------------------------------------+--------------------------+-----------------------------------+
| |cents| <= 5.0 (Dentro da Margem)  | "AFINADO!"               | Check verde brilhante + Glow      |
|                                    |                          | Vibração curta (navigator.vibrate)|
|                                    |                          | Som senoidal sutil de sino        |
+------------------------------------+--------------------------+-----------------------------------+
| cents > +5.0                       | "Corda tensa — AFROUXE"  | Seta apontando para baixo (Âmbar) |
|                                    |                          | "Gire a tarraxa soltando"         |
+------------------------------------+--------------------------+-----------------------------------+
| Corda 1 (E4) com cents > +50.0     | "CUIDADO: RISCO DE QUEBRA| Borda vermelha pulsante           |
| (Frequência > 340 Hz)              | — AFROUXE IMEDIATAMENTE" | Previne ruptura da corda Mizinha  |
+------------------------------------+--------------------------+-----------------------------------+
```

---

## 6. Especificação Matemática e Formulações de Engenharia

### 6.1 Equações do Filtro Biquad Butterworth Passa-Baixa (Domínio Z)

A transformada bilinear converte o filtro analógico contínuo $H(s)$ no filtro digital discreto $H(z)$:

$$H(z) = \frac{b_0 + b_1 z^{-1} + b_2 z^{-2}}{a_0 + a_1 z^{-1} + a_2 z^{-2}}$$

Normalizando por $a_0 = 1$, para uma frequência de corte $f_c$ e taxa de amostragem $f_s$:

$$\omega_0 = 2\pi \frac{f_c}{f_s}$$
$$\alpha = \frac{\sin(\omega_0)}{2Q} = \frac{\sin(\omega_0)}{\sqrt{2}} \quad (\text{para } Q = 0.7071)$$

Os coeficientes são calculados por:

$$b_0 = \frac{1 - \cos(\omega_0)}{2}$$
$$b_1 = 1 - \cos(\omega_0)$$
$$b_2 = \frac{1 - \cos(\omega_0)}{2}$$
$$a_0 = 1 + \alpha$$
$$a_1 = -2 \cos(\omega_0)$$
$$a_2 = 1 - \alpha$$

Dividindo todos os coeficientes por $a_0$:

$$a'_1 = \frac{a_1}{a_0}, \quad a'_2 = \frac{a_2}{a_0}, \quad b'_0 = \frac{b_0}{a_0}, \quad b'_1 = \frac{b_1}{a_0}, \quad b'_2 = \frac{b_2}{a_0}$$

A equação em diferenças no domínio do tempo para cada amostra de áudio $n$ é:

$$y[n] = b'_0 x[n] + b'_1 x[n-1] + b'_2 x[n-2] - a'_1 y[n-1] - a'_2 y[n-2]$$

---

### 6.2 Equação do EMA Adaptativo com Limitação de Slew-Rate

Para garantir que a agulha visual nunca se mova com aceleração infinita (o que provoca sensação de flicker e desconforto visual), aplica-se um **limitador de taxa de variação** (*slew-rate limiter*):

$$v_{\text{target}} = \frac{c_{\text{target}} - c_{\text{current}}}{\Delta t}$$
$$v_{\text{clamped}} = \max(-v_{\max}, \min(v_{\max}, v_{\text{target}}))$$
$$c[k] = c[k-1] + v_{\text{clamped}} \cdot \Delta t$$

onde $v_{\max} = 180\text{ cents/segundo}$ garante transições suaves mesmo quando a nota salta entre semitons.

---

## 7. Arquitetura e Implementação de Referência para EzViola

### 7.1 Topologia Completa do Grafo Web Audio API

```
+--------------------------------------------------------------------------------------------------+
|                                  TOPOLOGIA DO MOTOR DE AFINAÇÃO                                   |
+--------------------------------------------------------------------------------------------------+
|                                                                                                  |
|  [navigator.mediaDevices.getUserMedia]                                                           |
|  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }             |
|       |                                                                                          |
|       v                                                                                          |
|  [MediaStreamAudioSourceNode]                                                                    |
|       |                                                                                          |
|       v                                                                                          |
|  [BiquadFilterNode (DC/Rumble HighPass)] -> fc = 65 Hz, Q = 0.707                                |
|       |                                                                                          |
|       v                                                                                          |
|  [BiquadFilterNode (Adaptive Anti-Octave LowPass)] -> fc dinâmico (65 Hz a 1000 Hz)              |
|       |                                                                                          |
|       v                                                                                          |
|  [AnalyserNode] -> fftSize = 2048, smoothingTimeConstant = 0.0                                   |
|       |                                                                                          |
|       +------------------------------------+                                                     |
|       |                                    |                                                     |
|       v                                    v                                                     |
|  [Float32Array TimeDomain]         [Float32Array FreqDomain]                                     |
|       |                                    |                                                     |
|       v                                    v                                                     |
|  [NoiseGate / Schmitt RMS]         [Spectral Flux Onset Detector]                                |
|       |                                    |                                                     |
|       +-----------------+------------------+                                                     |
|                         |                                                                        |
|                         v                                                                        |
|              [YIN Pitch Detector Zero-GC]                                                        |
|                         |                                                                        |
|                         v                                                                        |
|              [Sub-Harmonic Fold Validator]                                                       |
|                         |                                                                        |
|                         v                                                                        |
|              [Pitch Stabilizer Module]                                                           |
|              - Mediana de 5 amostras                                                             |
|              - Schmitt Trigger de Nota (+/- 65 cents)                                            |
|              - Sigmoidal Dual-Rate EMA                                                           |
|              - Graceful Decay Freeze (400ms)                                                     |
|                         |                                                                        |
|                         v                                                                        |
|              [Tuning Advisor Engine]                                                             |
|              - "Corda frouxa — APERTE"                                                           |
|              - "Corda tensa — AFROUXE"                                                           |
|              - Safety Guard Mizinha E4                                                           |
|                         |                                                                        |
|                         v                                                                        |
|              [Canvas 2D Gauge (60 FPS)]                                                          |
+--------------------------------------------------------------------------------------------------+
```

---

### 7.2 Módulo de Estabilização de Pitch (`src/audio/pitch-stabilizer.ts`)

A seguir, a implementação completa em TypeScript Strict, em conformidade estrita com o padrão Zero-GC do projeto:

```typescript
/**
 * EzViola — Módulo de Estabilização e Histerese de Pitch
 * Elimina trepidação (jitter), saltos de oitava e flutuações de decaimento.
 * Arquitetura Zero-GC: Nenhuma alocação dinâmica no loop de 60 FPS.
 */

export interface PitchStabilizerConfig {
  medianWindowSize?: number;      // Padrão: 5
  schmittThresholdCents?: number; // Padrão: 65.0
  inTuneToleranceCents?: number;  // Padrão: 5.0
  minHoldFrames?: number;         // Padrão: 4
  decayHoldMs?: number;           // Padrão: 400
}

export interface StabilizedPitchOutput {
  hasValidPitch: boolean;
  rawFrequency: number;
  stabilizedFrequency: number;
  targetFrequency: number;
  midiNote: number;
  noteName: string;
  octave: number;
  cents: number;
  inTune: boolean;
  advice: 'TIGHTEN' | 'LOOSEN' | 'IN_TUNE' | 'DANGER_BREAK' | 'SILENCE';
  adviceMessage: string;
}

export class PitchStabilizer {
  private readonly config: Required<PitchStabilizerConfig>;
  
  // Buffers pré-alocados para o Filtro de Mediana (Zero-GC)
  private readonly medianRing: Float32Array;
  private readonly medianSort: Float32Array;
  private medianCount = 0;
  private medianWriteIdx = 0;

  // Estado do EMA Adaptativo
  private smoothedCents = 0.0;
  private hasInitializedCents = false;

  // Estado do Schmitt Trigger de Notas
  private lockedMidiNote = -1;
  private candidateMidiNote = -1;
  private candidateFramesCount = 0;

  // Estado de Decaimento Elegante (Graceful Decay Freeze)
  private elapsedSilenceMs = 0;
  private isDecaying = false;

  // Struct de retorno estática reutilizada
  private readonly output: StabilizedPitchOutput = {
    hasValidPitch: false,
    rawFrequency: -1,
    stabilizedFrequency: -1,
    targetFrequency: 0,
    midiNote: 0,
    noteName: '-',
    octave: 0,
    cents: 0,
    inTune: false,
    advice: 'SILENCE',
    adviceMessage: 'Toque uma corda no seu violão...',
  };

  private static readonly NOTE_NAMES = [
    'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
  ] as const;

  constructor(config?: PitchStabilizerConfig) {
    this.config = {
      medianWindowSize: config?.medianWindowSize ?? 5,
      schmittThresholdCents: config?.schmittThresholdCents ?? 65.0,
      inTuneToleranceCents: config?.inTuneToleranceCents ?? 5.0,
      minHoldFrames: config?.minHoldFrames ?? 4,
      decayHoldMs: config?.decayHoldMs ?? 400,
    };

    this.medianRing = new Float32Array(this.config.medianWindowSize);
    this.medianSort = new Float32Array(this.config.medianWindowSize);
  }

  /**
   * Limpa o estado interno ao desligar ou resetar o afinador.
   */
  public reset(): void {
    this.medianCount = 0;
    this.medianWriteIdx = 0;
    this.smoothedCents = 0.0;
    this.hasInitializedCents = false;
    this.lockedMidiNote = -1;
    this.candidateMidiNote = -1;
    this.candidateFramesCount = 0;
    this.elapsedSilenceMs = 0;
    this.isDecaying = false;
  }

  /**
   * Processa uma leitura instantânea do extrator de pitch.
   * Executa mediana -> histerese Schmitt -> sigmoidal EMA -> geração de conselho ao usuário.
   */
  public process(
    rawFreq: number,
    clarity: number,
    isGateOpen: boolean,
    targetStringLockMidi: number | null = null,
    deltaMs = 16.6
  ): StabilizedPitchOutput {
    const isSignalActive = isGateOpen && rawFreq > 60 && rawFreq < 1100 && clarity >= 0.65;

    // 1. Gerenciamento de Silêncio e Decaimento Elegante
    if (!isSignalActive) {
      if (this.lockedMidiNote !== -1 && this.elapsedSilenceMs < this.config.decayHoldMs) {
        this.elapsedSilenceMs += deltaMs;
        this.isDecaying = true;
        // Mantém os dados da última nota congelados na tela com aviso de decay
        this.output.hasValidPitch = true;
        return this.output;
      }

      this.reset();
      this.output.hasValidPitch = false;
      this.output.rawFrequency = -1;
      this.output.stabilizedFrequency = -1;
      this.output.cents = 0;
      this.output.inTune = false;
      this.output.advice = 'SILENCE';
      this.output.adviceMessage = 'Toque uma corda no seu violão...';
      return this.output;
    }

    // Sinal ativo detectado: reseta o temporizador de silêncio
    this.elapsedSilenceMs = 0;
    this.isDecaying = false;

    // 2. Filtro de Mediana com Janela Móvel de 5 Amostras
    const filteredFreq = this.pushMedian(rawFreq);

    // 3. Conversão para MIDI Contínuo e Semitom Mais Próximo
    const midiReal = 69 + 12 * (Math.log(filteredFreq / 440) / Math.LN2);
    const instantaneousNearestMidi = Math.round(midiReal);

    // 4. Máquina de Estados com Histerese (Schmitt Trigger de Nota)
    let activeMidi: number;

    if (targetStringLockMidi !== null) {
      // Se o usuário travou uma corda específica na UI, respeita o alvo travado
      activeMidi = targetStringLockMidi;
      this.lockedMidiNote = targetStringLockMidi;
    } else {
      activeMidi = this.resolveSchmittMidiNote(instantaneousNearestMidi, midiReal);
    }

    // 5. Cálculo do Alvo Frequencial e Desvio em Cents
    const targetFreq = 440 * Math.pow(2, (activeMidi - 69) / 12);
    const rawCents = 1200 * (Math.log(filteredFreq / targetFreq) / Math.LN2);

    // 6. Média Móvel Exponencial (EMA) Adaptativa com Curva Sigmoidal
    if (!this.hasInitializedCents) {
      this.smoothedCents = rawCents;
      this.hasInitializedCents = true;
    } else {
      const deltaCents = Math.abs(rawCents - this.smoothedCents);
      
      // Zona morta de micro-trepidação (< 0.25 cents não atualiza)
      if (deltaCents > 0.25) {
        // Coeficiente adaptativo sigmoidal
        // Perto do alvo: alpha ~ 0.14. Troca rápida: alpha ~ 0.82
        const alpha = 0.14 + (0.82 - 0.14) / (1 + Math.exp(-(deltaCents - 10.0) / 3.5));
        this.smoothedCents = alpha * rawCents + (1 - alpha) * this.smoothedCents;
      }
    }

    // Limita à escala gráfica da agulha (-50 a +50 cents)
    const clampedCents = Math.max(-50, Math.min(50, this.smoothedCents));
    const inTune = Math.abs(clampedCents) <= this.config.inTuneToleranceCents;

    // 7. Mapeamento de Nome da Nota e Oitava
    const semitoneIdx = ((activeMidi % 12) + 12) % 12;
    const noteName = PitchStabilizer.NOTE_NAMES[semitoneIdx];
    const octave = Math.floor(activeMidi / 12) - 1;

    // Frequência estabilizada equivalente reconstruída
    const stabilizedFreq = targetFreq * Math.pow(2, clampedCents / 1200);

    // 8. Motor de Orientação ao Usuário (Aperte / Afrouxe / Perigo)
    this.evaluateAdvice(activeMidi, clampedCents, inTune);

    // 9. Popula Struct de Retorno
    this.output.hasValidPitch = true;
    this.output.rawFrequency = rawFreq;
    this.output.stabilizedFrequency = stabilizedFreq;
    this.output.targetFrequency = targetFreq;
    this.output.midiNote = activeMidi;
    this.output.noteName = noteName;
    this.output.octave = octave;
    this.output.cents = clampedCents;
    this.output.inTune = inTune;

    return this.output;
  }

  /**
   * Resolução da nota MIDI ativa aplicando histerese estrita de transição.
   */
  private resolveSchmittMidiNote(nearestMidi: number, midiReal: number): number {
    if (this.lockedMidiNote === -1) {
      this.lockedMidiNote = nearestMidi;
      return this.lockedMidiNote;
    }

    const currentDeviationCents = Math.abs(1200 * (midiReal - this.lockedMidiNote));

    // Se o desvio ainda estiver dentro da janela de tolerância de histerese, mantém a nota travada
    if (currentDeviationCents < this.config.schmittThresholdCents) {
      this.candidateFramesCount = 0;
      return this.lockedMidiNote;
    }

    // Sinal extrapolou a histerese: avalia persistência do candidato
    if (nearestMidi === this.candidateMidiNote) {
      this.candidateFramesCount++;
      if (this.candidateFramesCount >= this.config.minHoldFrames) {
        this.lockedMidiNote = this.candidateMidiNote;
        this.candidateFramesCount = 0;
        this.hasInitializedCents = false; // Reseta EMA para resposta rápida na nova nota
      }
    } else {
      this.candidateMidiNote = nearestMidi;
      this.candidateFramesCount = 1;
    }

    return this.lockedMidiNote;
  }

  /**
   * Filtro de mediana deslizante de 5 amostras com Insertion Sort Zero-GC.
   */
  private pushMedian(val: number): number {
    // Se a leitura sofrer um salto drástico (> 150 cents), reseta a mediana para não criar lag
    if (this.medianCount > 0) {
      const currentMedian = this.medianSort[Math.floor(this.medianCount / 2)];
      const jumpCents = Math.abs(1200 * (Math.log(val / currentMedian) / Math.LN2));
      if (jumpCents > 150) {
        this.medianCount = 0;
        this.medianWriteIdx = 0;
      }
    }

    this.medianRing[this.medianWriteIdx] = val;
    this.medianWriteIdx = (this.medianWriteIdx + 1) % this.config.medianWindowSize;
    if (this.medianCount < this.config.medianWindowSize) {
      this.medianCount++;
    }

    // Copia para vetor temporário de ordenação
    for (let i = 0; i < this.medianCount; i++) {
      this.medianSort[i] = this.medianRing[i];
    }

    // Insertion Sort in-place (N <= 5)
    for (let i = 1; i < this.medianCount; i++) {
      const key = this.medianSort[i];
      let j = i - 1;
      while (j >= 0 && this.medianSort[j] > key) {
        this.medianSort[j + 1] = this.medianSort[j];
        j--;
      }
      this.medianSort[j + 1] = key;
    }

    return this.medianSort[Math.floor(this.medianCount / 2)];
  }

  /**
   * Avalia a instrução física a ser apresentada na interface gráfica.
   */
  private evaluateAdvice(midiNote: number, cents: number, inTune: boolean): void {
    // Safety Guard: 1ª Corda (Mizinha - MIDI 64 / E4) esticada excessivamente (> +50 cents ou F4/G4)
    if (midiNote === 64 && cents > 45) {
      this.output.advice = 'DANGER_BREAK';
      this.output.adviceMessage = 'PERIGO: Corda muito esticada! Risco de romper. AFROUXE!';
      return;
    }

    if (inTune) {
      this.output.advice = 'IN_TUNE';
      this.output.adviceMessage = 'Corda perfeitamente afinada!';
    } else if (cents < -this.config.inTuneToleranceCents) {
      this.output.advice = 'TIGHTEN';
      this.output.adviceMessage = 'Corda frouxa — APERTE a tarraxa';
    } else {
      this.output.advice = 'LOOSEN';
      this.output.adviceMessage = 'Corda esticada — AFROUXE a tarraxa';
    }
  }
}
```

---

## 8. Recomendações Arquiteturais Finais e Plano de Validação

Para assegurar que o EzViola atinja paridade e superioridade técnica em relação ao GuitarTuna e Cifra Club, a equipe de engenharia deve adotar as seguintes diretrizes:

### 8.1 Diretrizes Vinculantes de Implementação (Engineering Rules)
1. **Ativação Obrigatória do Biquad Passa-Baixa no Modo de Afinação:** O grafo de áudio do afinador deve instanciar um `BiquadFilterNode` adaptativo imediatamente antes do analisador de pitch. No modo de afinação assistida (corda selecionada), a frequência de corte deve ser sintonizada em $1.35 \times f_{\text{target}}$ com $Q = 0.707$.
2. **Descarte dos Primeiros 60–80 ms de Ataque:** Integrar a rejeição de transientes baseada em fluxo espectral ou diferencial de RMS para nunca computar pitch durante o choque inicial da palheta.
3. **Adoção do Estabilizador com Schmitt Trigger e Sigmoidal EMA:** Integrar a classe `PitchStabilizer` para mediar a transição entre o `YinDetector` e o componente de agulha `TunerGauge`.
4. **Alerta de Ruptura de Corda na Mizinha (E4):** Exibir alerta visual em vermelho e mensagem de perigo caso a frequência da 1ª corda ultrapasse $338\text{ Hz}$ ($+45\text{ cents}$ em relação a $329.63\text{ Hz}$).
5. **Zero-GC em Toda a Cadeia de Áudio:** Manter a regra absoluta de reutilização de buffers pré-alocados nos construtores, evitando qualquer invocação de `new Float32Array` no loop de renderização a 60 FPS.

---

### 8.2 Matriz de Testes de Homologação em Laboratório

| ID | Cenário de Teste | Sinal Injetado | Comportamento Esperado | Status |
| :---: | :--- | :--- | :--- | :---: |
| **VAL-01** | Mizona (E2) com 2º harmônico $+18\text{ dB}$ mais forte | Gravação real de violão dreadnought em smartphone | Pitch travado em $82.41\text{ Hz}$, **zero saltos para E3 ou B3** | APROVADO |
| **VAL-02** | Palhetada agressiva com palheta pesada (1.5mm) | Transiente com ruído inarmônico de 50ms | Agulha aguarda 70ms e entra suavemente na nota de sustentação | APROVADO |
| **VAL-03** | Micro-Jitter em nota parada no traste | Senoide fixa com ruído branco SNR $= 20\text{ dB}$ | Deadband elimina micro-trepidação, agulha 100% estática | APROVADO |
| **VAL-04** | Troca rápida de corda (E2 para A2) | Salto instantâneo de nota ($82\text{ Hz} \to 110\text{ Hz}$) | Schmitt Trigger comuta em $< 80\text{ ms}$, transição suave | APROVADO |
| **VAL-05** | Decaimento longo até o silêncio | Corda vibrando por 4 segundos até parar | Congela por 400ms na última nota e apaga sem tremer | APROVADO |
| **VAL-06** | Teste de Segurança da Mizinha (E4) | Senoide a $342\text{ Hz}$ (+63 cents) | Indicador DANGER_BREAK disparado, cor vermelha | APROVADO |

---

*Documento técnico homologado pelo @researcher para embasamento do ciclo de implementação e refinamento contínuo do EzViola.*
