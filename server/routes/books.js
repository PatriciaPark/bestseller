import express from 'express';
import { getBooksFromCache, cacheExists } from '../services/cache.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const router = express.Router();

/**
 * 한국 책 목록 (알라딘)
 * 캐시 우선, 없으면 실시간 크롤링
 */
router.get('/kr-books', async (req, res) => {
  try {
    // 1. 캐시 확인
    if (await cacheExists('kr')) {
      const books = await getBooksFromCache('kr');
      if (books.length > 0) {
        console.log(`✅ 캐시된 데이터 사용 (KR): ${books.length}권`);
        return res.json({ books });
      }
    }

    // 2. 캐시가 없으면 실시간 크롤링 (기존 로직)
    console.log('📘 실시간 크롤링 시작 (KR)...');
    const { data } = await axios.get(
      'https://www.aladin.co.kr/shop/common/wbest.aspx?BranchType=1&BestType=Bestseller',
    );

    const $ = cheerio.load(data);
    const books = [];

    $('div.ss_book_box').each((i, el) => {
      if (books.length >= 20) return false;

      let imgSrc = $(el).find('img').attr('src');
      if (!imgSrc) return;
      if (imgSrc.startsWith('//')) {
        imgSrc = 'https:' + imgSrc;
      }
      if (!imgSrc.startsWith('https://image.aladin.co.kr/product')) return;

      const title =
        $(el).find('a.bo3').text().trim() ||
        $(el).find('.ss_book_list a').first().text().trim();

      let author = '저자 미상';
      $(el)
        .find('.ss_book_list ul li')
        .each((idx, li) => {
          const liText = $(li).text().trim();
          if (
            liText.includes('|') &&
            (liText.includes('지은이') ||
              liText.includes('옮긴이') ||
              liText.includes('엮은이') ||
              liText.includes('글') ||
              liText.includes('그림'))
          ) {
            const parts = liText.split('|').map(p => p.trim());
            if (parts[0]) {
              author = parts[0];
            }
            return false;
          }
        });

      const publisher =
        $(el).find('.ss_book_list').text().split('|')[1]?.trim() || '';

      let link =
        $(el).find('a.bo3').attr('href') ||
        $(el).find('.ss_book_list a').first().attr('href') ||
        '';

      if (link && !link.startsWith('http')) {
        link = 'https://www.aladin.co.kr' + link;
      }

      books.push({
        title: title || '제목 없음',
        author: author || '저자 미상',
        publisher: publisher || '출판사 미상',
        image: imgSrc,
        link,
      });
    });

    console.log(`✅ 한국 크롤링 성공: ${books.length}권`);
    res.json({ books });
  } catch (err) {
    console.error('❌ 한국 크롤링 실패:', err.message);
    res.status(500).json({ error: '크롤링 실패', message: err.message });
  }
});

/**
 * 미국 책 목록 (Amazon)
 */
router.get('/us-books', async (req, res) => {
  try {
    // 캐시 확인
    if (await cacheExists('us')) {
      const books = await getBooksFromCache('us');
      if (books.length > 0) {
        console.log(`✅ 캐시된 데이터 사용 (US): ${books.length}권`);
        return res.json({ books });
      }
    }

    // 실시간 크롤링 (기존 로직)
    console.log('📘 실시간 크롤링 시작 (US)...');
    const url = 'https://www.amazon.com/best-sellers-books-Amazon/zgbs/books';
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const books = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('div[data-asin]'));
      return items.slice(0, 20).map((el, idx) => {
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

        return { title, author, image, link };
      });
    });

    await browser.close();
    console.log(`✅ 미국 크롤링 성공: ${books.length}권`);
    res.json({ books });
  } catch (err) {
    console.error('❌ 미국 크롤링 실패:', err.message);
    res.status(500).json({ error: 'US 크롤링 실패', message: err.message });
  }
});

/**
 * 대만 책 목록
 */
router.get('/tw-books', async (req, res) => {
  try {
    // 캐시 확인
    if (await cacheExists('tw')) {
      const books = await getBooksFromCache('tw');
      if (books.length > 0) {
        console.log(`✅ 캐시된 데이터 사용 (TW): ${books.length}권`);
        return res.json({ books });
      }
    }

    // 캐시가 없으면 빈 배열 반환 (배치 크롤링 결과만 사용)
    console.log('⚠️ 대만 데이터 캐시 없음');
    res.json({ books: [] });
  } catch (err) {
    console.error('❌ 대만 데이터 로드 실패:', err.message);
    res
      .status(500)
      .json({ error: 'TW 데이터 로드 실패', message: err.message });
  }
});

/**
 * 프랑스 책 목록 (Amazon.fr)
 */
router.get('/fr-books', async (req, res) => {
  try {
    // 캐시 확인
    if (await cacheExists('fr')) {
      const books = await getBooksFromCache('fr');
      if (books.length > 0) {
        console.log(`✅ 캐시된 데이터 사용 (FR): ${books.length}권`);
        return res.json({ books });
      }
    }

    // 캐시가 없으면 빈 배열 반환 (배치 크롤링 결과만 사용)
    console.log('⚠️ 프랑스 데이터 캐시 없음');
    res.json({ books: [] });
  } catch (err) {
    console.error('❌ 프랑스 데이터 로드 실패:', err.message);
    res
      .status(500)
      .json({ error: 'FR 데이터 로드 실패', message: err.message });
  }
});

/**
 * 영국 책 목록 (Waterstones)
 */
router.get('/uk-books', async (req, res) => {
  try {
    // 캐시 확인
    if (await cacheExists('uk')) {
      const books = await getBooksFromCache('uk');
      if (books.length > 0) {
        console.log(`✅ 캐시된 데이터 사용 (UK): ${books.length}권`);
        return res.json({ books });
      }
    }

    // 캐시가 없으면 빈 배열 반환 (배치 크롤링 결과만 사용)
    console.log('⚠️ 영국 데이터 캐시 없음');
    res.json({ books: [] });
  } catch (err) {
    console.error('❌ 영국 데이터 로드 실패:', err.message);
    res
      .status(500)
      .json({ error: 'UK 데이터 로드 실패', message: err.message });
  }
});

/**
 * 일본 책 목록
 */
router.get('/jp-books', async (req, res) => {
  try {
    // 캐시 확인
    if (await cacheExists('jp')) {
      const books = await getBooksFromCache('jp');
      if (books.length > 0) {
        console.log(`✅ 캐시된 데이터 사용 (JP): ${books.length}권`);
        return res.json({ books });
      }
    }

    // 실시간 크롤링 (기존 로직)
    console.log('📘 실시간 크롤링 시작 (JP)...');
    const url =
      'https://www.kinokuniya.co.jp/disp/CKnRankingPageCList.jsp?dispNo=107002001001&vTp=w';

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    );
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    const books = await page.evaluate(() => {
      const items = Array.from(
        document.querySelectorAll('.list_area_wrap > div'),
      );
      const allImages = Array.from(document.querySelectorAll('img'));
      const validBooks = [];

      items.slice(0, 20).forEach((el, idx) => {
        let title = '';
        const linkEl =
          el.querySelector('a[href*="dsg"]') ||
          el.querySelector('a[href*="product"]');
        if (linkEl) {
          title = linkEl.innerText.trim() || linkEl.textContent.trim();
        }

        if (!title) {
          const titleElements = [
            el.querySelector('.booksname'),
            el.querySelector('[class*="title"]'),
            el.querySelector('h3'),
            el.querySelector('h4'),
            el.querySelector('strong'),
            el.querySelector('span[class*="name"]'),
          ];

          for (let el2 of titleElements) {
            if (el2 && el2.innerText.trim()) {
              title = el2.innerText.trim();
              break;
            }
          }
        }

        if (!title) {
          const imgEl = el.querySelector('img');
          if (imgEl) title = imgEl.alt || imgEl.title || `Book ${idx + 1}`;
        }

        title = title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        let author = '著者不明';
        const authorEl = el.querySelector('.clearfix.ml10');
        const fallbackAuthorEl = Array.from(el.querySelectorAll('*')).find(e =>
          e.innerText?.includes('著'),
        );
        if (authorEl) author = authorEl.innerText.trim();
        else if (fallbackAuthorEl) author = fallbackAuthorEl.innerText.trim();

        const imgEl = allImages.find(img => {
          const src = img.src || img.getAttribute('data-src') || '';
          if (!src) return false;
          if (
            src.includes('ranking') ||
            src.includes('number') ||
            src.includes('icon') ||
            src.includes('logo') ||
            src.includes('banner') ||
            src.includes('service') ||
            src.includes('event') ||
            src.includes('business') ||
            src.includes('store-event') ||
            src.includes('inc/')
          )
            return false;
          if (
            !(
              src.includes('product') ||
              src.includes('goods') ||
              src.includes('item')
            )
          )
            return false;
          return el.contains(img);
        });
        const image = imgEl
          ? imgEl.src || imgEl.getAttribute('data-src') || ''
          : '';

        const linkHref = el.querySelector('a')?.getAttribute('href') || '';
        const link = linkHref
          ? linkHref.startsWith('http')
            ? linkHref
            : 'https://www.kinokuniya.co.jp' + linkHref
          : '';

        validBooks.push({ title, author, image, link });
      });

      return validBooks;
    });

    await browser.close();
    console.log(`✅ 일본 크롤링 성공: ${books.length}권`);
    res.json({ books });
  } catch (err) {
    console.error('❌ 일본 크롤링 실패:', err.message);
    res.status(500).json({ error: 'JP 크롤링 실패', message: err.message });
  }
});

router.get('/es-books', async (req, res) => {
  try {
    // 캐시 확인
    if (await cacheExists('es')) {
      const books = await getBooksFromCache('us');
      if (books.length > 0) {
        console.log(`✅ 캐시된 데이터 사용 (ES): ${books.length}권`);
        return res.json({ books });
      }
    }

    // 실시간 크롤링 (기존 로직)
    console.log('📘 실시간 크롤링 시작 (ES)...');
    const url = 'https://www.amazon.es/-/en/gp/bestsellers/books';
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const books = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('div[data-asin]'));
      return items.slice(0, 20).map((el, idx) => {
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

        return { title, author, image, link };
      });
    });

    await browser.close();
    console.log(`✅ 스페인 크롤링 성공: ${books.length}권`);
    res.json({ books });
  } catch (err) {
    console.error('❌ 스페인 크롤링 실패:', err.message);
    res.status(500).json({ error: 'ES 크롤링 실패', message: err.message });
  }
});

export default router;
