import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface PlayerMessageRichContentProps {
  text: string;
}

type UrlKind = 'image' | 'video' | 'audio' | 'page';

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[),.!?;:\]}]+$/;

const classifyUrl = (url: URL): UrlKind => {
  const path = url.pathname.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(path)) return 'image';
  if (/\.(mp4|webm|mov|m4v|ogv)$/.test(path)) return 'video';
  if (/\.(mp3|ogg|wav|m4a|aac|opus)$/.test(path)) return 'audio';
  return 'page';
};

const safeUrl = (value: string): URL | null => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
};

interface TextPart {
  type: 'text' | 'url';
  value: string;
  url?: URL;
}

const parseText = (text: string): TextPart[] => {
  const parts: TextPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ type: 'text', value: text.slice(cursor, index) });
    const raw = match[0];
    const clean = raw.replace(TRAILING_PUNCTUATION, '');
    const trailing = raw.slice(clean.length);
    const parsed = safeUrl(clean);
    parts.push(parsed ? { type: 'url', value: clean, url: parsed } : { type: 'text', value: clean });
    if (trailing) parts.push({ type: 'text', value: trailing });
    cursor = index + raw.length;
  }

  if (cursor < text.length) parts.push({ type: 'text', value: text.slice(cursor) });
  return parts.length ? parts : [{ type: 'text', value: text }];
};

// Cache in-memory para previews (evita refetch)
interface OGPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
}
const previewCache = new Map<string, OGPreview | null>();

async function fetchOGPreview(url: string): Promise<OGPreview | null> {
  if (previewCache.has(url)) return previewCache.get(url) ?? null;
  try {
    const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } });
    if (error || !data) { previewCache.set(url, null); return null; }
    previewCache.set(url, data as OGPreview);
    return data as OGPreview;
  } catch {
    previewCache.set(url, null);
    return null;
  }
}

const ResourcePreview: React.FC<{ url: URL }> = ({ url }) => {
  const href = url.toString();
  const kind = classifyUrl(url);

  if (kind === 'image') return <img src={href} alt="Recurso compartido" loading="lazy" className="max-h-72 w-auto max-w-full rounded-md object-contain" />;
  if (kind === 'video') return <video src={href} controls preload="metadata" className="max-h-72 w-full rounded-md" />;
  if (kind === 'audio') return <audio src={href} controls preload="metadata" className="w-full" />;

  // Page: OpenGraph preview
  return <PagePreviewCard url={href} hostname={url.hostname} />;
};

const PagePreviewCard: React.FC<{ url: string; hostname: string }> = ({ url, hostname }) => {
  const [preview, setPreview] = useState<OGPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const cached = previewCache.get(url);
    if (cached !== undefined) { setPreview(cached); setLoading(false); return; }
    fetchOGPreview(url).then(p => { setPreview(p); setLoading(false); });
  }, [url]);

  if (loading) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-current/20 bg-background/10 p-2">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span className="text-xs">Cargando preview...</span>
      </div>
    );
  }

  if (!preview) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 rounded-md border border-current/20 bg-background/10 p-2 hover:bg-background/20">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold">{hostname}</div>
          <div className="truncate text-[11px] opacity-75">{url}</div>
        </div>
        <ExternalLink className="h-4 w-4 shrink-0" />
      </a>
    );
  }

  return (
    <a
      href={preview.url || url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-0 items-stretch gap-0 overflow-hidden rounded-md border border-current/20 bg-background/10 hover:bg-background/20 no-underline"
    >
      {preview.image && !imageError && (
        <div className="w-20 h-20 flex-shrink-0 bg-background/20">
          <img src={preview.image} alt="" className="h-full w-full object-cover" onError={() => setImageError(true)} loading="lazy" />
        </div>
      )}
      <div className="min-w-0 flex-1 p-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          {preview.favicon && <img src={preview.favicon} alt="" className="h-3 w-3 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
          <span className="truncate text-[10px] opacity-60">{preview.siteName || hostname}</span>
        </div>
        {preview.title && <div className="truncate text-xs font-semibold">{preview.title}</div>}
        {preview.description && <div className="line-clamp-2 text-[10px] opacity-60 mt-0.5">{preview.description}</div>}
      </div>
    </a>
  );
};

export const PlayerMessageRichContent: React.FC<PlayerMessageRichContentProps> = ({ text }) => {
  const parts = useMemo(() => parseText(text), [text]);
  const urls = useMemo(() => {
    const seen = new Set<string>();
    return parts.flatMap((part) => {
      const value = part.url?.toString();
      if (!part.url || !value || seen.has(value)) return [];
      seen.add(value);
      return [part.url];
    });
  }, [parts]);

  return (
    <div className="space-y-2 px-1 pt-1 text-sm">
      <div className="whitespace-pre-wrap break-words">
        {parts.map((part, index) => part.type === 'url' && part.url ? (
          <a key={`${part.value}-${index}`} href={part.url.toString()} target="_blank" rel="noopener noreferrer" className="underline decoration-current/60 underline-offset-2 hover:opacity-80">{part.value}</a>
        ) : <React.Fragment key={`${index}-${part.value}`}>{part.value}</React.Fragment>)}
      </div>
      {urls.map((url) => <ResourcePreview key={url.toString()} url={url} />)}
    </div>
  );
};

export default PlayerMessageRichContent;
