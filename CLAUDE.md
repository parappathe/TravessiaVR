# TravessiaVR

Capivara Atravessa: fliperama em VR para o Meta Quest 3 no navegador (WebXR), também joga no PC.
Releitura dos jogos de atravessar a rua dos fliperamas dos anos 80, numa **maquete na mesa**: a
capivarinha sai da calçada, atravessa 5 faixas de estrada, o canteiro e 5 faixas de rio (pisando em
toras, tartarugas e no corpo dos jacarés) até as 5 tocas da margem de cima. O jogador aponta o
controle para a casa vizinha e aperta o gatilho para ela pular, e pode girar a maquete com a mão
para ver por outro lado. 12 fases em 3 mundos (Fazenda, Mangue, Pantanal à Noite), a 4ª de cada um
é chefe. Estrelas pelas vidas perdidas, modo Fliperama com recorde de 3 letras. Tudo em português.
Nomes, bichos e visual próprios.

## Como rodar / jogar

**No Quest:** abrir no navegador do óculos **https://parappathe.github.io/TravessiaVR/** e apertar
"Entrar em VR". Atualizar o site: commitar e rodar `python publicar.py TravessiaVR` em `C:\claude code`.

**No PC:** `python serve.py` nesta pasta e abrir `http://localhost:8872`. `python serve.py --https`
serve para abrir no Quest pela rede de casa (porta 8443).

### Controles

| | VR (Quest) | PC |
|---|---|---|
| Pular | Apontar o controle para a casa vizinha (um anel mostra o destino) e gatilho; ou empurrar o manche | Setas ou WASD; ou clicar ao lado da capivara |
| Girar a maquete | Segurar o grip e girar a mão | Botão direito arrastando, ou Q/E |
| Pausa | B ou Y | Esc ou P |
| Menu | Apontar e gatilho | Clique |

Manche e setas seguem a maquete girada ("para a frente" é para longe de quem olha). Vibra a cada
pulo, ao chegar na toca e ao morrer.

### Regras

- **Maquete:** 13 colunas x 13 fileiras (casas de 7 cm, mesa a 84 cm). Fileira 0 calçada, 1-5
  estrada, 6 canteiro, 7-11 rio, 12 margem com 5 tocas (colunas 1, 4, 6, 8, 11).
- Pula uma casa por vez (intervalo mínimo 0,2 s). Na estrada e nas margens a capivara fica sempre no
  meio da casa; no rio ela anda junto com a plataforma.
- **Morre:** atropelada; caiu na água; levada para fora da maquete pela tora; cabeça do jacaré;
  tartaruga que afundou (elas afundam por 1,2 s a cada 6 s, piscando antes, no Mangue e no
  Pantanal); cobra no canteiro; mato entre as tocas ou toca já cheia; garça/tuiuiú na toca; o relógio
  da travessia (30 s, 28 no Pantanal) acabou. 3 vidas.
- **Toca:** 50 pontos + 10 por segundo que sobrou; fruta na toca +200. As 5 tocas cheias vencem a
  fase (+1000, +1000 por vida). Cada fileira nova alcançada vale 10.
- **Chefes:** fase 4 **Trem da Fazenda** (a fileira 3 vira trilho; sinal pisca 1,5 s antes e o trem
  passa em 2 s); fase 8 **Sucuri** (cobra gigante que cruza o rio, uma fileira diferente a cada 4 s);
  fase 12 **Tempestade** (a correnteza do rio inverte a cada 6 s, com relâmpago 1 s antes).
- **Estrelas:** 3 sem perder vida, 2 perdendo uma, 1 perdendo mais. **Fliperama:** as 12 seguidas,
  +1 vida a cada chefe, recorde de 3 letras. Progresso no navegador (`travessiavr.v1`).

Fases (em `js/levels.js`): Fazenda: 1 Primeira travessia, 2 Dia de feira, 3 Hora do rush, 4 Trem da
Fazenda. Mangue: 5 Água salobra, 6 Cobra no canteiro, 7 Maré alta, 8 Sucuri. Pantanal: 9 Faróis,
10 Comitiva, 11 Corredeira, 12 Tempestade.

## Como testar

- `node tests/run.js` (ou `npm test`): fases, pulos (limites, intervalo, pontos), estrada (atropela,
  `hazard` bate com `objectsAt`), rio (água, tora leva junto, levada para fora, tartaruga mergulhada,
  jacaré), tocas (encher, voltar, mato, toca cheia, garça, vencer), relógio e vidas, cobra, trem,
  sucuri, tempestade, fruta, e o **robô**: planeja a travessia prevendo o movimento (o mundo é função
  do tempo), com no máximo 1 pulo a cada 0,3 s e margem de segurança maior que a do jogo; joga as 12
  fases com 5 sementes e tem que vencer todas com 2 estrelas em quase todas. Termina com "Tudo certo".
- No navegador (console): `dev.loadLevel(8)`, `dev.autoplay = true`, `dev.advance(20)`, `dev.state()`,
  `dev.hop('up')`, `dev.arcade()`, `dev.snapshot()`, `dev.resetSave()`. `window.capivara` tem `game`, `board`.
- **Só dá para testar no óculos:** mirar a casa com o controle, o manche, girar a maquete com o grip,
  altura da mesa, conforto e FPS.

## Estrutura

| Arquivo | O que tem |
|---|---|
| `js/sim.js` | Regras. Tudo que se move é função do tempo: `objectsAt`, `hazard`, `platformAt`, `homeResult`, `trainAt`, `sucuriAt`, `snakeAt`, `heronAt`, `fruitAt`. Sem navegador |
| `js/levels.js` | 3 mundos, 12 fases (faixas da estrada e do rio), estrelas. Sem navegador |
| `js/robot.js` | Robô que planeja a travessia (busca no tempo) com limites humanos. Sem navegador |
| `js/main.js` | Render, VR (mira por raio, manche, girar com grip), teclado/mouse, menus, letreiro, eventos → sons |
| `js/scene.js` | Cenários, mesa, maquete (textura das fileiras, água, moldura, arbustos), veículos, toras, tartarugas, jacarés, capivara, garça/tuiuiú, fruta, cobra, trem, sucuri, letreiro. Planos de corte escondem o que passa da beira |
| `js/ui.js`, `js/audio.js`, `js/save.js`, `js/vec.js` | Menu 3D, sons e música, salvamento, vetores |
| `tests/run.js` | Testes |
| `serve.py` | Servidor local sem cache (porta 8872) |

Coordenadas da maquete: casa (x, y) fica em `cellPos(x, y)` = ((x − 6) · 7 cm, 0, −(y − 6) · 7 cm)
no grupo da maquete (que gira). Objetos de faixa dão a volta de x = −4 a 17.

## Regras e convenções do projeto

- `sim.js`, `levels.js`, `robot.js` e `vec.js` não usam navegador (testes no Node).
- Coisa nova que se move tem que ser função do tempo (sem estado), senão o robô não consegue prever.
- Mexeu em regras, fases ou robô: `node tests/run.js`.

## Decisões

- Pular apontando para a casa (e não fazendo gesto) é mais preciso no VR; o manche é a alternativa.
- Girar a maquete só muda a vista; as regras não mudam.
- Estrelas por vidas perdidas. Porta do servidor local 8872.

## Pendências / problemas conhecidos

- **Nada foi testado no Quest ainda**: mira por raio, manche, giro da maquete, altura da mesa,
  conforto, FPS. Sons só checados por não dar erro.
- Dificuldade calibrada pelo robô (que prevê o futuro com perfeição); pode estar difícil para gente
  nas fases rápidas do Pantanal.
