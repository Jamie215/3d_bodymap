/**
 * Cloudflare Pages Function — study data submission endpoint (POST /api/submit).
 *
 * Reference implementation of the backend contract defined in
 * js/services/backendService.js. Receives a SubmissionPayload from the browser,
 * stores the base64 images in R2, and writes the remaining metadata to D1. No
 * database credential is ever exposed to the client — the bindings below are
 * injected by Cloudflare at runtime (configured in wrangler.toml / dashboard).
 *
 * Bindings:
 *   env.DB           D1 database  (binding name "DB")
 *   env.SUBMISSIONS  R2 bucket    (binding name "SUBMISSIONS")
 *
 * See DATABASE.md for the full setup walkthrough.
 */

const MAX_BODY_BYTES = 25 * 1024 * 1024; // reject absurdly large posts (~25 MB)

// Turn a base64 data URL ("data:image/png;base64,....") into raw bytes for R2.
function dataUrlToBytes(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function putImage(env, key, dataUrl) {
  const bytes = dataUrlToBytes(dataUrl);
  if (!bytes) return null;
  await env.SUBMISSIONS.put(key, bytes, {
    httpMetadata: { contentType: 'image/png' },
  });
  return key;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Basic guards
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > MAX_BODY_BYTES) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.areas)) {
    return Response.json({ error: 'Malformed submission' }, { status: 422 });
  }

  const id = crypto.randomUUID();
  const receivedAt = new Date().toISOString();

  try {
    // 2. Move the multi-view snapshots to R2, replace with keys.
    const combined = payload.combinedDrawing || {};
    for (const view of ['front', 'back', 'left', 'right']) {
      if (combined[view]) {
        combined[view] = await putImage(env, `${id}/combined-${view}.png`, combined[view]);
      }
    }

    // 3. Move each area's drawing image to R2, replace with a key.
    for (const area of payload.areas) {
      if (area && area.drawingImageData) {
        area.drawingImageData = await putImage(
          env, `${id}/area-${area.areaNumber}.png`, area.drawingImageData,
        );
      }
    }

    // 4. Write the (now lightweight) metadata row to D1.
    const d = payload.deviceInfo || {};
    await env.DB.prepare(
      `INSERT INTO submissions
        (id, created_at, start_time, completion_time, duration_seconds,
         model_type, total_areas, device_type, operating_system, browser,
         user_agent, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id,
      receivedAt,
      payload.startTime ?? null,
      payload.completionTime ?? null,
      payload.durationSeconds ?? null,
      payload.modelType ?? null,
      payload.totalAreas ?? null,
      d.deviceType ?? null,
      d.operatingSystem ?? null,
      d.browser ?? null,
      d.userAgent ?? null,
      JSON.stringify(payload),
    ).run();

    return Response.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return Response.json({ error: 'Storage failed', detail: String(err) }, { status: 500 });
  }
}

// Reject non-POST verbs cleanly.
export async function onRequest(context) {
  if (context.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }
  return onRequestPost(context);
}
