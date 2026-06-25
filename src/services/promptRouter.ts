import {
  classifyTopic,
  classifyThemeFromContext,
  findMatchingTemplate,
  generateBlockContent,
  isSimpleBlockType,
  shortenText,
  toProfessionalTone,
  toCasualTone,
} from './algorithmEngine';
import {
  generateAutoBlockStream,
  generateContentForExistingBlocks,
  type AiGenParams,
  type AiActionType,
} from './aiService';

// ─── Cache ───

interface CacheEntry {
  result: Record<string, string> | string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000;

function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function getCacheKey(...parts: string[]): string {
  return djb2Hash(parts.join('|'));
}

function getFromCache(key: string): CacheEntry['result'] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: CacheEntry['result']): void {
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.timestamp > CACHE_TTL) cache.delete(k);
    }
  }
  cache.set(key, { result, timestamp: Date.now() });
}

// ─── Quick Fill Router ───

export async function routeQuickFill(
  topic: string,
  blocksInfo: { id: string; type: string; title: string }[],
  options?: AiGenParams
): Promise<Record<string, string>> {
  const blockTypes = blocksInfo.map(b => b.type).sort();
  const cacheKey = getCacheKey('quickfill', topic, blockTypes.join(','));
  const cached = getFromCache(cacheKey);
  if (cached && typeof cached === 'object') {
    console.log('[Router] Quick Fill: cache hit');
    return cached as Record<string, string>;
  }

  const classification = classifyTopic(topic);

  if (!classification || classification.confidence < 0.4) {
    console.log('[Router] Quick Fill: low confidence → AI 100%');
    const result = await generateContentForExistingBlocks(topic, blocksInfo, options);
    setCache(cacheKey, result);
    return result;
  }

  const { theme } = classification;
  console.log(`[Router] Quick Fill: theme="${theme}", confidence=${classification.confidence.toFixed(2)}`);

  const algoResults: Record<string, string> = {};
  const needsAiBlocks: { id: string; type: string; title: string }[] = [];

  const templateMatch = findMatchingTemplate(topic, blockTypes);

  if (templateMatch && templateMatch.score >= 0.6) {
    console.log(`[Router] Quick Fill: template match "${templateMatch.template.title}" (score=${templateMatch.score.toFixed(2)})`);

    for (const block of blocksInfo) {
      const matchedBlock = templateMatch.matchedBlocks.get(block.type);
      if (matchedBlock && matchedBlock.content) {
        algoResults[block.id] = matchedBlock.content;
      } else {
        const suggestion = generateBlockContent(block.type, theme);
        if (suggestion) {
          algoResults[block.id] = suggestion;
        } else {
          needsAiBlocks.push(block);
        }
      }
    }
  } else {
    for (const block of blocksInfo) {
      if (isSimpleBlockType(block.type)) {
        const suggestion = generateBlockContent(block.type, theme);
        if (suggestion) {
          algoResults[block.id] = suggestion;
          continue;
        }
      }
      needsAiBlocks.push(block);
    }
  }

  const algoCount = Object.keys(algoResults).length;
  const aiCount = needsAiBlocks.length;
  console.log(`[Router] Quick Fill: ${algoCount} algo, ${aiCount} AI`);

  if (needsAiBlocks.length > 0) {
    try {
      const aiResults = await generateContentForExistingBlocks(topic, needsAiBlocks, options);
      Object.assign(algoResults, aiResults);
    } catch (error) {
      console.error('[Router] AI fallback failed for remaining blocks:', error);
    }
  }

  setCache(cacheKey, algoResults);
  return algoResults;
}

// ─── Auto Block Router ───

export async function routeAutoBlock(
  blockType: string,
  blockTitle: string,
  currentText: string,
  contextBlocks: { title: string; content: string }[],
  actionType: AiActionType | string,
  detailLevel: number,
  onChunk: (chunk: string) => void,
  options?: AiGenParams
): Promise<void> {
  const contentHash = currentText ? djb2Hash(currentText.slice(0, 100)) : 'empty';
  const cacheKey = getCacheKey('autoblock', blockType, String(actionType), contentHash);
  const cached = getFromCache(cacheKey);
  if (cached && typeof cached === 'string') {
    console.log('[Router] Auto Block: cache hit');
    onChunk(cached);
    return;
  }

  // --- Algorithmic: 'shorter' action ---
  if (actionType === 'shorter' && currentText.length > 50) {
    const shortened = shortenText(currentText);
    if (shortened !== currentText && shortened.length < currentText.length * 0.85) {
      console.log('[Router] Auto Block: algorithmic shorten');
      setCache(cacheKey, shortened);
      onChunk(shortened);
      return;
    }
  }

  // --- Algorithmic: 'professional' action ---
  if (actionType === 'professional' && currentText.length > 20) {
    const result = toProfessionalTone(currentText);
    if (result !== currentText) {
      console.log('[Router] Auto Block: algorithmic professional tone');
      setCache(cacheKey, result);
      onChunk(result);
      return;
    }
  }

  // --- Algorithmic: 'casual' action ---
  if (actionType === 'casual' && currentText.length > 20) {
    const result = toCasualTone(currentText);
    if (result !== currentText) {
      console.log('[Router] Auto Block: algorithmic casual tone');
      setCache(cacheKey, result);
      onChunk(result);
      return;
    }
  }

  // --- Algorithmic: empty simple block with known theme ---
  if (
    (!currentText || currentText.trim() === '') &&
    isSimpleBlockType(blockType) &&
    actionType === 'auto'
  ) {
    const theme = classifyThemeFromContext(contextBlocks);
    if (theme) {
      const suggestion = generateBlockContent(blockType, theme);
      if (suggestion) {
        console.log(`[Router] Auto Block: algorithmic suggestion for ${blockType}/${theme}`);
        setCache(cacheKey, suggestion);
        onChunk(suggestion);
        return;
      }
    }
  }

  // --- AI fallback ---
  console.log(`[Router] Auto Block: AI (type=${blockType}, action=${actionType})`);
  let accumulated = '';
  await generateAutoBlockStream(
    blockType,
    blockTitle,
    currentText,
    contextBlocks,
    actionType,
    detailLevel,
    (chunk) => {
      accumulated += chunk;
      onChunk(chunk);
    },
    options
  );
  if (accumulated) {
    setCache(cacheKey, accumulated);
  }
}
