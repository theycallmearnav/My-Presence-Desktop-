import { dialog, type BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import httpMod from 'node:http';
import { URL } from 'node:url';

// Discord Rich Presence can ONLY show images that live at a public https URL
// (or an asset key uploaded to the Discord dev portal). It cannot read a local
// file, a file:// path, or a base64 blob. So to let users "upload from their PC"
// we take the picked file, push it to a free no-auth image host (catbox.moe),
// and hand back the direct URL — which works in Discord and in our preview.

export type UploadResult =
  | { ok: true; url: string; fileName: string }
  | { ok: false; canceled: true }
  | { ok: false; error: string };

export type FetchDataUrlResult =
  | { ok: true; dataUrl: string; mime: string; animated: boolean }
  | { ok: false; error: string };

const MIME_BY_MAGIC: Array<{ mime: string; test: (b: Buffer) => boolean }> = [
  { mime: 'image/gif', test: (b) => b.slice(0, 3).toString('ascii') === 'GIF' },
  { mime: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 },
  { mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 },
  {
    mime: 'image/webp',
    test: (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP'
  }
];

// Discord happily fetches larger images, but keeping GIFs/pics reasonable avoids
// slow uploads and hosts rejecting the file. 12 MB is a comfortable ceiling.
const MAX_BYTES = 12 * 1024 * 1024;

const CATBOX_API = 'https://catbox.moe/user/api.php';
// Second, independent no-auth host we fall back to when catbox is down or
// rejecting, so a single flaky host doesn't block every upload.
const UGUU_API = 'https://uguu.se/upload.php';

// A realistic desktop-browser UA. Pinterest (and some CDNs) return a stripped or
// empty page to unknown agents, so we present as Chrome when scraping pages.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// catbox occasionally answers a valid upload with an empty body or a transient
// 5xx. One retry-friendly wrapper makes uploads reliable instead of one-shot.
const CATBOX_ATTEMPTS = 3;

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

/**
 * Open a native file picker, then upload the chosen image to catbox.moe.
 * Returns the public direct URL on success.
 */
export async function pickAndUploadImage(parent: BrowserWindow | null): Promise<UploadResult> {
  const picker = parent
    ? dialog.showOpenDialog(parent, pickerOptions())
    : dialog.showOpenDialog(pickerOptions());

  const selection = await picker;
  if (selection.canceled || selection.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }

  const filePath = selection.filePaths[0];
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    return { ok: false, error: 'Unsupported file type. Use a PNG, JPG, GIF or WEBP.' };
  }

  let data: Buffer;
  try {
    data = fs.readFileSync(filePath);
  } catch {
    return { ok: false, error: 'Could not read that file.' };
  }

  if (data.length > MAX_BYTES) {
    return { ok: false, error: `That file is too big (${formatSize(data.length)}). Keep it under 12 MB.` };
  }

  const fileName = path.basename(filePath);
  try {
    const url = await uploadImage(data, fileName, mime);
    return { ok: true, url, fileName };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Upload failed. Check your internet connection and try again.'
    };
  }
}

/**
 * Upload bytes to a public image host, resiliently. Tries catbox a few times
 * (it can answer a good upload with an empty body, time out, or reset the
 * connection), then falls back to uguu.se so one flaky host doesn't break
 * "upload from PC" or saving a crop.
 */
async function uploadImage(data: Buffer, fileName: string, mime: string): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= CATBOX_ATTEMPTS; attempt++) {
    try {
      return await uploadToCatbox(data, fileName, mime);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Upload failed.');
      // Brief backoff so we don't hammer a host that just reset the connection.
      if (attempt < CATBOX_ATTEMPTS) await delay(600 * attempt);
    }
  }
  // catbox is unreachable/flaky right now — try the backup host, also twice.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await uploadToUguu(data, fileName, mime);
    } catch (error) {
      lastError = error instanceof Error ? error : lastError;
      if (attempt < 2) await delay(600);
    }
  }
  throw new Error(
    `Couldn't reach the image host (${lastError?.message ?? 'network error'}). ` +
      'Check your internet/VPN and try again.'
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickerOptions(): Electron.OpenDialogOptions {
  return {
    title: 'Choose an image or GIF',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
  };
}

/**
 * POST the file to catbox.moe as multipart/form-data. No API key required.
 * On success the response body is the direct URL (e.g. https://files.catbox.moe/ab12.gif).
 */
function uploadToCatbox(data: Buffer, fileName: string, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const boundary = `----MyPresenceBoundary${process.pid}${data.length}`;
    const CRLF = '\r\n';

    const preamble = Buffer.from(
      `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="reqtype"${CRLF}${CRLF}` +
        `fileupload${CRLF}` +
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="fileToUpload"; filename="${sanitize(fileName)}"${CRLF}` +
        `Content-Type: ${mime}${CRLF}${CRLF}`,
      'utf8'
    );
    const epilogue = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');
    const body = Buffer.concat([preamble, data, epilogue]);

    const req = https.request(
      CATBOX_API,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          // Some CDN edges reset/stall POSTs that arrive with no User-Agent, and
          // a reused keep-alive socket is a common source of "read ECONNRESET".
          'User-Agent': BROWSER_UA,
          Connection: 'close'
        },
        timeout: 60000
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8').trim();
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`Image host rejected the upload (HTTP ${res.statusCode}).`));
            return;
          }
          if (!/^https?:\/\/\S+$/i.test(text)) {
            reject(new Error(text ? `Upload failed: ${text}` : 'Upload failed: empty response from image host.'));
            return;
          }
          resolve(text);
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('Upload timed out.')));
    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}

/**
 * Backup host. POST the file to uguu.se as multipart/form-data (no API key).
 * It replies with JSON: { success, files: [{ url }] }. Used only when catbox is
 * flaky so uploads still succeed.
 */
function uploadToUguu(data: Buffer, fileName: string, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const boundary = `----MyPresenceBoundary${process.pid}u${data.length}`;
    const CRLF = '\r\n';

    const preamble = Buffer.from(
      `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="files[]"; filename="${sanitize(fileName)}"${CRLF}` +
        `Content-Type: ${mime}${CRLF}${CRLF}`,
      'utf8'
    );
    const epilogue = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');
    const body = Buffer.concat([preamble, data, epilogue]);

    const req = https.request(
      UGUU_API,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          'User-Agent': BROWSER_UA,
          Connection: 'close'
        },
        timeout: 60000
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8').trim();
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`Backup image host rejected the upload (HTTP ${res.statusCode}).`));
            return;
          }
          try {
            const parsed = JSON.parse(text) as { success?: boolean; files?: Array<{ url?: string }> };
            const url = parsed.files?.[0]?.url;
            if (parsed.success && url && /^https?:\/\/\S+$/i.test(url)) {
              resolve(url);
              return;
            }
          } catch {
            /* fall through to error below */
          }
          reject(new Error('Backup upload failed: unexpected response from image host.'));
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('Backup upload timed out.')));
    req.on('error', (err) => reject(err));
    req.write(body);
    req.end();
  });
}
// pin.it/…) rather than a direct image URL. Discord needs the direct image, so
// when the user pastes a page link we fetch the page and pull the real image out
// of its <meta property="og:image"> / twitter:image tag. Runs in the Electron
// main process, so there's no browser CORS restriction.
export type ResolveResult =
  | { ok: true; url: string; changed: boolean }
  | { ok: false; error: string };

const DIRECT_IMAGE_RE = /\.(gif|png|jpe?g|webp)(\?|#|$)/i;

// Hosts that hand out a *page* whose path can still end in .gif/.jpg (e.g.
// tenor.com/bViEE.gif is a 301 → HTML view page, NOT a direct image). For these
// we must always scrape, never trust the extension. Direct-CDN hosts like
// media.tenor.com or i.pinimg.com are the real images.
const PAGE_HOSTS = /(^|\.)(tenor\.com|pinterest\.[a-z.]+|pin\.it|giphy\.com)$/i;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export async function resolveImageUrl(input: string): Promise<ResolveResult> {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Nothing to resolve.' };
  if (!/^https?:\/\//i.test(raw)) {
    return { ok: false, error: 'That is not a web link.' };
  }

  // A direct image extension only counts when it's NOT one of the page hosts
  // that disguise view pages as .gif/.jpg links (Tenor/Pinterest/Giphy).
  const onPageHost = PAGE_HOSTS.test(hostOf(raw));
  if (DIRECT_IMAGE_RE.test(raw) && !onPageHost) {
    return { ok: true, url: raw, changed: false };
  }

  try {
    const html = await fetchText(raw);
    // Try, in order: the direct CDN media baked into the page body (most
    // reliable — survives regional consent pages and works when og tags are
    // stripped), Pinterest's embedded JSON, then standard og:image.
    const found = extractDirectMedia(html) ?? extractPinterestImage(html) ?? extractOgImage(html);
    if (!found) {
      return { ok: false, error: 'Could not find an image on that page. Try “Copy image address” instead.' };
    }
    // Best-effort: copy the image onto our own host so it's guaranteed to render
    // in the preview AND on Discord (some CDNs/regions behave oddly when hot-
    // linked). If that fails for any reason, fall back to the direct URL.
    const hosted = await rehost(found);
    return { ok: true, url: hosted ?? found, changed: (hosted ?? found) !== raw };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not open that link.'
    };
  }
}

// Pull a direct image/GIF URL straight out of the page HTML. Prefers animated
// GIFs (what people actually want from Tenor/Giphy) over mp4/webp stills.
function extractDirectMedia(html: string): string | null {
  const hostGroups = [
    /https:\/\/media[0-9]*\.tenor\.com\/[A-Za-z0-9/_-]+\.(?:gif|webp|png|jpe?g)/gi,
    /https:\/\/media[0-9]*\.giphy\.com\/media\/[A-Za-z0-9/_.-]+\.(?:gif|webp|png|jpe?g)/gi,
    /https:\/\/i\.giphy\.com\/[A-Za-z0-9/_.-]+\.(?:gif|webp|png|jpe?g)/gi,
    /https:\/\/i\.imgur\.com\/[A-Za-z0-9]+\.(?:gif|png|jpe?g|webp)/gi
  ];
  const found: string[] = [];
  for (const re of hostGroups) {
    const matches = html.match(re);
    if (matches) found.push(...matches);
  }
  if (!found.length) return null;
  // Prefer an animated .gif; otherwise take the first candidate.
  const gif = found.find((u) => /\.gif(\?|#|$)/i.test(u));
  return (gif ?? found[0]).replace(/&amp;/g, '&');
}

// Download a resolved image and re-upload it to our own host so it always
// renders. Silent best-effort — returns null on any problem.
async function rehost(url: string): Promise<string | null> {
  try {
    const buf = await fetchBinary(url);
    if (!buf.length || buf.length > MAX_BYTES) return null;
    const mime = MIME_BY_MAGIC.find((m) => m.test(buf))?.mime;
    if (!mime) return null;
    const ext = extForMime(mime);
    return await uploadImage(buf, `linked.${ext}`, mime);
  } catch {
    return null;
  }
}

// Pinterest serves a JS shell with no og:image tag. The real artwork lives in
// embedded JSON as "url":"https://i.pinimg.com/originals/…". For video pins
// Discord can't show the mp4 anyway, so the poster still (also an originals
// image) is exactly what we want. We pick the most common originals URL and
// skip Pinterest's own decorative chrome image.
function extractPinterestImage(html: string): string | null {
  if (!/i\.pinimg\.com/i.test(html)) return null;
  const re = /https:\/\/i\.pinimg\.com\/originals\/[A-Za-z0-9/_-]+\.(?:jpg|jpeg|png|gif)/gi;
  const counts = new Map<string, number>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const url = match[0];
    // d53b01… is Pinterest's static app background, present on every page.
    if (/d53b014d86a6b6761bf649a0ed813c2b/i.test(url)) continue;
    counts.set(url, (counts.get(url) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [url, count] of counts) {
    if (count > bestCount) {
      best = url;
      bestCount = count;
    }
  }
  return best;
}

function extractOgImage(html: string): string | null {
  // Look for og:image or twitter:image in either attribute order.
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1] && /^https?:\/\//i.test(match[1])) {
      return match[1].replace(/&amp;/g, '&');
    }
  }
  return null;
}

// Minimal GET that follows redirects (pin.it → pinterest.com) and returns the
// decoded HTML body. Caps how much we read so a huge page can't hang us.
function fetchText(url: string, redirectsLeft = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : httpMod;
    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml',
          // Tenor is a Google property and may serve a cookie-consent
          // interstitial (no og:image) in some regions. This pre-consents so we
          // get the real page. Harmless for non-Google hosts.
          Cookie: 'CONSENT=YES+; SOCS=CAI'
        },
        timeout: 20000
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          res.resume();
          if (redirectsLeft <= 0) {
            reject(new Error('Too many redirects following that link.'));
            return;
          }
          const next = new URL(location, url).toString();
          resolve(fetchText(next, redirectsLeft - 1));
          return;
        }
        if (status >= 400) {
          res.resume();
          reject(new Error(`That link returned an error (HTTP ${status}).`));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        const CAP = 3 * 1024 * 1024; // 3 MB of HTML is plenty to find <head>.
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total <= CAP) chunks.push(chunk);
          else res.destroy();
        });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('close', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );
    req.on('timeout', () => req.destroy(new Error('That link took too long to open.')));
    req.on('error', (err) => reject(err));
  });
}

// Fetch a remote image into a base64 data URL so the renderer's <canvas> can
// read its pixels without the browser "tainting" it (a cross-origin <img> can't
// be read back with toBlob/getImageData). Runs in the main process = no CORS.
export async function fetchImageAsDataUrl(url: string): Promise<FetchDataUrlResult> {
  const raw = url.trim();
  if (!/^https?:\/\//i.test(raw)) {
    return { ok: false, error: 'That is not a web image link.' };
  }
  try {
    const buf = await fetchBinary(raw);
    if (buf.length > MAX_BYTES) {
      return { ok: false, error: `That image is too big (${formatSize(buf.length)}). Keep it under 12 MB.` };
    }
    const mime = MIME_BY_MAGIC.find((m) => m.test(buf))?.mime;
    if (!mime) {
      return { ok: false, error: 'That link is not a PNG, JPG, GIF or WEBP image.' };
    }
    return {
      ok: true,
      dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
      mime,
      animated: mime === 'image/gif' && isAnimatedGif(buf)
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not download that image.' };
  }
}

// Upload raw bytes (e.g. a freshly-cropped PNG from the renderer) to catbox and
// return the direct URL — same host as file uploads, so nothing new to trust.
export async function uploadBytes(base64: string, mime: string): Promise<UploadResult> {
  try {
    const data = Buffer.from(base64, 'base64');
    if (!data.length) return { ok: false, error: 'Nothing to upload.' };
    if (data.length > MAX_BYTES) {
      return { ok: false, error: `That image is too big (${formatSize(data.length)}). Keep it under 12 MB.` };
    }
    const ext = extForMime(mime);
    const url = await uploadImage(data, `cropped.${ext}`, mime);
    return { ok: true, url, fileName: `cropped.${ext}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Upload failed. Please try again.' };
  }
}

// A GIF is animated if it contains more than one image descriptor (0x2C) or a
// loop/graphic-control extension implying multiple frames. Cheap heuristic: look
// for a second image separator after the first.
function isAnimatedGif(buf: Buffer): boolean {
  let count = 0;
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i] === 0x00 && buf[i + 1] === 0x21 && buf[i + 2] === 0xf9) count++;
    if (count > 1) return true;
  }
  return false;
}

function fetchBinary(url: string, redirectsLeft = 5): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : httpMod;
    const req = lib.get(
      url,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MyPresence/1.0' },
        timeout: 30000
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          res.resume();
          if (redirectsLeft <= 0) {
            reject(new Error('Too many redirects fetching that image.'));
            return;
          }
          resolve(fetchBinary(new URL(location, url).toString(), redirectsLeft - 1));
          return;
        }
        if (status >= 400) {
          res.resume();
          reject(new Error(`That image link returned an error (HTTP ${status}).`));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_BYTES + 1024) {
            res.destroy();
            reject(new Error('That image is too big to load.'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('timeout', () => req.destroy(new Error('That image took too long to download.')));
    req.on('error', (err) => reject(err));
  });
}

function sanitize(name: string): string {
  return name.replace(/["\r\n]/g, '_');
}

function extForMime(mime: string): string {
  return mime === 'image/jpeg'
    ? 'jpg'
    : mime === 'image/webp'
      ? 'webp'
      : mime === 'image/gif'
        ? 'gif'
        : 'png';
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}
