/**
 * Lector de Server-Sent Events tolerante a fragmentación: un evento puede llegar partido en
 * varios trozos de red, o varios eventos en un mismo trozo. Devuelve {event, data} por
 * evento completo (separados por una línea en blanco).
 */
export interface SseEvent {
  event: string | null;
  data: string;
}

export async function* readSse(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      if (signal?.aborted) return;
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n');
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const ev = parseBlock(raw);
        if (ev) yield ev;
      }
    }
    buf += decoder.decode();
    const tail = parseBlock(buf.trim());
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

function parseBlock(raw: string): SseEvent | null {
  if (!raw) return null;
  let event: string | null = null;
  const data: string[] = [];
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const i = line.indexOf(':');
    const field = i === -1 ? line : line.slice(0, i);
    const value = i === -1 ? '' : line.slice(i + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  if (!data.length && !event) return null;
  return { event, data: data.join('\n') };
}
