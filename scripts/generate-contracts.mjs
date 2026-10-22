import { mkdir, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';

const endpoint = process.env.OPENAPI_URL || 'http://localhost:3001/docs-json';
const response = await fetch(endpoint);
if (!response.ok) throw new Error(`OpenAPI indisponível: HTTP ${response.status}`);
const schema = await response.json();
await mkdir('docs', { recursive: true });
await mkdir('packages/contracts/src', { recursive: true });
await writeFile('docs/openapi.json', JSON.stringify(schema, null, 2) + '\n');
const ast = await openapiTS(schema);
await writeFile('packages/contracts/src/generated.ts', astToString(ast));
console.log('OpenAPI exportado e tipos de transporte gerados.');
