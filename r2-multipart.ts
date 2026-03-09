// ═══════════════════════════════════════════════════
//  Supabase Edge Function: r2-multipart
//  يدعم رفع ملفات أكبر من 100MB على R2
//  
//  الـ endpoints:
//    POST /r2-multipart   { action: 'init',     course_id, title, description, order_index, content_type }
//    POST /r2-multipart   { action: 'sign',     upload_id, key, part_number }
//    POST /r2-multipart   { action: 'complete', upload_id, key, video_id, parts: [{ETag, PartNumber}] }
//    POST /r2-multipart   { action: 'abort',    upload_id, key }
// ═══════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, Content-Type, Authorization',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const { action } = body;

    // R2 credentials from Deno env
    const R2_ACCOUNT_ID  = Deno.env.get('R2_ACCOUNT_ID')!;
    const R2_ACCESS_KEY  = Deno.env.get('R2_ACCESS_KEY')!;
    const R2_SECRET_KEY  = Deno.env.get('R2_SECRET_KEY')!;
    const R2_BUCKET      = Deno.env.get('R2_BUCKET') || 'make-future-videos';
    const R2_PUBLIC_URL  = Deno.env.get('R2_PUBLIC_URL') || '';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── INIT MULTIPART ──────────────────────────────
    if (action === 'init') {
      const { course_id, title, description, order_index, content_type } = body;
      if (!course_id || !title) return json({ ok: false, error: 'course_id و title مطلوبين' });

      const fileExt = content_type?.includes('webm') ? 'webm' : 'mp4';
      const key = `courses/${course_id}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

      // Create multipart upload on R2
      const initUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}?uploads`;
      const initResp = await signedRequest('POST', initUrl, {}, R2_ACCESS_KEY, R2_SECRET_KEY, content_type || 'video/mp4');
      const initText = await initResp.text();

      if (!initResp.ok) return json({ ok: false, error: 'فشل بدء الرفع: ' + initText });

      const uploadId = initText.match(/<UploadId>(.+?)<\/UploadId>/)?.[1];
      if (!uploadId) return json({ ok: false, error: 'مش قادر يجيب upload ID' });

      // Save video record in DB (pending)
      const { data: vid, error: dbErr } = await supabase
        .from('videos')
        .insert({
          course_id,
          title,
          description: description || null,
          order_index: order_index || 1,
          video_type: 'upload',
          storage_key: key,
          is_active: false, // will be true after complete
        })
        .select('id')
        .single();

      if (dbErr) return json({ ok: false, error: dbErr.message });

      return json({ ok: true, upload_id: uploadId, key, video_id: vid.id });
    }

    // ── SIGN PART URL ───────────────────────────────
    if (action === 'sign') {
      const { upload_id, key, part_number } = body;
      if (!upload_id || !key || !part_number) return json({ ok: false, error: 'بيانات ناقصة' });

      const partUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}?partNumber=${part_number}&uploadId=${encodeURIComponent(upload_id)}`;
      const signedUrl = await getPresignedUrl('PUT', partUrl, R2_ACCESS_KEY, R2_SECRET_KEY);

      return json({ ok: true, signed_url: signedUrl });
    }

    // ── COMPLETE MULTIPART ──────────────────────────
    if (action === 'complete') {
      const { upload_id, key, video_id, parts } = body;
      if (!upload_id || !key || !parts?.length) return json({ ok: false, error: 'بيانات ناقصة' });

      // Build CompleteMultipartUpload XML
      const partsXml = parts
        .sort((a: any, b: any) => a.PartNumber - b.PartNumber)
        .map((p: any) => `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`)
        .join('');
      const xmlBody = `<CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;

      const completeUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}?uploadId=${encodeURIComponent(upload_id)}`;
      const completeResp = await signedRequest('POST', completeUrl, {}, R2_ACCESS_KEY, R2_SECRET_KEY, 'application/xml', xmlBody);

      if (!completeResp.ok) {
        const errText = await completeResp.text();
        return json({ ok: false, error: 'فشل إكمال الرفع: ' + errText });
      }

      // Activate video in DB
      if (video_id) {
        await supabase.from('videos').update({ is_active: true }).eq('id', video_id);
      }

      return json({ ok: true, url: R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key });
    }

    // ── ABORT MULTIPART ─────────────────────────────
    if (action === 'abort') {
      const { upload_id, key, video_id } = body;
      if (!upload_id || !key) return json({ ok: false, error: 'بيانات ناقصة' });

      const abortUrl = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}?uploadId=${encodeURIComponent(upload_id)}`;
      await signedRequest('DELETE', abortUrl, {}, R2_ACCESS_KEY, R2_SECRET_KEY);

      if (video_id) {
        await supabase.from('videos').delete().eq('id', video_id);
      }

      return json({ ok: true });
    }

    return json({ ok: false, error: 'action مش معروف: ' + action });

  } catch (e: any) {
    console.error(e);
    return json({ ok: false, error: e.message || 'خطأ غير متوقع' });
  }
});

// ─── HELPERS ─────────────────────────────────────

function json(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function signedRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  accessKey: string,
  secretKey: string,
  contentType = '',
  body?: string
) {
  const signedHeaders = await signAWSv4(method, url, headers, accessKey, secretKey, contentType, body);
  return fetch(url, {
    method,
    headers: { ...signedHeaders, ...(contentType ? { 'Content-Type': contentType } : {}) },
    body: body || undefined,
  });
}

async function getPresignedUrl(
  method: string,
  url: string,
  accessKey: string,
  secretKey: string
): Promise<string> {
  // For PUT part URLs, we just return the URL with AWS signed query params
  // R2 supports presigned URLs via AWS Signature v4
  const parsed = new URL(url);
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateShort = dateStr.slice(0, 8);
  const region = 'auto';
  const service = 's3';

  const credential = `${accessKey}/${dateShort}/${region}/${service}/aws4_request`;
  parsed.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  parsed.searchParams.set('X-Amz-Credential', credential);
  parsed.searchParams.set('X-Amz-Date', dateStr);
  parsed.searchParams.set('X-Amz-Expires', '3600');
  parsed.searchParams.set('X-Amz-SignedHeaders', 'host');

  const canonicalRequest = [
    method,
    parsed.pathname,
    parsed.search.slice(1).split('&').sort().join('&'),
    `host:${parsed.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const strToSign = [
    'AWS4-HMAC-SHA256',
    dateStr,
    `${dateShort}/${region}/${service}/aws4_request`,
    await sha256hex(canonicalRequest),
  ].join('\n');

  const sigKey = await deriveSigningKey(secretKey, dateShort, region, service);
  const sig = await hmacHex(sigKey, strToSign);

  parsed.searchParams.set('X-Amz-Signature', sig);
  return parsed.toString();
}

async function signAWSv4(
  method: string,
  url: string,
  extraHeaders: Record<string, string>,
  accessKey: string,
  secretKey: string,
  contentType: string,
  body?: string
): Promise<Record<string, string>> {
  const parsed = new URL(url);
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
  const dateShort = dateStr.slice(0, 8);
  const region = 'auto';
  const service = 's3';

  const bodyHash = body ? await sha256hex(body) : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  const headers: Record<string, string> = {
    host: parsed.host,
    'x-amz-date': dateStr,
    'x-amz-content-sha256': bodyHash,
    ...extraHeaders,
  };
  if (contentType) headers['content-type'] = contentType;

  const signedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}`).join('\n') + '\n';
  const signedHeadersStr = signedHeaderKeys.join(';');

  const canonicalRequest = [
    method,
    parsed.pathname,
    parsed.search.slice(1),
    canonicalHeaders,
    signedHeadersStr,
    bodyHash,
  ].join('\n');

  const strToSign = [
    'AWS4-HMAC-SHA256',
    dateStr,
    `${dateShort}/${region}/${service}/aws4_request`,
    await sha256hex(canonicalRequest),
  ].join('\n');

  const sigKey = await deriveSigningKey(secretKey, dateShort, region, service);
  const sig = await hmacHex(sigKey, strToSign);

  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${dateShort}/${region}/${service}/aws4_request,SignedHeaders=${signedHeadersStr},Signature=${sig}`;

  return headers;
}

async function deriveSigningKey(secret: string, date: string, region: string, service: string) {
  const enc = new TextEncoder();
  let key = await crypto.subtle.importKey('raw', enc.encode('AWS4' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  for (const data of [date, region, service, 'aws4_request']) {
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    key = await crypto.subtle.importKey('raw', sig, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  }
  return key;
}

async function hmacHex(key: CryptoKey, message: string) {
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256hex(message: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
