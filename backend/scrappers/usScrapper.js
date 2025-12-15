import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPageBooks(browser) {
  const page = await browser.newPage();
  const url = 'https://www.amazon.com/best-sellers-books-Amazon/zgbs/books';
  await page.goto(url, { waitUntil: 'networkidle2' });
  await sleep(3000);

  const { books, links } = await page.evaluate(() => {
    const books = [];
    const links = [];

    const items = Array.from(document.querySelectorAll('div[data-asin]'));
    items.slice(0, 20).forEach((el, idx) => {
      const titleEl =
        el.querySelector('._cDEzb_p13n-sc-css-line-clamp-1_1Fn1y') ||
        el.querySelector('.p13n-sc-truncate') ||
        el.querySelector('div._cDEzb_p13n-sc-css-line-clamp-3_g3dy1');
      const title = titleEl ? titleEl.innerText.trim() : `Book ${idx + 1}`;

      const authorEl =
        el.querySelector('._cDEzb_p13n-sc-css-line-clamp-1_EWgCb') ||
        el.querySelector('.a-size-small.a-link-child') ||
        el.querySelector('a.a-size-small') ||
        el.querySelector('span.a-size-small');
      const author = authorEl ? authorEl.innerText.trim() : 'Unknown Author';

      const imgEl = el.querySelector('img');
      const image = imgEl ? imgEl.src : '';

      const linkEl = el.querySelector('a');
      const href = linkEl ? linkEl.getAttribute('href') : '';
      const link = href ? 'https://www.amazon.com' + href : '';

      if (title && author && image && link) {
        books.push({ title, author, image });
        links.push(link);
      }
    });

    return { books, links };
  });

  await page.close();
  return { books, links };
}

async function fetchBookDetail(browser, link) {
  const detailPage = await browser.newPage();
  try {
    await detailPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    );

    await detailPage.goto(link, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // 스크롤하여 동적 콘텐츠 로드
    await detailPage.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await sleep(1000);

    // expander 버튼 클릭
    try {
      const expanderButtons = await detailPage.$$(
        '[data-a-expander-name="book_description_expander"]',
      );
      for (const btn of expanderButtons) {
        await btn.click();
        await sleep(500);
      }
    } catch (err) {
      // 무시
    }

    const data = await detailPage.evaluate(() => {
      let description = '';

      // expander 버튼 클릭
      const expanderButtons = document.querySelectorAll(
        '[data-a-expander-name="book_description_expander"]',
      );
      expanderButtons.forEach(btn => {
        if (btn.click) btn.click();
      });

      const bookDescDiv = document.querySelector('#bookDescription_feature_div');
      if (bookDescDiv) {
        const expanderContent = bookDescDiv.querySelector('.a-expander-content');
        if (expanderContent && expanderContent.innerText.trim().length > 50) {
          description = expanderContent.innerText.trim();
        }

        if (!description) {
          const spans = bookDescDiv.querySelectorAll('span');
          for (let span of spans) {
            if (span.innerText && span.innerText.trim().length > 50) {
              description = span.innerText.trim();
              break;
            }
          }
        }
      }

      let authorInfo = '';

      const editorialDiv = document.querySelector('#editorialReviews_feature_div');
      if (editorialDiv) {
        const sections = editorialDiv.querySelectorAll(
          '.a-section.a-spacing-small.a-padding-small',
        );

        for (let section of sections) {
          const text = section.innerText.trim();
          if (text.length > 100) {
            authorInfo = text;
            break;
          }
        }

        if (!authorInfo) {
          const text = editorialDiv.innerText.trim();
          if (text.length > 100) {
            authorInfo = text;
          }
        }
      }

      let publisher = '';
      let publishDate = '';

      const detailBullets = document.querySelectorAll(
        '#detailBullets_feature_div li, ' +
          '#detailBulletsWrapper_feature_div li, ' +
          '.detail-bullet-list li',
      );

      detailBullets.forEach(li => {
        const text = li.innerText || '';
        if (text.includes('Publisher') || text.includes('출판')) {
          const parts = text.split(':');
          if (parts.length > 1) {
            publisher = parts[1].trim();
          }
        }
        if (text.includes('Publication date') || text.includes('발행일')) {
          const parts = text.split(':');
          if (parts.length > 1) {
            publishDate = parts[1].trim();
          }
        }
      });

      const other = document.querySelector('#wayfinding-breadcrumbs_feature_div > ul')?.innerText.trim() || '';

      return {
        description,
        authorInfo,
        publisher,
        publishDate,
        other,
      };
    });

    await detailPage.close();
    return data;
  } catch (err) {
    await detailPage.close();
    console.error(`⚠️ 상세 정보 크롤링 실패 (${link}):`, err.message);
    return { description: '', authorInfo: '', publisher: '', publishDate: '', other: '' };
  }
}

export default async function usScrapper() {
  const startTime = Date.now();
  const date = new Date();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  console.log('🚀 Fetching US (Amazon) bestseller list...');
  const { books, links } = await fetchPageBooks(browser);
  const concurrency = 5;

  for (let i = 0; i < books.length; i += concurrency) {
    const batchBooks = books.slice(i, i + concurrency);
    const batchLinks = links.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batchLinks.map(link => fetchBookDetail(browser, link))
    );

    results.forEach((res, idx) => {
      const data =
        res.status === 'fulfilled'
          ? res.value
          : { description: '', authorInfo: '', publisher: '', publishDate: '' };
      batchBooks[idx].link = batchLinks[idx];
      batchBooks[idx].description = data.description || '';
      batchBooks[idx].contents = data.description || '';
      batchBooks[idx].authorInfo = data.authorInfo || '';
      batchBooks[idx].writerInfo = data.authorInfo || '';
      batchBooks[idx].other = data.other || '';
      batchBooks[idx].publisher = data.publisher || batchBooks[idx].publisher || '';
      batchBooks[idx].publishDate = data.publishDate || '';
      console.log(`${i + idx + 1}. ${batchBooks[idx].title} ✅`);
    });
  }

  const toPublicBook = book => ({
    image: book.image || '',
    link: book.link || '',
    title: book.title || '',
    author: book.author || '',
    writerInfo: book.writerInfo || '',
    description: book.description || book.contents || '',
    other: book.other || '',
  });

  const outputDir = path.join(process.cwd(), 'json_results');
  // Create folder if it doesn't exist
  if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  }
  const resultPath = path.join(outputDir, 'us.json');
  fs.writeFileSync(resultPath, JSON.stringify(books.map(toPublicBook), null, 2), 'utf-8');

  console.log(`✅ Crawled ${books.length} books and saved to us.json`);
  console.log(`⏱ Done in ${(Date.now() - startTime) / 1000}s`);
  console.log(`📆 Date ${date.getDate()}`);


  
  await browser.close();
}

// Run directly
usScrapper();