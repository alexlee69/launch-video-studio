import { appendFileSync } from 'node:fs';

const base = process.env.FAL_QUEUE_URL;
const id = process.env.MOCK_ID || 'mock-request';
const callLog = process.env.MOCK_CALL_LOG;
const reply = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json', ...headers },
});
globalThis.fetch = async (url, options = {}) => {
  const u = String(url);
  if (callLog) appendFileSync(callLog, JSON.stringify({
    method: options.method || 'GET',
    url: u,
    auth: options.headers && Object.keys(options.headers).some(k => k.toLowerCase() === 'authorization'),
  }) + '\n');
  if ((options.method || 'GET') === 'POST') {
    if (process.env.MOCK_SUBMIT === '500') return reply({ detail: 'mock ambiguous submit' }, 500);
    return reply({ request_id: id, status_url: `${base}/status/${id}`, response_url: `${base}/result/${id}` });
  }
  if (u.includes('/status/')) return reply({ status: process.env.MOCK_STATUS || 'COMPLETED', request_id: id });
  if (u.includes('/result/')) return reply({
    images: (process.env.MOCK_TWO_IMAGES ? ['file-0.jpg', 'file-1.jpg'] : ['file.jpg']).map(name => ({
      url: `${base}/${name}`,
      content_type: 'image/jpeg',
      file_size: 1432931,
    })),
  });
  return reply({ detail: 'mock path not found' }, 404);
};
