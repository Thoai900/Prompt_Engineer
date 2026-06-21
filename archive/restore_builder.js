const fs = require('fs');
const path = require('path');

const logFile = 'C:\\Users\\THOAI PC\\.gemini\\antigravity\\brain\\09dae23c-9c36-43ce-a420-ac6ac4141681\\.system_generated\\logs\\transcript.jsonl';
if (!fs.existsSync(logFile)) {
  console.log('Log file does not exist at ' + logFile);
  process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');
console.log(`Read ${lines.length} lines from log file.`);

// List all steps that have "BuilderTab.tsx" in them
const matches = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  try {
    const obj = JSON.parse(line);
    const str = JSON.stringify(obj);
    if (str.includes('BuilderTab.tsx')) {
      matches.push({
        index: obj.step_index || i,
        type: obj.type,
        source: obj.source,
        tool: obj.tool_calls ? obj.tool_calls.map(tc => tc.name).join(', ') : 'none',
        hasContent: !!obj.content,
        contentLength: obj.content ? obj.content.length : 0
      });
    }
  } catch (e) {
    // Ignore invalid JSON lines
  }
}

console.log('Found matches:', JSON.stringify(matches, null, 2));
