import fs from 'fs';

const content = fs.readFileSync('src/components/BuilderTab.tsx', 'utf8');
const lines = content.split('\n');

console.log("=== Code from Line 1420 to 1445 ===");
for (let i = 1419; i < 1445; i++) {
  if (lines[i]) console.log(`${i + 1}: ${lines[i]}`);
}
