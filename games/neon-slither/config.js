export const ARENA = {
  // A arena acompanha o teto de crescimento: com o raio antigo de 1800 uma
  // cobra grande enxergava quase o mapa inteiro e não sobrava para onde fugir.
  radius: 3600, food: 3400, maxFood: 8000, speed: 175, boost: 300,
  // O teto de massa era 120000 e a justificativa era que ninguém o alcançaria.
  // Alcançaram: numa partida real o jogador passou de cem mil e crescer parou.
  // Pior, o `Math.min` que aplica o teto puxava de volta quem estivesse acima.
  // O valor é medido. Com a CPU seis vezes mais lenta e a amostragem do corpo
  // ligada, o desenho custa 17,4 ms de mediana na massa 60000, 18,2 ms em
  // 250000 e 28,4 ms em 500000 (p95 de 42,2); a simulação vai de 1,08 ms a
  // 1,29 ms no mesmo intervalo. O topo é o degrau caro — 56% acima de 250000 —
  // e ele existe porque crescer não pode esbarrar em parede. Chegar lá leva
  // horas: o ritmo medido de um coletor atento é de uns 800 por minuto.
  startMass: 32, minMass: 26, maxMass: 500000, spacing: 6,
  // Luz reposta por ciclo de 0,25 s. Acompanha o tamanho da arena, senão uma
  // cobra grande limpa a região e o mapa demora a repor.
  refill: 40,
  // Luz comum vale mais de um ponto: o crescimento inicial precisa ser sentido
  // nos primeiros segundos, como no slither.io.
  foodValue: 1.8,
  // Acelerar custa uma fração da massa por segundo, com piso para as pequenas.
  boostDrain: .022, boostFloor: 3.4,
  // Alcance em que a luz é puxada para a cabeça. Comer vira um movimento
  // contínuo em vez de exigir passar por cima do ponto exato.
  magnet: 34,
  // Cercar não tem regra própria, e é de propósito. Uma versão deslocava o
  // corpo de quem cercava, como um laço; outra impedia a luz de nascer dentro
  // do cerco. A primeira não existe no slither.io, onde os corpos se atravessam
  // e só a cabeça mata. A segunda, medida, não muda nada: um cerco ocupa 0,03%
  // da arena, então a luz já demora vinte e dois segundos para nascer lá dentro
  // e o cercado já para de crescer sozinho. O empate de uma presa girando para
  // sempre no mesmo eixo é real na teoria e existe no slither.io também, mas
  // exige da presa uma perfeição que a IA daqui não tem: em oitenta minutos de
  // partida os quatro cercos observados duraram 1,5 s de mediana.
  // Peso que a IA dá a desviar de um corpo. É autopreservação, não caça: mexer
  // aqui muda quanto tempo um rival sobrevive sem mudar o quanto ele persegue.
  avoidWeight: 520,
  // Peso do corpo que uma cabeça alheia ainda vai deitar, relativo ao corpo que
  // já existe. Menor que 1 porque é previsão: a outra cobra pode virar.
  predictWeight: .85,
  // Quem nasce grande nasce fora da vista do jogador. A tela lógica do jogo tem
  // 600 de largura e, num celular em retrato, perto de 1400 de altura; 700 é a
  // metade do lado maior com folga. Dividido pelo zoom, vira o raio do mundo
  // que o jogador enxerga — no piso do zoom, 2500 unidades. Rival grande
  // aparecendo dentro disso é o "corpo enorme surgindo na minha frente".
  spawnView: 700,
  // Presa precisa valer pelo menos esta fração da massa de quem caça. No
  // online, cobra grande não perde tempo cercando recém-chegado: o ganho não
  // paga o risco. Sem isso, os gigantes que agora existem desde o começo
  // passariam a partida perseguindo o jogador de 32 de massa.
  preyFloor: .04,
  // Folga mínima entre quem nasce e quem já está na arena. Valia só para a
  // cabeça do recém-nascido; o corpo dele, criado depois esticado para trás,
  // não era conferido, e aparecia a 49 unidades do jogador com 1945 de
  // comprimento. Agora a folga vale para o corpo inteiro.
  clearPlayer: 520, clearRival: 340
};
// `glow` acende um halo neon próprio da skin, somado por cima do corpo. Está
// nas que pedem néon pela identidade e nas escuras, que ganham de quebra a
// visibilidade que lhes faltava contra o fundo da arena.
// bots: quantos rivais; reaction: intervalo entre decisões; foresight: alcance
// da leitura de perigo; aggression: chance de caçar quem já está em desvantagem;
// skill: precisão do rumo escolhido; mass: faixa de massa no nascimento.
// `population` é a pirâmide de tamanhos que a arena mantém, como a de um
// servidor online: quando você entra, o placar já tem gente grande. Cada faixa
// diz quantos rivais, no mínimo, ficam acima de `min`, e a contagem é
// cumulativa — dois gigantes também contam como acima de 5000. Quando falta
// alguém numa faixa, o próximo a renascer nasce nela, entre `min` e `max`.
// `refill` é o intervalo mínimo, em segundos, entre dois nascimentos na mesma
// faixa: quando o primeiro do placar morre, a vaga fica aberta um tempo, como
// num servidor de verdade. Sem isso, morria um gigante por minuto e outro
// nascia em cinco segundos — o corpo dele virava uma esteira de luz.
//
// As faixas são absolutas de propósito. Já houve duas regras relativas: uma
// ancorada no maior rival, que se realimentava até a mediana de nascimento ir
// de 81 a 3214 em 25 minutos; outra na mediana com teto de 900, que acabou com
// a inflação mas também com os grandes — 82% dos rivais morriam pequenos em
// 23 s e aos 15 minutos o maior mal passava de 20 mil. Número fixo não olha
// para o tamanho de ninguém, então não tem como se realimentar.
export const DIFFICULTIES = {
  easy: { name: 'Fácil', bots: 20, reaction: .30, foresight: 120, aggression: .05, skill: .55, mass: [24, 70],
    population: [{ min: 12000, max: 30000, count: 1, refill: 90 }, { min: 4000, max: 12000, count: 2, refill: 30 }, { min: 800, max: 4000, count: 5, refill: 0 }],
    note: 'Poucos grandes na arena e rivais distraídos, quase sempre atrás de alimento.' },
  normal: { name: 'Normal', bots: 28, reaction: .22, foresight: 155, aggression: .20, skill: .78, mass: [26, 120],
    population: [{ min: 15000, max: 45000, count: 2, refill: 90 }, { min: 5000, max: 15000, count: 3, refill: 30 }, { min: 1000, max: 5000, count: 6, refill: 0 }],
    note: 'Rivais disputam alimento e cortam caminho de quem está menor que eles.' },
  hard: { name: 'Difícil', bots: 32, reaction: .14, foresight: 195, aggression: .36, skill: 1, mass: [28, 170],
    population: [{ min: 18000, max: 60000, count: 3, refill: 90 }, { min: 6000, max: 18000, count: 4, refill: 30 }, { min: 1200, max: 6000, count: 7, refill: 0 }],
    note: 'Rivais antecipam curvas e aceleram para interceptar presas menores.' }
};
export const SKINS = [
  { id: 'aurora', name: 'Aurora', colors: ['#75ffd0', '#27bf9e'], pattern: 'ribbon', detail: '#d6fff0', note: 'Uma fita de luz verde.', goal: 0 },
  { id: 'plasma', name: 'Plasma', colors: ['#c887ff', '#733be0'], pattern: 'rings', detail: '#efd5ff', note: 'Anéis de energia violeta.', glow: .55, goal: 0 },
  { id: 'solar', name: 'Solar', colors: ['#ffc75a', '#ff8650'], pattern: 'chevron', detail: '#fff0ae', note: 'Raios dourados em movimento.', goal: 0 },
  { id: 'oceano', name: 'Oceano', colors: ['#54d4ff', '#3675d9'], pattern: 'wave', detail: '#c4f6ff', note: 'Ondas de azul profundo.', goal: 0 },
  { id: 'sintese', name: 'Síntese', colors: ['#ff82bc', '#b99dff', '#71e9e0'], pattern: 'confetti', detail: '#fff1fd', note: 'Confetes em tons de doce.', goal: 150 },
  { id: 'prisma', name: 'Prisma', colors: ['#ff7d88', '#ffd166', '#abeb77', '#67ddd8', '#8eaaff', '#d69aff'], pattern: 'ribbon', detail: '#ffffff', note: 'O espectro inteiro na arena.', goal: 400 },
  { id: 'polar', name: 'Polar', colors: ['#e9f6ff', '#81badb'], pattern: 'facets', detail: '#ffffff', note: 'Cristais talhados em gelo.', goal: 800 },
  { id: 'eclipse', name: 'Eclipse', colors: ['#5a477d', '#332848'], pattern: 'rings', detail: '#ffd77c', note: 'Anéis de ouro na escuridão.', glow: .7, goal: 1400 },
  { id: 'tigre', name: 'Tigre', colors: ['#ffb23f', '#f7812f'], pattern: 'tiger', detail: '#342235', note: 'Listras selvagens em âmbar.', goal: 0 },
  { id: 'koi', name: 'Koi', colors: ['#fff5e8', '#e8dbd1'], pattern: 'spots', detail: '#f45859', note: 'Manchas vermelhas sobre pérola.', goal: 0 },
  { id: 'circuito', name: 'Circuito', colors: ['#163e45', '#102b35'], pattern: 'circuit', detail: '#60ffe2', note: 'Trilhas elétricas e visor neon.', glow: .85, goal: 0 },
  { id: 'pixel', name: 'Pixel', colors: ['#8060f2', '#5543be'], pattern: 'pixels', detail: '#9eff65', note: 'Blocos verdes. Alma de arcade.', glow: .6, goal: 0 },
  // Magma e Singularidade tiveram o corpo clareado: mediam 2,32 e 2,53 de
  // contraste contra o fundo da arena, abaixo dos 3,0 que a WCAG pede para
  // objeto gráfico. Era defeito antigo, achado ao medir as skins novas.
  { id: 'magma', name: 'Magma', colors: ['#9f543b', '#35232b'], pattern: 'cracks', detail: '#ff9958', note: 'Fendas acesas como lava.', glow: .75, goal: 250 },
  { id: 'draco', name: 'Draco', colors: ['#4fb589', '#24604e'], pattern: 'scales', detail: '#d4ef8a', note: 'Escamas de jade e ouro.', goal: 600 },
  { id: 'galaxia', name: 'Galáxia', colors: ['#7545b4', '#353262'], pattern: 'stars', detail: '#aff1ff', note: 'Uma constelação para guiar.', glow: .6, goal: 1100 },
  { id: 'imperial', name: 'Imperial', colors: ['#efd078', '#bd8844'], pattern: 'diamonds', detail: '#433048', note: 'Diamantes sobre ouro polido.', goal: 2000 },
  // Lendárias. As metas são ancoradas no que uma partida rende de fato: a
  // mediana termina perto de 6000 e uma partida boa dobra isso; daí para cima
  // é sessão longa. Antes a última skin saía aos 2000, e o resto da partida
  // ficava sem nada para perseguir.
  { id: 'brasa', name: 'Brasa', colors: ['#ff7a3d', '#7a1f12'], pattern: 'cracks', detail: '#ffd48a',
    note: 'Rocha viva, rachada por dentro.', glow: .8, goal: 6000, legend: true },
  { id: 'boreal', name: 'Boreal', colors: ['#7bffce', '#3d8fd6', '#b58cff'], pattern: 'wave', detail: '#e8fff6',
    note: 'A aurora presa no corpo.', glow: .7, goal: 12000, legend: true },
  { id: 'ouroboros', name: 'Ouroboros', colors: ['#f2c65a', '#2b2119'], pattern: 'scales', detail: '#fff0b8',
    note: 'A serpente que come a própria cauda.', goal: 25000, legend: true },
  { id: 'singularidade', name: 'Singularidade', colors: ['#7c46de', '#141126'], pattern: 'rings', detail: '#c9a6ff',
    note: 'Luz curvando no horizonte.', glow: .9, goal: 50000, legend: true },
  // Lendárias do fim da escala. As metas saem do ritmo medido: um coletor
  // atento que não caça ninguém faz uns 800 de massa por minuto depois dos
  // primeiros minutos, e chegou a 32000 em quarenta. Quem caça faz várias
  // vezes isso. O espaçamento aqui é menor que o das anteriores — elas dobram a
  // cada degrau, estas sobem 1,75x e 1,57x — porque dobrar a partir de 50000
  // levaria a 400000 e viraria parede em vez de alvo. Estas não reaproveitam estampa nenhuma: cada
  // uma estreia um mecanismo que a coleção não tinha. `stripes` corre ao longo
  // do corpo, da cabeça à cauda, enquanto toda estampa antiga atravessa a cobra
  // ou divide o comprimento em faixas. `glass` deixa a arena aparecer através
  // do corpo. `pulse` faz o brilho respirar, a única coisa aqui que muda
  // sozinha com o tempo.
  { id: 'quimera', name: 'Quimera', colors: ['#2a566c', '#1d3b4e'], detail: '#5ef2ff', glow: .8,
    stripes: [[-.52, '#ff5d9e', .2], [0, '#5ef2ff', .15], [.52, '#ffcf5d', .2]],
    note: 'Três faixas correndo da cabeça à cauda.', goal: 80000, legend: true },
  { id: 'miragem', name: 'Miragem', colors: ['#9fe8ff', '#5aa8d8'], pattern: 'favo', detail: '#eafcff',
    glass: .42, glow: .5, note: 'Corpo de vidro: a arena aparece através dela.', goal: 140000, legend: true },
  { id: 'pulsar', name: 'Pulsar', colors: ['#3d1b63', '#1a0e33'], pattern: 'runas', detail: '#a8f0ff',
    glow: .95, pulse: .55, note: 'O feixe respira sobre o vazio.', goal: 220000, legend: true }
];
export const NAMES = ['Órbita', 'Cometa', 'Íon', 'Vórtice', 'Quasar', 'Nébula', 'Pulso', 'Fóton', 'Vega', 'Nova', 'Cosmo', 'Prisma', 'Lúmen', 'Eclipse'];
export const skinFor = id => SKINS.find(s => s.id === id) || SKINS[0];
const validNumber = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.min(n, 1e9) : 0;
export function cleanProfile(raw = {}) {
  raw = raw && typeof raw === 'object' ? raw : {};
  const best = validNumber(raw.best);
  return { best, games: Math.floor(validNumber(raw.games)), kills: Math.floor(validNumber(raw.kills)), time: validNumber(raw.time),
    difficulty: Object.hasOwn(DIFFICULTIES, raw.difficulty) ? raw.difficulty : 'normal',
    skin: SKINS.find(s => s.id === raw.skin && s.goal <= best)?.id || 'aurora',
    control: raw.control === 'direct' ? 'direct' : 'joystick', fullscreen: raw.fullscreen !== false };
}
