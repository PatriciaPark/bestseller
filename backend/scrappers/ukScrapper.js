import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

puppeteer.use(StealthPlugin());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(value = '') {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const toPublicBook = book => ({
  image: book.image || '',
  link: book.href || '',
  title: book.title || '',
  author: book.author || '',
  writerInfo: book.writerInfo || '',
  description: book.description || book.contents || '',
  other: book.other || '',
});

// CAPTCHA issue, cannot proceed with page 2
async function fetchBooksMain() {
  const date = new Date();

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });
  const page = await browser.newPage();

  await page.goto('https://www.waterstones.com/books/bestsellers', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  const booksPage1 = await extractBooksFromMainPage(page, 24);

  await page.goto('https://www.waterstones.com/books/bestsellers?page=2', {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  const booksPage2 = await extractBooksFromMainPage(page, 6);

  const books = booksPage1.concat(
    booksPage2.map((book, index) => ({
      rank: 24 + index + 1,
      title: book.title,
      author: book.author,
      href: book.href,
      image: book.image,
    })),
  );

  console.log(`Total ${books.length} of books retrieved.`);
  console.log('Starting detailed page crawling...');

  const concurrency = 5;
  for (let i = 0; i < books.length; i += concurrency) {
    const batch = books.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(book => fetchBookDetail(browser, book.href)),
    );
    results.forEach((data, idx) => {
      const details = data || {};
      batch[idx].description = cleanText(
        details.description || details.contents || '',
      );
      batch[idx].writerInfo = cleanText(details.writerInfo || '');
      batch[idx].other = cleanText(details.other || '');
      batch[idx].contents = batch[idx].description;
      console.log(
        `${batch[idx].rank ?? i + idx + 1}. ${
          batch[idx].title || 'Untitled'
        } ✅`,
      );
    });
  }
  await browser.close();

  // --------------------- result_uk.json에 저장 ---------------------
  // backend/scrappers/ukScrapper.js 기준으로 ../json_results
  const outputDir = path.join(__dirname, '..', 'json_results');

  // Create folder if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const resultPath = path.join(outputDir, 'uk.json');
  fs.writeFileSync(
    resultPath,
    JSON.stringify(books.map(toPublicBook), null, 2),
    'utf-8',
  );
  console.log(`Total ${books.length} of books saved to ${resultPath}.`);
  console.log(`📆 Date ${date.getDate()}`);
}

async function fetchBookDetail(browser, href) {
  const page = await browser.newPage();
  try {
    await page.goto(href, { waitUntil: 'networkidle2' });
    await sleep(2000);

    await page
      .waitForSelector('section.book-info-tabs.ws-tabs.span12', {
        timeout: 30000,
      })
      .catch(() => {});

    const data = await page.evaluate(() => {
      const collectText = root => {
        if (!root) return '';
        const parts = Array.from(root.querySelectorAll('p, li, div'))
          .map(node => (node.textContent || '').trim())
          .filter(Boolean);
        if (parts.length) return parts.join('\n');
        return (root.textContent || '').trim();
      };

      const pickFirst = selectors => {
        for (const selector of selectors) {
          const el = document.querySelector(selector);
          if (el) {
            const text = collectText(el);
            if (text) return text;
          }
        }
        return '';
      };

      const description = pickFirst([
        '#scope_book_description',
        '[data-test="book-description"]',
        '[itemprop="description"]',
        '.book-description',
        '#product-description',
      ]);

      const writerInfoEl = document.querySelector(
        'body > div.main-container > div.main-page.row > div:nth-child(2) > section.book-info-tabs.ws-tabs.span12 > div.tabs-content-container.clearfix > div.tab-content.tab-content-author.active > div > div > p:nth-child(2)',
      );

      const writerInfo =
        writerInfoEl?.textContent?.trim() ||
        pickFirst([
          '#scope_author_biography',
          '#scope_book_author',
          '#scope_book_about_author',
          '[data-test="author-biography"]',
          '.author-biography',
        ]);

      const waterstonesSays = document.querySelector(
        'body > div.main-container > div.main-page.row > div:nth-child(2) > section.book-info-tabs.ws-tabs.span12 > div.tabs-content-container.clearfix > div.tab-content.content-text.tab-content-synopsis.active > div.two-columns > div.pdp-waterstones-says > p',
      );

      return {
        description,
        writerInfo,
        other: waterstonesSays?.textContent?.trim() || '',
      };
    });

    await page.close();
    return data;
  } catch (err) {
    await page.close();
    console.error(`⚠️ 상세 정보 크롤링 실패 (${href}):`, err.message);
    return { description: '', writerInfo: '', other: '' };
  }
}

async function extractBooksFromMainPage(page, limit) {
  await page.waitForSelector('div.book-preview', { timeout: 0 });

  // 페이지를 천천히 스크롤해서 모든 이미지 로드
  await autoScroll(page);

  // 이미지가 로드될 시간 추가
  await sleep(3000);

  const books = await page.evaluate(limit => {
    const cards = Array.from(
      document.querySelectorAll('div.book-preview'),
    ).slice(0, limit);
    const result = [];

    cards.forEach((card, index) => {
      const imageWrap = card.querySelector(
        'div.inner div.book-thumb-container div.book-thumb div.image-wrap',
      );
      const infoWrap = card.querySelector('div.inner div.info-wrap');

      if (!imageWrap || !infoWrap) return;

      const aTag = imageWrap.querySelector('a');
      const imgTag = imageWrap.querySelector('a img');

      // data-src 우선, 없으면 src, 둘 다 없으면 null
      let image = null;
      if (imgTag) {
        image = imgTag.getAttribute('data-src') || imgTag.src || null;
        // cover404.png는 제외
        if (image && image.includes('cover404.png')) {
          image = null;
        }
      }

      const href = aTag ? aTag.href : null;

      const author =
        infoWrap.querySelector('span.author a b')?.textContent.trim() ||
        infoWrap.querySelector('span.author span b')?.textContent.trim() ||
        infoWrap
          .querySelector(':scope > span > span > b')
          ?.textContent.trim() ||
        null;

      const titleEl =
        imageWrap.querySelector(
          'div.hover-layer div div div.pre-add span.visuallyhidden',
        ) || imageWrap.querySelector('div.hover-layer span.visuallyhidden');

      const title = titleEl ? titleEl.textContent.trim() : null;

      result.push({ rank: index + 1, title, author, href, image });
    });
    return result;
  }, limit);
  return books;
}

// 자동 스크롤 함수 추가
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

fetchBooksMain();
