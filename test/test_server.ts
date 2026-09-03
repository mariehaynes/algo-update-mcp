import http from 'http';
import assert from 'assert';
import app from '../src/server.js';

const TEST_PORT = 3099;

const server = app.listen(TEST_PORT, '127.0.0.1', async () => {
  console.log(`Test server running on port ${TEST_PORT}`);

  try {
    // 1. Test HTML Home
    const html = await get(`http://127.0.0.1:${TEST_PORT}/`);
    assert.ok(html.includes('Marie Haynes'), 'HTML must include Marie Haynes');
    assert.ok(html.includes('algo.mariehaynes.com/sse'), 'HTML must include SSE endpoint reference');
    assert.ok(html.includes('claudeAiPrompt'), 'HTML must include Claude AI Helper merge prompt');
    assert.ok(html.includes("Keeping Marie's Findings Distinct from AI Advice"), 'HTML must include guidance on separating Marie data from AI advice');
    assert.ok(html.includes("Frequently Asked Questions"), 'HTML must include FAQ section');
    assert.ok(html.includes("Can Marie see my website data"), 'HTML must include privacy FAQ item');
    console.log('✅ Endpoint GET / passed');

    // 2. Test .well-known/mcp.json
    const mcpJsonStr = await get(`http://127.0.0.1:${TEST_PORT}/.well-known/mcp.json`);
    const mcpJson = JSON.parse(mcpJsonStr);
    assert.strictEqual(mcpJson.name, 'Marie Haynes Algorithm & AI Search Changes Intelligence');
    assert.ok(mcpJson.tools.length >= 4, 'Must have at least 4 tools in schema');
    assert.strictEqual(mcpJson.endpoints.streamable_http, '/mcp', 'Must declare Streamable HTTP endpoint');
    assert.strictEqual(mcpJson.endpoints.sse, '/sse', 'Must declare SSE endpoint');
    console.log('✅ Endpoint GET /.well-known/mcp.json passed');

    // 3. Test Streamable HTTP (/mcp) endpoint with JSON-RPC initialize
    const mcpInitPayload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    });
    const streamableRes = await post(`http://127.0.0.1:${TEST_PORT}/mcp`, mcpInitPayload, {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    });
    assert.ok(streamableRes.includes('protocolVersion') || streamableRes.includes('serverInfo'), 'Streamable HTTP must respond to initialize');
    console.log('✅ Endpoint POST /mcp (Streamable HTTP) passed');

    // 4. Test REST API /api/updates
    const apiResStr = await get(`http://127.0.0.1:${TEST_PORT}/api/updates?limit=3`);
    const apiRes = JSON.parse(apiResStr);
    assert.strictEqual(apiRes.count, 3, 'Should return 3 updates');
    assert.ok(apiRes.updates.length === 3, 'Array length must be 3');
    console.log('✅ Endpoint GET /api/updates passed');

    console.log('\n🎉 ALL HTTP & WEBMCP ENDPOINT TESTS PASSED!');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Test server error:', err);
    server.close();
    process.exit(1);
  }
});

function get(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function post(url: string, body: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        ...headers,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
