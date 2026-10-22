const { TextDecoder, TextEncoder } = require('node:util');
const { ReadableStream, TransformStream, WritableStream } = require('node:stream/web');
const { BroadcastChannel, MessagePort } = require('node:worker_threads');
const { Blob, File } = require('node:buffer');
Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  ReadableStream,
  TransformStream,
  WritableStream,
  BroadcastChannel,
  MessagePort,
  Blob,
  File,
});
const { fetch, Headers, FormData, Request, Response } = require('undici');
Object.assign(globalThis, {
  fetch,
  Headers,
  FormData,
  Request,
  Response,
  structuredClone: (value) => JSON.parse(JSON.stringify(value)),
});
