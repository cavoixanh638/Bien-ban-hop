import fs from 'node:fs';
import process from 'node:process';
const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run trace:check -- path/to/mochop-ime-trace-redacted.json');
  process.exitCode = 2;
} else {
  try {
    const trace = JSON.parse(fs.readFileSync(file, 'utf8'));
    const errors = [];
    if (trace.schemaVersion !== 1 || trace.privacy !== 'lengths-and-types-only') errors.push('trace schema/privacy mismatch');
    if (!trace.testEnvironment?.os || !trace.testEnvironment?.browser
      || !trace.testEnvironment?.ime || !trace.testEnvironment?.inputMode) errors.push('missing Windows/browser/IME fields');
    if (!Array.isArray(trace.events)) errors.push('events missing');
    if ((trace.events || []).some(event => 'data' in event || 'typedText' in event || 'clipboardHtml' in event || (event.kind === 'keydown' && event.key && !['[printable]','[other]','Backspace','Delete','Enter','Escape','Tab','Insert','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown','Control','Alt','Meta','Shift','Process','Dead','Unidentified','Compose'].includes(event.key)))) {
      errors.push('raw content found in trace');
    }
    const types = new Set((trace.events || []).map(e => e.kind));
    const required = ['beforeinput', 'input', 'insert-anchored'];
    for (const type of required) if (!types.has(type)) errors.push(`missing ${type} signal`);
    if (errors.length) {
      console.error('TRACE INCOMPLETE:', errors.join('; '));
      process.exitCode = 1;
    } else {
      console.log('TRACE STRUCTURE VALID (not evidence of native IME without independent machine verification)');
      console.log(JSON.stringify({ environment: trace.testEnvironment,
        events: trace.events.length, kinds: Object.fromEntries([...types].map(k => [k,
          trace.events.filter(e => e.kind === k).length])) }, null, 2));
    }
  } catch (error) {
    console.error('TRACE ERROR:', error.message);
    process.exitCode = 1;
  }
}
