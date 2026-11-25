// Server-only key lookup. Requires Node.js 18+ for the built-in fetch().
let cached = null;

function isUsable(entry) {
  return entry && Date.parse(entry.expiresAt) > Date.now();
}

function readConfig() {
  const url = process.env.KEYGEN_URL;
  const token = process.env.KEYGEN_TOKEN;

  if (!url || url === 'paste-here' || !token || token === 'paste-here') {
    throw new Error('Set KEYGEN_URL and KEYGEN_TOKEN in the server environment.');
  }

  return { url: url.replace(/\/$/, ''), token };
}

/**
 * Get a cached AI key, or ask MindDo for one when it is missing or expired.
 * Pass forceRefresh: true after OpenAI rejects the current key.
 * showError(message) is the server's screen-facing error handler.
 */
async function getKey({ forceRefresh = false, showError } = {}) {
  if (!forceRefresh && isUsable(cached)) {
    return cached;
  }

  const { url, token } = readConfig();
  const response = await fetch(`${url}/api/lookup-key`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = { error: { message: 'MindDo returned an invalid response.', fix: 'Check the MindDo service response.' } };
  }

  if (!response.ok || body.error) {
    const message = body.error?.message || `MindDo key lookup failed (${response.status}).`;
    const fix = body.error?.fix || 'Check KEYGEN_URL and KEYGEN_TOKEN.';
    if (typeof showError === 'function') showError(message);
    console.error(fix);
    throw new Error(message);
  }

  if (!body.apiKey || !body.expiresAt || !isUsable(body)) {
    const message = 'MindDo returned a missing or expired AI key.';
    if (typeof showError === 'function') showError(message);
    console.error('Check that MindDo returns apiKey and a future expiresAt.');
    throw new Error(message);
  }

  cached = { apiKey: body.apiKey, expiresAt: body.expiresAt };
  return cached;
}

module.exports = { getKey };
