import fs from 'fs';
import fetch from 'node-fetch';
import translate from '@vitalets/google-translate-api';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function detectSearchLang(author) {
  if (/[\u3040-\u30ff]/.test(author)) return 'ja';
  if (/[\u4e00-\u9fff]/.test(author)) return 'zh';
  if (/[\uac00-\ud7af]/.test(author)) return 'ko';
  return 'en';
}

async function searchWikidata(name) {
  const lang = detectSearchLang(name);
  const searchUrl =
    `https://www.wikidata.org/w/api.php?action=wbsearchentities` +
    `&search=${encodeURIComponent(name)}` +
    `&language=${lang}` +
    `&limit=5&format=json`;

  const res = await fetch(searchUrl).then(r => r.json());
  if (!res.search || res.search.length === 0) return null;
  return res.search.map(r => r.id);
}

async function isHuman(qid) {
  const url =
    `https://www.wikidata.org/w/api.php?action=wbgetentities` +
    `&ids=${qid}` +
    `&props=claims&format=json`;

  const res = await fetch(url).then(r => r.json());
  const claims = res.entities[qid]?.claims;
  return claims?.P31?.some(c => c.mainsnak.datavalue?.value.id === 'Q5');
}

async function getWikidataLabels(qid) {
  const entityUrl =
    `https://www.wikidata.org/w/api.php?action=wbgetentities` +
    `&ids=${qid}` +
    `&props=labels` +
    `&languages=ja|ko|en|zh|zh-hans|zh-hant|fr|es` +
    `&format=json`;

  const res = await fetch(entityUrl).then(r => r.json());
  const labels = res.entities[qid]?.labels;

  if (!labels) return null;

  return {
    qid,
    ja: labels.ja?.value,
    ko: labels.ko?.value,
    en: labels.en?.value,
    zh:
      labels.zh?.value || labels['zh-hans']?.value || labels['zh-hant']?.value,
    fr: labels.fr?.value,
    es: labels.es?.value,
    source: 'wikidata',
  };
}

async function normalizeAuthor(author, fallbackLang) {
  try {
    const qids = await searchWikidata(author);
    if (qids) {
      for (const qid of qids) {
        if (await isHuman(qid)) {
          const wiki = await getWikidataLabels(qid);
          if (wiki) {
            return { original: author, ...wiki };
          }
        }
      }
    }
  } catch (e) {
    console.warn('⚠ Wikidata 실패:', author);
  }

  if (fallbackLang) {
    try {
      const res = await translate(author, { to: fallbackLang });
      return {
        original: author,
        [fallbackLang]: res.text,
        source: 'translate_api',
      };
    } catch {
      return {
        original: author,
        source: 'translate_failed',
      };
    }
  }

  return {
    original: author,
    source: 'wikidata_not_found',
  };
}

async function processJapanAuthors() {
  console.log('\n🇯🇵 Japan 작가 처리 시작...');
  const inputFile = '../json_results/japan.json';
  const outputFile = '../json_results/japan_author.json';

  if (!fs.existsSync(inputFile)) {
    console.warn(`⚠️ 파일 없음: ${inputFile}`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const authors = [...new Set(data.map(b => b.author).filter(Boolean))];

  const results = [];

  for (const author of authors) {
    const normalized = await normalizeAuthor(author, 'en');
    results.push(normalized);
    console.log(`✔ ${author} → ${normalized.source}`);
    await sleep(1200);
  }

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`✅ 저장 완료: ${outputFile}`);
}

processJapanAuthors();
