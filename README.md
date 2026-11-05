# VR Arcade

Três jogos originais em WebXR para Meta Quest, inspirados nos gêneros mais vendidos da Steam. Rodam direto no navegador do Quest (e no PC com mouse).

**Jogar:** https://parappathe.github.io/vr-arcade/

| Jogo | Gênero | Quest | PC |
|---|---|---|---|
| Ponto Zero | Tiro em ondas | pistola em cada mão, gatilho atira | mira no mouse, clique atira |
| Lâmina da Lua | Ação com espada | espada em cada mão, golpe rápido corta e rebate facas | arraste o mouse rápido sobre o inimigo |
| Paredão | Goleiro | luvas nos controles | luvas seguem o mouse |

## No Quest

1. Abra o Meta Quest Browser e entre no link acima.
2. Escolha o jogo e toque em **ENTER VR**.
3. Jogue em pé, com espaço livre em volta. O gatilho começa a partida.

## Rodar localmente

Precisa de um servidor HTTP qualquer (abrir o arquivo direto não funciona por causa dos módulos JS):

```bash
npx http-server -p 8137 .
```

Feito com [three.js](https://threejs.org) (carregado do CDN, sem build).
