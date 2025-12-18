import fs from 'fs';
import fetch from 'node-fetch';
import translate from '@vitalets/google-translate-api';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function detectSearchLang(author) {
  if (/[\u3040-\u30ff]/.test(author)) return 'ja'; // 일본어
  if (/[\u4e00-\u9fff]/.test(author)) return 'zh'; // 중국어
  return 'en';
}
// Wikidata 검색
async function searchWikidata(name) {
  const lang = detectSearchLang(name);

  const searchUrl =
    `https://www.wikidata.org/w/api.php?action=wbsearchentities` +
    `&search=${encodeURIComponent(name)}` +
    `&language=${lang}` +
    `&limit=5&format=json`;

  const res = await fetch(searchUrl).then(r => r.json());
  if (!res.search || res.search.length === 0) return null;

  return res.search.map(r => r.id); // 여러 후보 반환
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

// Wikidata 언어별 label
async function getWikidataLabels(qid) {
  const entityUrl =
    `https://www.wikidata.org/w/api.php?action=wbgetentities` +
    `&ids=${qid}` +
    `&props=labels` +
    `&languages=ja|ko|en|zh` +
    `&format=json`;

  const res = await fetch(entityUrl).then(r => r.json());
  const labels = res.entities[qid]?.labels;

  if (!labels) return null;

  return {
    qid,
    ja: labels.ja?.value,
    ko: labels.ko?.value,
    en: labels.en?.value,
    zh: labels.zh?.value,
    source: 'wikidata',
  };
}

// Author 하나 처리
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

  //  JP / CN은 번역 fallback 금지
  if (fallbackLang === null) {
    return {
      original: author,
      source: 'wikidata_not_found',
    };
  }

  // US만 번역 fallback
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
      source: 'failed',
    };
  }
}

// JSON 하나 처리
async function processFile(inputFile, outputFile, fallbackLang) {
  console.log(`\n📘 처리 시작: ${inputFile}`);

  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));

  const authors = [...new Set(data.map(b => b.author).filter(Boolean))];

  const results = [];

  for (const author of authors) {
    const normalized = await normalizeAuthor(author, fallbackLang);
    results.push(normalized);
    console.log(`✔ ${author}`);
    await sleep(1200); // ⭐ Wikidata rate limit 방지
  }

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`✅ 저장 완료: ${outputFile}`);
}

// 실행
(async () => {
  // 🇺🇸 US → fallback 허용
  await processFile(
    '../json_results/us.json',
    '../json_results/us_author.json',
    'ko',
  );

  // 🇯🇵 Japan → Wiki only
  await processFile(
    '../json_results/japan.json',
    '../json_results/japan_author.json',
    null,
  );

  // 🇨🇳 China → Wiki only
  await processFile(
    '../json_results/china.json',
    '../json_results/china_author.json',
    null,
  );
})();
