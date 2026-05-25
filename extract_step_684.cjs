const fs = require('fs');
const logFile = 'C:\\Users\\THOAI PC\\.gemini\\antigravity\\brain\\09dae23c-9c36-43ce-a420-ac6ac4141681\\.system_generated\\logs\\transcript.jsonl';
if (fs.existsSync(logFile)) {
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('"step_index":684')) {
      const obj = JSON.parse(line);
      if (obj.content) {
        fs.writeFileSync('step_684_content.txt', obj.content, 'utf8');
        console.log('Saved step_684_content.txt');
      }
      break;
    }
  }
} else {
  console.log('Log file does not exist');
}
