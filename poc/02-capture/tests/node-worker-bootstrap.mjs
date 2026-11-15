/* Node-only shim to test the actual browser sink algorithm with real transferable MessagePort. */
import {parentPort} from 'node:worker_threads';
globalThis.self={onmessage:null,postMessage:(message,transfer)=>parentPort.postMessage(message,transfer)};
await import('../src/sink-worker.mjs');
parentPort.on('message', message=>self.onmessage?.({data:message}));
