import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.get('/kr-books', async (req, res) => {
  try {
    const { data } = await axios.get(
      'https://www.aladin.co.kr/shop/common/wbest.aspx?BranchType=1&BestType=Bestseller',
    );

    const $ = cheerio.load(data);
    const books = [];

    $('div.ss_book_box').each((i, el) => {
      if (books.length >= 20) return false; // 상위 20개만

      let imgSrc = $(el).find('img').attr('src');

      // 이미지 URL 처리
      if (!imgSrc) return;
      if (imgSrc.startsWith('//')) {
        imgSrc = 'https:' + imgSrc;
      }
      if (!imgSrc.startsWith('https://image.aladin.co.kr/product')) return;

      // 제목, 저자, 출판사 추출
      const title =
        $(el).find('a.bo3').text().trim() ||
        $(el).find('.ss_book_list a').first().text().trim();

      // ✅ ss_book_list의 모든 li를 순회
      let author = '저자 미상';

      $(el)
        .find('.ss_book_list ul li')
        .each((idx, li) => {
          const liText = $(li).text().trim();

          // | 기호가 포함되어 있고, "지은이" 또는 "옮긴이" 같은 키워드가 있으면 저자 정보
          if (
            liText.includes('|') &&
            (liText.includes('지은이') ||
              liText.includes('옮긴이') ||
              liText.includes('엮은이') ||
              liText.includes('글') ||
              liText.includes('그림'))
          ) {
            const parts = liText.split('|').map(p => p.trim());

            // 첫 번째 부분이 저자
            if (parts[0]) {
              author = parts[0];
            }

            return false; // 찾았으면 반복 중단
          }
        });
      const publisher =
        $(el).find('.ss_book_list').text().split('|')[1]?.trim() || '';
      books.push({
        title: title || '제목 없음',
        author: author || '저자 미상',
        publisher: publisher || '출판사 미상',
        image: imgSrc,
        link:
          $(el).find('a.bo3').attr('href') ||
          $(el).find('.ss_book_list a').first().attr('href') ||
          '', // ✅ link 추가
      });

      // link가 상대 경로면 절대 경로로 변환
      if (
        books[books.length - 1].link &&
        !books[books.length - 1].link.startsWith('http')
      ) {
        books[books.length - 1].link =
          'https://www.aladin.co.kr' + books[books.length - 1].link;
      }
    });

    console.log('✅ 한국 크롤링 성공:', books.length, '권');
    res.json({ books });
  } catch (err) {
    console.error('❌ 한국 크롤링 실패:', err);
    res.status(500).json({ error: '크롤링 실패', message: err.message });
  }
});

// 📘 한국 책 상세 정보 크롤링
app.get('/kr-book-detail', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL이 필요합니다' });
    }

    console.log('📘 한국 책 상세 정보 요청:', url);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 스크롤
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const bookDetail = await page.evaluate(() => {
      console.log('=== 알라딘 상세 페이지 크롤링 시작 ===');

      // ✅ 책 소개 (Ere_prod_mconts_R - 첫 번째)
      let description = '';
      const boxes = document.querySelectorAll('.Ere_prod_mconts_box');

      boxes.forEach((box, idx) => {
        const titleEl = box.querySelector('.Ere_prod_mconts_LL');
        const contentEl = box.querySelector('.Ere_prod_mconts_R');

        if (!titleEl || !contentEl) return;

        const title = titleEl.innerText.trim();
        const content = contentEl.innerText.trim();

        console.log(
          `박스 ${idx + 1}: 제목="${title}", 내용 길이=${content.length}자`,
        );

        // 책소개
        if (title.includes('책소개') || title === '책소개') {
          description = content;
          console.log('✅ 책 소개 찾음');
        }
      });

      // ✅ 줄거리 (Ere_prod_mconts_R - 두 번째)
      let plot = '';
      const storyShort = document.getElementById('div_Story_Short');
      const storyAll = document.getElementById('div_Story_All');

      if (storyAll && storyAll.style.display !== 'none') {
        plot = storyAll.innerText.trim();
        console.log('✅ 줄거리 찾음 (div_Story_All):', plot.length + '자');
      } else if (storyShort) {
        plot = storyShort.innerText.trim();
        console.log('✅ 줄거리 찾음 (div_Story_Short):', plot.length + '자');
      }

      // ✅ 저자 소개 (introduction 또는 author_box)
      let authorInfo = '';
      const introEl = document.querySelector('.introduction');
      if (introEl) {
        authorInfo = introEl.innerText.trim();
        console.log(
          '✅ 저자 소개 찾음 (introduction):',
          authorInfo.substring(0, 100),
        );
      } else {
        const authorBox = document.querySelector('.author_box');
        if (authorBox) {
          authorInfo = authorBox.innerText.trim();
          console.log(
            '✅ 저자 소개 찾음 (author_box):',
            authorInfo.substring(0, 100),
          );
        }
      }

      // 출판 정보
      let publisher = '';
      let publishDate = '';

      const infoTable = document.querySelector('table.Ere_prod_info_table');
      if (infoTable) {
        const rows = infoTable.querySelectorAll('tr');
        rows.forEach(row => {
          const th = row.querySelector('th');
          const td = row.querySelector('td');
          if (th && td) {
            const label = th.innerText.trim();
            const value = td.innerText.trim();
            if (label.includes('출판사')) {
              publisher = value;
            }
            if (label.includes('출간일') || label.includes('발행일')) {
              publishDate = value;
            }
          }
        });
      }

      console.log('=== 크롤링 결과 ===');
      console.log('책 소개:', description ? `${description.length}자` : '없음');
      console.log('줄거리:', plot ? `${plot.length}자` : '없음');
      console.log('저자 소개:', authorInfo ? `${authorInfo.length}자` : '없음');

      return {
        description,
        plot,
        authorInfo,
        publisher,
        publishDate,
      };
    });

    await browser.close();

    console.log('✅ 한국 책 상세 정보 크롤링 성공');
    console.log(
      '책 소개:',
      bookDetail.description
        ? `있음 (${bookDetail.description.length}자)`
        : '없음',
    );
    console.log(
      '줄거리:',
      bookDetail.plot ? `있음 (${bookDetail.plot.length}자)` : '없음',
    );
    console.log(
      '저자 소개:',
      bookDetail.authorInfo
        ? `있음 (${bookDetail.authorInfo.length}자)`
        : '없음',
    );

    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 한국 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: '상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});

app.get('/us-books', async (req, res) => {
  try {
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
        // 제목
        const titleEl =
          el.querySelector('._cDEzb_p13n-sc-css-line-clamp-1_1Fn1y') ||
          el.querySelector('.p13n-sc-truncate') ||
          el.querySelector('div._cDEzb_p13n-sc-css-line-clamp-3_g3dy1');
        const title = titleEl ? titleEl.innerText.trim() : `Book ${idx + 1}`;

        // 저자
        const authorEl =
          el.querySelector('._cDEzb_p13n-sc-css-line-clamp-1_EWgCb') ||
          el.querySelector('.a-size-small.a-link-child') ||
          el.querySelector('a.a-size-small') ||
          el.querySelector('span.a-size-small');
        const author = authorEl ? authorEl.innerText.trim() : 'Unknown Author';

        // 이미지
        const imgEl = el.querySelector('img');
        const image = imgEl ? imgEl.src : '';

        // 링크
        const linkEl = el.querySelector('a');
        const href = linkEl ? linkEl.getAttribute('href') : '';
        const link = href ? 'https://www.amazon.com' + href : '';

        console.log(`${idx + 1}. ${title} - ${author}`);

        return { title, author, image, link };
      });
    });

    await browser.close();
    console.log(`✅ Amazon 크롤링 성공: ${books.length}권`);
    res.json({ books });
  } catch (err) {
    console.error('❌ Amazon Puppeteer 크롤링 실패:', err);
    res.status(500).json({ error: 'US 크롤링 실패', message: err.message });
  }
});
app.get('/us-book-detail', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL이 필요합니다' });
    }

    console.log('📘 상세 정보 요청:', url);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    const page = await browser.newPage();

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });

    // 스크롤
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const bookDetail = await page.evaluate(() => {
      console.log('=== 페이지 크롤링 시작 ===');

      // ✅ 책 설명 (Book Description)
      let description = '';

      // 1. expander 버튼 클릭 시도 (숨겨진 내용 펼치기)
      const expanderButtons = document.querySelectorAll(
        '[data-a-expander-name="book_description_expander"]',
      );
      expanderButtons.forEach(btn => {
        if (btn.click) btn.click();
      });

      // 2. bookDescription_feature_div에서 찾기
      const bookDescDiv = document.querySelector(
        '#bookDescription_feature_div',
      );
      if (bookDescDiv) {
        // expander 내용
        const expanderContent = bookDescDiv.querySelector(
          '.a-expander-content',
        );
        if (expanderContent && expanderContent.innerText.trim().length > 50) {
          description = expanderContent.innerText.trim();
          console.log('✅ 책 설명 찾음 (expander)');
        }

        // 일반 텍스트
        if (!description) {
          const spans = bookDescDiv.querySelectorAll('span');
          for (let span of spans) {
            if (span.innerText && span.innerText.trim().length > 50) {
              description = span.innerText.trim();
              console.log('✅ 책 설명 찾음 (span)');
              break;
            }
          }
        }
      }

      // ✅ 저자 정보 (Editorial Reviews)
      let authorInfo = '';

      const editorialDiv = document.querySelector(
        '#editorialReviews_feature_div',
      );
      if (editorialDiv) {
        // a-section a-spacing-small a-padding-small 찾기
        const sections = editorialDiv.querySelectorAll(
          '.a-section.a-spacing-small.a-padding-small',
        );

        for (let section of sections) {
          const text = section.innerText.trim();
          if (text.length > 100) {
            // 충분히 긴 텍스트만
            authorInfo = text;
            console.log('✅ 저자 정보 찾음 (editorial reviews)');
            break;
          }
        }

        // 못 찾았으면 전체 div에서
        if (!authorInfo) {
          const text = editorialDiv.innerText.trim();
          if (text.length > 100) {
            authorInfo = text;
            console.log('✅ 저자 정보 찾음 (전체 editorial div)');
          }
        }
      }

      // ✅ 출판 정보
      let publisher = '';
      let publishDate = '';

      // detailBullets에서 찾기
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

      console.log('=== 크롤링 결과 ===');
      console.log('책 설명:', description ? `${description.length}자` : '없음');
      console.log('저자 정보:', authorInfo ? `${authorInfo.length}자` : '없음');
      console.log('출판사:', publisher || '없음');

      return {
        description,
        authorInfo,
        publisher,
        publishDate,
      };
    });

    await browser.close();

    console.log('✅ 미국 책 상세 정보 크롤링 성공');
    console.log(
      '줄거리:',
      bookDetail.description
        ? `있음 (${bookDetail.description.length}자)`
        : '없음',
    );
    console.log(
      '저자 정보:',
      bookDetail.authorInfo
        ? `있음 (${bookDetail.authorInfo.length}자)`
        : '없음',
    );

    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 미국 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: '상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});

app.get('/jp-books', async (req, res) => {
  try {
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
        // 제목 찾기
        let title = '';

        // 링크 텍스트 우선
        const linkEl =
          el.querySelector('a[href*="dsg"]') ||
          el.querySelector('a[href*="product"]');
        if (linkEl) {
          title = linkEl.innerText.trim() || linkEl.textContent.trim();
        }

        // 후보 클래스/태그
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

        // 이미지 alt/title
        if (!title) {
          const imgEl = el.querySelector('img');
          if (imgEl) title = imgEl.alt || imgEl.title || `Book ${idx + 1}`;
        }

        title = title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        // 저자 찾기
        let author = '著者不明';
        const authorEl = el.querySelector('.clearfix.ml10');
        const fallbackAuthorEl = Array.from(el.querySelectorAll('*')).find(e =>
          e.innerText?.includes('著'),
        );
        if (authorEl) author = authorEl.innerText.trim();
        else if (fallbackAuthorEl) author = fallbackAuthorEl.innerText.trim();

        // =========================
        // 이미지 찾기
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

          return el.contains(img); // img가 현재 책 div 안에 있는지 확인
        });
        const image = imgEl
          ? imgEl.src || imgEl.getAttribute('data-src') || ''
          : '';

        // 링크
        // =========================
        const linkHref = el.querySelector('a')?.getAttribute('href') || '';
        const link = linkHref
          ? linkHref.startsWith('http')
            ? linkHref
            : 'https://www.kinokuniya.co.jp' + linkHref
          : '';

        // validBooks에 추가
        validBooks.push({ title, author, image, link });
      });

      return validBooks;
    });

    await browser.close();
    console.log(`✅ 일본 베스트셀러 ${books.length}권 크롤링 성공`);
    if (books.length > 0) console.log('첫 번째 책:', books[0]);
    res.json({ books });
  } catch (err) {
    console.error('❌ Puppeteer JP 크롤링 실패:', err);
    res.status(500).json({ error: 'JP 크롤링 실패', message: err.message });
  }
});
// 📘 일본 책 상세 정보 크롤링
app.get('/jp-book-detail', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL이 필요합니다' });
    }

    console.log('📘 일본 책 상세 정보 요청:', url);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 스크롤
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const bookDetail = await page.evaluate(() => {
      console.log('=== 기노쿠니야 상세 페이지 크롤링 시작 ===');

      // ✅ 책 정보 (description)
      let description = '';
      const descEl = document.querySelector('p[itemprop="description"]');
      if (descEl) {
        description = descEl.innerText.trim();
        console.log('✅ 책 정보 찾음:', description.substring(0, 100));
      }

      // ✅ 내용 설명 (career_box의 첫 번째 섹션)
      let plot = '';
      const careerBox = document.querySelector('.career_box');
      if (careerBox) {
        // career_box 안의 모든 <p> 태그 수집
        const paragraphs = careerBox.querySelectorAll('p');
        const textParts = [];

        for (let p of paragraphs) {
          const text = p.innerText.trim();
          // itemprop="description"은 제외 (이미 위에서 처리)
          if (text && !p.hasAttribute('itemprop')) {
            textParts.push(text);
          }
        }

        // 상위 몇 개의 문단을 내용 설명으로
        if (textParts.length > 0) {
          // 첫 3개 문단 정도를 내용 설명으로 간주
          plot = textParts.slice(0, 3).join('\n\n');
          console.log('✅ 내용 설명 찾음:', plot.substring(0, 100));
        }
      }

      // ✅ 저자 소개 (career_box의 하단 - "저자 등 소개" 부분)
      let authorInfo = '';
      if (careerBox) {
        // <h3> 태그나 특정 텍스트로 저자 소개 구분
        const allText = careerBox.innerText;

        // "저자", "著者", "作者" 등의 키워드가 있는 부분 찾기
        const lines = allText.split('\n');
        let foundAuthorSection = false;
        const authorLines = [];

        for (let line of lines) {
          line = line.trim();
          if (!line) continue;

          // 저자 섹션 시작 감지
          if (
            line.includes('저자') ||
            line.includes('著者') ||
            line.includes('作者') ||
            line.includes('저자 등 소개') ||
            line.includes('著者紹介')
          ) {
            foundAuthorSection = true;
            continue;
          }

          // 저자 섹션에 있으면 수집
          if (foundAuthorSection) {
            // 다른 섹션 시작하면 중단
            if (
              line.includes('내용 설명') ||
              line.includes('内容説明') ||
              line.includes('목차') ||
              line.includes('目次')
            ) {
              break;
            }
            authorLines.push(line);
          }
        }

        if (authorLines.length > 0) {
          authorInfo = authorLines.join('\n');
          console.log('✅ 저자 소개 찾음:', authorInfo.substring(0, 100));
        }
      }

      // 출판 정보
      let publisher = '';
      let publishDate = '';

      // 테이블에서 출판 정보 찾기
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
          const th = row.querySelector('th');
          const td = row.querySelector('td');
          if (th && td) {
            const label = th.innerText.trim();
            const value = td.innerText.trim();

            if (label.includes('出版社') || label.includes('출판사')) {
              publisher = value;
            }
            if (
              label.includes('発行年月') ||
              label.includes('発売日') ||
              label.includes('발행일')
            ) {
              publishDate = value;
            }
          }
        });
      });

      console.log('=== 크롤링 결과 ===');
      console.log('책 정보:', description ? `${description.length}자` : '없음');
      console.log('내용 설명:', plot ? `${plot.length}자` : '없음');
      console.log('저자 소개:', authorInfo ? `${authorInfo.length}자` : '없음');

      return {
        description,
        plot,
        authorInfo,
        publisher,
        publishDate,
      };
    });

    await browser.close();

    console.log('✅ 일본 책 상세 정보 크롤링 성공');
    console.log(
      '책 정보:',
      bookDetail.description
        ? `있음 (${bookDetail.description.length}자)`
        : '없음',
    );
    console.log(
      '내용 설명:',
      bookDetail.plot ? `있음 (${bookDetail.plot.length}자)` : '없음',
    );
    console.log(
      '저자 소개:',
      bookDetail.authorInfo
        ? `있음 (${bookDetail.authorInfo.length}자)`
        : '없음',
    );

    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 일본 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: 'JP 상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});
app.get('/es-books', async (req, res) => {
  console.log('🇪🇸 스페인 엔드포인트 호출됨!');
  let browser = null;

  try {
    console.log('📘 스페인 크롤링 시작...');
    const url =
      'https://www.elcorteingles.es/mas-vendidos/libros/skus.department::0065/';

    browser = await puppeteer.launch({
      headless: true, // 디버깅 시 false로 변경하여 화면 확인 추천
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled', // 봇 탐지 우회
        '--window-size=1920,1080',
      ],
    });
    const page = await browser.newPage();

    // 1. 봇 탐지 우회 및 뷰포트 설정
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    // 2. 페이지 이동
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 3. [중요] 쿠키 팝업 닫기 (유럽 사이트 필수)
    try {
      const cookieSelector = '#onetrust-accept-btn-handler'; // 쿠키 동의 버튼 ID
      await page.waitForSelector(cookieSelector, { timeout: 5000 });
      await page.click(cookieSelector);
      console.log('🍪 쿠키 팝업 닫기 성공');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.log('🍪 쿠키 팝업이 없거나 이미 닫힘');
    }

    // 4. 상품 리스트 로딩 대기
    try {
      // 실제 상품 리스트 클래스가 로드될 때까지 대기
      await page.waitForSelector('.product_preview', { timeout: 10000 });
    } catch (e) {
      console.log('⚠️ 상품 리스트 선택자를 찾을 수 없음 (로딩 지연 또는 차단)');
    }

    // 5. 스크롤 (이미지 Lazy Loading 처리)
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight / 2) {
            // 절반 정도만 스크롤
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 6. 데이터 추출 (저자/제목 위치 수정 및 중복 제거)
    const books = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.product_preview'));
      const results = [];
      const seenTitles = new Set();

      items.forEach(el => {
        try {
          // [수정 포인트 1] 저자 (Author) = Brand 클래스에서 가져옴
          // El Corte Ingles는 책 저자를 'Brand' 항목에 표기함
          const brandEl = el.querySelector('.product_preview-brand');
          let author = brandEl ? brandEl.innerText.trim() : 'Autor desconocido';

          // [수정 포인트 2] 제목 (Title) = Title 클래스에서 가져옴
          const titleEl = el.querySelector('.product_preview-title');
          let title = titleEl ? titleEl.innerText.trim() : '';

          // [예외 처리] 만약 제목이 비어있고 저자 칸에 제목 같은 게 있다면 교체 (가끔 뒤바뀌는 경우 대비)
          if (!title && author && author.length > 20) {
            // 저자 칸이 너무 길면 제목일 확률이 높음 (간단한 휴리스틱)
            title = author;
            author = 'Autor desconocido';
          }

          // 이미지 추출
          const imgEl = el.querySelector('img');
          let image = '';
          if (imgEl) {
            image =
              imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '';
            if (image.startsWith('//')) {
              image = 'https:' + image;
            }
          }

          // 링크 추출
          const linkEl =
            el.querySelector('a.js-product-click') || el.querySelector('a');
          let link = '';
          if (linkEl) {
            link = linkEl.getAttribute('href') || '';
            if (link && !link.startsWith('http')) {
              link = 'https://www.elcorteingles.es' + link;
            }
          }

          // 유효성 검사 (이미지 없거나 제목 없으면 패스)
          if (
            !image ||
            image.includes('data:image') ||
            image.includes('blank')
          ) {
            return;
          }

          // 중복 제거 후 저장
          if (title && image && !seenTitles.has(title)) {
            seenTitles.add(title);
            results.push({
              title,
              author, // 이제 정확한 저자 이름이 들어갑니다
              image,
              link,
            });
          }
        } catch (innerErr) {
          console.error('개별 아이템 파싱 에러:', innerErr);
        }
      });

      return results;
    });

    console.log(`✅ 스페인 크롤링 성공: ${books.length}권`);
    if (books.length > 0) console.log('첫 번째 책:', books[0]);

    res.json({ books });
  } catch (err) {
    console.error('❌ 스페인 크롤링 실패:', err.message);
    res.status(500).json({ error: 'ES 크롤링 실패', message: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// 📘 스페인 책 상세 정보
app.get('/es-book-detail', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL이 필요합니다' });
    }

    console.log('📘 스페인 책 상세 정보 요청:', url);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 스크롤하여 동적 콘텐츠 로드
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const bookDetail = await page.evaluate(() => {
      console.log('=== El Corte Inglés 상세 페이지 크롤링 시작 ===');

      let description = '';
      let characteristics = '';
      let dimensions = '';
      let pages = '';
      let isbn = '';
      let publisher = '';

      // 1. 책 소개 (Description) 찾기
      const caracteristicasSection =
        document.querySelector('div.product_detail');
      if (caracteristicasSection) {
        const allBlocks = caracteristicasSection.querySelectorAll(
          'dl.block__container',
        );

        for (const block of allBlocks) {
          const text = block.innerText?.trim() || '';
          if (
            text.length > 200 &&
            !text.includes('ISBN') &&
            !text.includes('Dimensiones') &&
            !text.includes('páginas')
          ) {
            description = text;
            console.log('✅ 책 소개 찾음');
            break;
          }
        }
      }

      // 2. Características 전체 텍스트 가져오기
      const caracteristicasDiv = document.querySelector('div.product_detail');
      if (caracteristicasDiv) {
        const titleDiv = caracteristicasDiv.querySelector(
          'div.product_detail-title',
        );
        if (titleDiv && titleDiv.innerText.includes('Características')) {
          characteristics = caracteristicasDiv.innerText?.trim() || '';
        }
      }

      // 3. 개별 정보 파싱
      const dimensionsMatch = characteristics.match(
        /Dimensiones[:\s]+([^\n]+)/i,
      );
      if (dimensionsMatch) {
        dimensions = dimensionsMatch[1].trim();
      }

      const pagesMatch = characteristics.match(
        /N[º°]\s*de\s*páginas[:\s]+(\d+)/i,
      );
      if (pagesMatch) {
        pages = pagesMatch[1].trim();
      }

      const isbnMatch = characteristics.match(/ISBN[:\s]+([0-9]+)/i);
      if (isbnMatch) {
        isbn = isbnMatch[1].trim();
      }

      const publisherMatch = characteristics.match(/Editorial[:\s]+([^\n]+)/i);
      if (publisherMatch) {
        publisher = publisherMatch[1].trim();
      }

      // 4. "EL LIBRO MÁS ESPERADO DEL AÑO" 같은 소개 텍스트 찾기
      if (!description) {
        const allParagraphs = document.querySelectorAll('p');
        for (const p of allParagraphs) {
          const text = p.innerText?.trim() || '';
          if (
            text.length > 100 &&
            (text.includes('libro') ||
              text.includes('memorias') ||
              text.includes('historia'))
          ) {
            description = text;
            console.log('✅ 책 소개 찾음 (p 태그)');
            break;
          }
        }
      }

      // 5. block__container에서 긴 텍스트 찾기
      if (!description) {
        const allBlocks = document.querySelectorAll('dl.block__container');
        for (const block of allBlocks) {
          const text = block.innerText?.trim() || '';
          if (
            text.length > 150 &&
            !text.includes('ISBN') &&
            !text.includes('Dimensiones')
          ) {
            description = text;
            console.log('✅ 책 소개 찾음 (block__container)');
            break;
          }
        }
      }

      console.log('=== 크롤링 결과 ===');
      console.log('책 소개:', description ? `${description.length}자` : '없음');
      console.log(
        'Characteristics:',
        characteristics ? `${characteristics.length}자` : '없음',
      );
      console.log('Dimensions:', dimensions || '없음');
      console.log('Pages:', pages || '없음');
      console.log('ISBN:', isbn || '없음');
      console.log('Publisher:', publisher || '없음');

      return {
        description,
        characteristics,
        dimensions,
        pages,
        isbn,
        publisher,
      };
    });

    await browser.close();

    console.log('✅ 스페인 책 상세 정보 크롤링 성공');
    console.log(
      '책 소개:',
      bookDetail.description
        ? `있음 (${bookDetail.description.length}자)`
        : '없음',
    );

    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 스페인 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: '스페인 상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});

app.listen(4000, () => console.log(`🚀 JP Server running on port 4000`));
app.listen(4000, () => console.log('🚀 Amazon Server running on port 4000'));
app.listen(4000, () => console.log('🚀 Server running on port 4000'));
