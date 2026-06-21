const fs = require('fs');
const path = require('path');

const logFile = 'C:\\Users\\THOAI PC\\.gemini\\antigravity\\brain\\09dae23c-9c36-43ce-a420-ac6ac4141681\\.system_generated\\logs\\transcript.jsonl';
if (!fs.existsSync(logFile)) {
  console.log('Log file does not exist at ' + logFile);
  process.exit(1);
}

const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

const matches = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  try {
    const obj = JSON.parse(line);
    const str = JSON.stringify(obj);
    if (str.includes('BuilderTab.tsx')) {
      const toolCallArgStr = obj.tool_calls ? JSON.stringify(obj.tool_calls) : '';
      const isLarge = (obj.content && obj.content.length > 10000) || (toolCallArgStr.length > 10000);
      if (isLarge) {
        matches.push({
          index: obj.step_index || i,
          type: obj.type,
          source: obj.source,
          tool: obj.tool_calls ? obj.tool_calls.map(tc => tc.name).join(', ') : 'none',
          contentLength: obj.content ? obj.content.length : 0,
          argsLength: toolCallArgStr.length
        });
      }
    }
  } catch (e) {
  }
}

console.log('Found large matches:', JSON.stringify(matches, null, 2));
