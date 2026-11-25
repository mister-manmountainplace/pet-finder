// Computer-side helper: the phone calls this server, never OpenAI directly.
const fs = require('fs');
const http = require('http');
const path = require('path');
const { getKey } = require('./getKey');

const PORT = Number(process.env.PET_FINDER_HELPER_PORT || 8787);
const briefPath = path.join(__dirname, '..', 'BRIEF.md');
const notesPath = path.join(__dirname, '..', 'NOTES.md');
const MODEL = fs.readFileSync(notesPath, 'utf8').match(/^OpenAI model:\s*(\S+)/m)?.[1] || 'gpt-5.6-luna';

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadEnv();

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 12 * 1024 * 1024) reject(new Error('Request is too large.'));
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch {
        reject(new Error('The helper received invalid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

async function requestOpenAI(apiKey, instructions, { prompt, location, images }) {
  const content = [
    {
      type: 'input_text',
      text: `${prompt}\nSafe location context: ${location || 'not provided'}`,
    },
    ...(images || []).map((image) => ({
      type: 'input_image',
      image_url: `data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`,
    })),
  ];

  return fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, instructions, input: [{ role: 'user', content }] }),
  });
}

async function askOpenAI({ prompt, location, images }) {
  const instructions = fs.readFileSync(briefPath, 'utf8');
  let { apiKey } = await getKey();
  let response = await requestOpenAI(apiKey, instructions, { prompt, location, images });
  if (response.status === 401) {
    ({ apiKey } = await getKey({ forceRefresh: true }));
    response = await requestOpenAI(apiKey, instructions, { prompt, location, images });
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || 'The AI could not answer right now.');
  const answer = body.output_text || body.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join('\n');
  if (!answer) throw new Error('The AI returned no answer.');
  return answer;
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
    response.end();
    return;
  }
  if (request.method !== 'POST' || request.url !== '/ai') {
    sendJson(response, 404, { error: { message: 'Pet Finder helper route not found.' } });
    return;
  }
  try {
    const body = await readBody(request);
    if (!body.prompt) throw new Error('Pet Finder needs a question before asking the AI.');
    sendJson(response, 200, { answer: await askOpenAI(body) });
  } catch (error) {
    sendJson(response, 502, { error: { message: error.message || 'The AI helper could not answer.' } });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Pet Finder AI helper listening on http://0.0.0.0:${PORT}`);
});
