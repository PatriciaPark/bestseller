import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPageBooks(browser) {
  const page = await browser.newPage();
  const url = 'https://www.amazon.es/gp/bestsellers/books';

  console.log('📍 Navigating to Amazon ES bestsellers...');
  await page.goto(url, { waitUntil: 'networkidle2' });
  await sleep(3000);

  const { books, links } = await page.evaluate(() => {
    const books = [];
    const links = [];

    const items = document.querySelectorAll('ol li.zg-item-immersion, ol li');
    console.log(`Found ${items.length} items on page`);

    for (let i = 0; i < items.length; i++) {
      if (books.length >= 30) break;

      const li = items[i];

      // 링크
      const detailHref =
        li.querySelector('div a.a-link-normal')?.href ||
        li.querySelector('a[href*="/dp/"]')?.href ||
        '';

      // 제목
      const title =
        li.querySelector('div a.a-link-normal span div')?.innerText ||
        li.querySelector('.p13n-sc-truncate')?.innerText ||
        li.querySelector('[class*="title"]')?.innerText ||
        '';

      // 이미지
      const image =
        li.querySelector('div.a-section img')?.src ||
        li.querySelector('img[src*="amazon"]')?.src ||
        '';

      // ✅ 작가 셀렉터 개선 - Amazon ES 구조에 맞춤
      let author =
        li.querySelector('a.a-size-small.a-link-child')?.innerText ||
        li.querySelector('.a-size-small.a-color-base')?.innerText ||
        li.querySelector('div.a-row.a-size-small span.a-size-small')
          ?.innerText ||
        li.querySelector('.p13n-sc-truncate-desktop-type2')?.innerText ||
        '';

      // "de " 접두사 제거 (스페인어 "by" 의미)
      author = author.replace(/^de\s+/i, '').trim();

      if (title && detailHref) {
        books.push({ title, author: author || 'Unknown', image, detailHref });
        links.push(detailHref);
      }
    }

    return { books, links };
  });

  console.log(`✅ Found ${books.length} books on main page`);

  // 디버깅: 첫 3개 책 정보 출력
  books.slice(0, 3).forEach((book, i) => {
    console.log(
      `  ${i + 1}. ${book.title.substring(0, 50)}... by ${book.author}`,
    );
  });

  await page.close();
  return { books, links };
}

async function fetchBookDetail(browser, link) {
  const detailPage = await browser.newPage();
  try {
    await detailPage.goto(link, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(1000);

    const data = await detailPage.evaluate(() => {
      // 책 설명
      const description =
        document
          .querySelector('#bookDescription_feature_div div.a-expander-content')
          ?.innerText.trim() ||
        document
          .querySelector('#bookDescription_feature_div')
          ?.innerText.trim() ||
        document
          .querySelector('[data-feature-name="bookDescription"]')
          ?.innerText.trim() ||
        '';

      // 리뷰/출판사 정보
      const reviewSection =
        document
          .querySelector('#editorialReviews_feature_div div.a-section')
          ?.innerText.trim() ||
        document
          .querySelector('#editorialReviews_feature_div')
          ?.innerText.trim() ||
        '';

      // ✅ 작가 정보 개선 - "Follow" 및 작가 이름 제거
      let writerInfo =
        document
          .querySelector(
            'div._about-the-author-card_style_cardContentDiv__FXLPd',
          )
          ?.innerText.trim() ||
        document
          .querySelector('[data-feature-name="authorBio"]')
          ?.innerText.trim() ||
        document.querySelector('#author-profile-card')?.innerText.trim() ||
        '';

      // ✅ "Follow" + 작가 이름 패턴 제거
      // 예: "Follow\nDan Brown\n\nDan Brown is..." → "Dan Brown is..."
      if (writerInfo) {
        // 1. "Follow" 단어 제거
        writerInfo = writerInfo.replace(/^Follow\s*/i, '');

        // 2. 첫 줄(작가 이름) 제거 - 첫 번째 줄바꿈까지
        const lines = writerInfo.split('\n').filter(line => line.trim());
        if (lines.length > 1) {
          // 첫 줄이 작가 이름이면 제거
          const firstLine = lines[0].trim();
          // 작가 이름은 보통 짧고 대문자로 시작
          if (firstLine.length < 50 && /^[A-Z]/.test(firstLine)) {
            writerInfo = lines.slice(1).join('\n').trim();
          }
        }

        // 3. "Read more about this author" 같은 문구 제거
        writerInfo = writerInfo.replace(/Read more about .*$/i, '').trim();
        writerInfo = writerInfo.replace(/Discover more of .*$/i, '').trim();
      }

      return { description, other: reviewSection, writerInfo };
    });

    await detailPage.close();
    return data;
  } catch (error) {
    console.error(`⚠️ Failed to fetch detail for ${link}:`, error.message);
    await detailPage.close();
    return { description: '', other: '', writerInfo: '' };
  }
}

export default async function spainScrapper() {
  const startTime = Date.now();
  const date = new Date();

  console.log('🇪🇸 Starting Spain (Amazon ES) scraper...');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    ],
  });

  const { books, links } = await fetchPageBooks(browser);

  if (books.length === 0) {
    console.error('❌ No books found! Amazon might be blocking the request.');
    await browser.close();
    return;
  }

  console.log(`\n📚 Fetching details for ${books.length} books...`);
  const concurrency = 3;

  for (let i = 0; i < books.length; i += concurrency) {
    const batchBooks = books.slice(i, i + concurrency);
    const batchLinks = links.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batchLinks.map(link => fetchBookDetail(browser, link)),
    );

    results.forEach((res, idx) => {
      const data =
        res.status === 'fulfilled'
          ? res.value
          : { description: '', other: '', writerInfo: '' };
      batchBooks[idx].description = data.description;
      batchBooks[idx].other = data.other;
      batchBooks[idx].writerInfo = data.writerInfo;
      console.log(
        `${i + idx + 1}. ${batchBooks[idx].title} ✅ (${
          batchBooks[idx].author
        })`,
      );
    });

    if (i + concurrency < books.length) {
      await sleep(2000);
    }
  }

  // backend/json_results에 저장
  const outputDir = path.join(__dirname, '..', 'json_results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const resultPath = path.join(outputDir, 'spain.json');
  const sanitized = books.map(toPublicBook);
  fs.writeFileSync(resultPath, JSON.stringify(sanitized, null, 2), 'utf-8');

  console.log(`\n✅ Crawled ${books.length} books`);
  console.log(`💾 Saved to ${resultPath}`);
  console.log(`📆 Date ${date.getDate()}`);
  console.log(`⏱ Done in ${(Date.now() - startTime) / 1000}s`);
  await browser.close();
}

function toPublicBook(raw) {
  const clean = value => (value || '').trim();
  return {
    image: clean(raw.image),
    link: clean(raw.detailHref),
    title: clean(raw.title),
    author: clean(raw.author),
    writerInfo: clean(raw.writerInfo),
    description: clean(raw.description),
    other: clean(raw.other),
  };
}

// Run directly
spainScrapper();
