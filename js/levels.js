// Os 3 mundos e as 12 fases da Capivara Atravessa. Sem navegador (os testes rodam no Node).
//
// A maquete tem 13 colunas (x de 0 a 12) e 13 fileiras (y): 0 é a calçada de saída (perto do
// jogador), 1 a 5 a estrada, 6 o canteiro do meio, 7 a 11 o rio e 12 a margem com as 5 tocas.
// Cada fileira da estrada e do rio é uma faixa: { t: tipo, v: velocidade (casas/s, + = para a
// direita), n: quantos, len: comprimento em casas }.
//   estrada: car (carro), moto, trator, truck (caminhão), rail (trilho do trem, chefe)
//   rio:     log (tora), turtle (tartarugas; dive = mergulham), jacare (o corpo segura, a cabeça morde)
// Extras por fase: heron (garça/tuiuiú pousa nas tocas), snake (cobra no canteiro), boss.
export const LEVELS_PER_WORLD = 4;

export const WORLDS = [
  { name: 'Fazenda', hint: 'Atravesse a estrada e o rio até as 5 tocas!', time: 30 },
  { name: 'Mangue', hint: 'Jacarés, tartarugas que mergulham e garças nas tocas!', time: 30 },
  { name: 'Pantanal à Noite', hint: 'Tudo mais rápido. Cuidado com o tuiuiú!', time: 28 },
];

const road = (a, b, c, d, e) => [a, b, c, d, e];
const C = (v, n = 3) => ({ t: 'car', v, n, len: 1 });
const M = (v, n = 2) => ({ t: 'moto', v, n, len: 1 });
const T = (v, n = 2) => ({ t: 'trator', v, n, len: 2 });
const K = (v, n = 2) => ({ t: 'truck', v, n, len: 3 });
const R = () => ({ t: 'rail', v: 0, n: 0, len: 0 });
const L = (v, n, len) => ({ t: 'log', v, n, len });
const U = (v, n, len, dive = false) => ({ t: 'turtle', v, n, len, dive });
const J = (v, n = 2) => ({ t: 'jacare', v, n, len: 3 });

export const LEVELS = [
  // ---- Fazenda ----
  { world: 0, name: 'Primeira travessia', road: road(C(-0.9), T(0.6), C(-1.2), M(1.6), K(-0.8)), river: [U(-0.9, 4, 3), L(0.8, 3, 4), L(1.2, 2, 6), U(-1.0, 4, 3), L(0.9, 3, 4)] },
  { world: 0, name: 'Dia de feira', road: road(C(-1.1), T(0.7, 3), C(-1.4), M(2.0), K(-1.0)), river: [U(-1.0, 4, 3), L(1.0, 3, 3), L(1.4, 2, 5), U(-1.1, 4, 2), L(1.0, 3, 4)] },
  { world: 0, name: 'Hora do rush', road: road(C(-1.3, 4), T(0.8, 3), C(-1.6, 4), M(2.3, 3), K(-1.2)), river: [U(-1.2, 4, 2), L(1.1, 3, 3), L(1.6, 3, 3), U(-1.3, 4, 2), L(1.2, 3, 3)] },
  { world: 0, name: 'Trem da Fazenda', road: road(C(-1.1), T(0.7, 3), R(), M(2.0), K(-1.0)), river: [U(-1.0, 4, 3), L(1.0, 3, 3), L(1.4, 2, 5), U(-1.1, 4, 2), L(1.0, 3, 4)], boss: 'train' },
  // ---- Mangue ----
  { world: 1, name: 'Água salobra', road: road(C(-1.2), M(1.9), T(0.8, 3), C(-1.5), K(1.0)), river: [U(-1.0, 4, 3, true), L(1.0, 3, 4), J(-1.0), U(1.1, 4, 3, true), L(-1.0, 3, 4)], heron: true },
  { world: 1, name: 'Cobra no canteiro', road: road(C(-1.3, 4), M(2.1), T(0.9, 3), C(-1.6), K(1.1)), river: [U(-1.1, 4, 3, true), J(1.0), L(1.3, 3, 3), U(1.2, 4, 2, true), L(-1.1, 3, 4)], heron: true, snake: 1.2 },
  { world: 1, name: 'Maré alta', road: road(C(-1.5, 4), M(2.4, 3), T(1.0, 3), C(-1.8, 4), K(1.2)), river: [U(-1.3, 4, 2, true), J(1.2), L(1.5, 3, 3), J(-1.2), L(1.3, 3, 3)], heron: true, snake: 1.4 },
  { world: 1, name: 'Sucuri', road: road(C(-1.2), M(1.9), T(0.8, 3), C(-1.5), K(1.0)), river: [L(-0.9, 3, 4), L(1.0, 3, 4), L(-1.1, 3, 4), L(1.0, 3, 4), L(-0.9, 3, 4)], boss: 'sucuri' },
  // ---- Pantanal à Noite ----
  { world: 2, name: 'Faróis', road: road(C(-1.6, 4), K(1.2), M(2.6, 3), C(-1.9, 4), T(1.0, 3)), river: [U(-1.3, 4, 3, true), L(1.4, 3, 3), J(-1.3), U(1.4, 4, 2, true), L(-1.2, 3, 4)], heron: true },
  { world: 2, name: 'Comitiva', road: road(K(-1.4, 3), C(1.9, 4), M(-2.8, 3), K(1.3, 3), C(-2.0, 4)), river: [J(1.3), U(-1.5, 4, 2, true), L(1.6, 3, 3), J(-1.4), L(1.4, 3, 3)], heron: true, snake: 1.5 },
  { world: 2, name: 'Corredeira', road: road(C(-1.8, 4), M(2.8, 3), K(-1.4, 3), C(2.0, 4), T(-1.1, 3)), river: [U(-1.6, 4, 2, true), L(1.9, 3, 3), J(-1.6), L(1.8, 3, 3), U(-1.5, 4, 2, true)], heron: true, snake: 1.6 },
  { world: 2, name: 'Tempestade', road: road(C(-1.6, 4), K(1.2), M(2.6, 3), C(-1.9, 4), T(1.0, 3)), river: [L(-1.1, 3, 4), L(1.2, 3, 4), L(-1.3, 3, 3), L(1.2, 3, 4), L(-1.1, 3, 4)], heron: true, boss: 'storm' },
];

// Estrelas pelas vidas perdidas: nenhuma = 3, uma = 2, mais = 1.
export function starsFor(livesLost) {
  return livesLost <= 0 ? 3 : livesLost === 1 ? 2 : 1;
}
