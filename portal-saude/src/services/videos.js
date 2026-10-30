import { all, one } from '../db.js';

/**
 * Converte o link informado pelo RH em algo que o navegador consegue exibir.
 * Aceita YouTube (watch, youtu.be, shorts, embed), Vimeo e arquivos .mp4/.webm via https.
 */
export function converterVideo(url) {
  let u;
  try { u = new URL(String(url ?? '').trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  let id;
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1];
  } else if (host === 'youtu.be') {
    id = u.pathname.slice(1).split('/')[0];
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return { tipo: 'iframe', src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
  if (host === 'vimeo.com') {
    const v = u.pathname.match(/^\/(\d+)/)?.[1];
    if (v) return { tipo: 'iframe', src: `https://player.vimeo.com/video/${v}` };
  }
  if (host === 'player.vimeo.com' && /^\/video\/\d+/.test(u.pathname)) return { tipo: 'iframe', src: u.href };
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { tipo: 'video', src: u.href };
  return null;
}

export function videoDoModelo(codigo) {
  const v = one('SELECT * FROM modelo_videos WHERE modelo_codigo = ?', codigo);
  const exibicao = v && converterVideo(v.url);
  return exibicao ? { ...exibicao, titulo: v.titulo, url: v.url } : null;
}

export const listarVideos = () => all('SELECT * FROM modelo_videos');
