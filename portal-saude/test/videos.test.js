import './setup.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { converterVideo } from '../src/services/videos.js';
import { MODELOS } from '../src/services/catalogo.js';

test('converte links do YouTube, Vimeo e MP4 e recusa o resto', () => {
  const yt = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0';
  assert.equal(converterVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10').src, yt);
  assert.equal(converterVideo('https://youtu.be/dQw4w9WgXcQ').src, yt);
  assert.equal(converterVideo('https://m.youtube.com/shorts/dQw4w9WgXcQ').src, yt);
  assert.equal(converterVideo('https://vimeo.com/123456').src, 'https://player.vimeo.com/video/123456');
  assert.deepEqual(converterVideo('https://cdn.empresa.com.br/videos/alongamento.mp4'), { tipo: 'video', src: 'https://cdn.empresa.com.br/videos/alongamento.mp4' });
  assert.equal(converterVideo('http://youtu.be/dQw4w9WgXcQ'), null, 'só https');
  assert.equal(converterVideo('javascript:alert(1)'), null);
  assert.equal(converterVideo('https://exemplo.com/pagina'), null);
  assert.equal(converterVideo('https://www.youtube.com/watch?v="><script>'), null);
});

test('todo desafio físico do catálogo tem guia com movimentos animados existentes', async () => {
  // o módulo do navegador não depende do DOM para os dados, então pode ser importado aqui
  const { GUIAS, MOVIMENTOS, poseNoTempo } = await import('../public/exercicios.js');
  for (const m of MODELOS.filter((x) => x.categoria === 'atividade_fisica')) {
    const guia = GUIAS[m.codigo];
    assert.ok(guia, `sem guia: ${m.codigo}`);
    for (const p of guia.passos) {
      assert.ok(MOVIMENTOS[p.mov], `${m.codigo}: movimento ${p.mov} não existe`);
      assert.ok(p.tempo > 0);
    }
  }
  for (const [id, mov] of Object.entries(MOVIMENTOS)) {
    for (const t of [0, 0.7, 3.3, 10]) {
      const p = poseNoTempo(mov, t);
      assert.ok(Object.values(p).every(Number.isFinite), `${id} gera pose inválida em t=${t}`);
    }
  }
});
