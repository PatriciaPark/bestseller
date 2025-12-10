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
  try {
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
    console.log(`✅ Amazon ES 크롤링 성공: ${books.length}권`);
    res.json({ books });
  } catch (err) {
    console.error('❌ Amazon ES Puppeteer 크롤링 실패:', err);
    res.status(500).json({ error: 'ES 크롤링 실패', message: err.message });
  }
});
app.get('/es-book-detail', async (req, res) => {
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

      function getTextFromNode(node) {
        if (!node) return '';
        return [...node.querySelectorAll('span, p, div')]
          .map(el => el.innerText.trim())
          .filter(t => t.length > 0)
          .join('\n');
      }

      // ================================
      // 1) 책 설명 (Book Description)
      // ================================
      let description = '';

      // expander 강제 클릭
      try {
        const expander = document.querySelector(
          '#bookDescription_feature_div .a-expander-header',
        );
        if (expander) {
          expander.click();
          console.log('📌 expander 클릭 성공');
        }
      } catch (e) {
        console.log('❌ expander 클릭 실패');
      }

      // expander 내부 내용 가져오기
      const descContainer = document.querySelector(
        '#bookDescription_feature_div .a-expander-content',
      );

      if (descContainer) {
        description = getTextFromNode(descContainer);
        if (description.length > 30)
          console.log('📌 설명 가져오기 성공 (expander 내부)');
      }

      // 혹시 못 찾으면 전체 span에서 검색
      if (!description || description.length < 30) {
        const spans = document.querySelectorAll(
          '#bookDescription_feature_div span',
        );
        for (let span of spans) {
          const txt = span.innerText.trim();
          if (txt.length > 30) {
            description = txt;
            console.log('📌 설명 가져오기 성공 (fallback span)');
            break;
          }
        }
      }

      // ================================
      // 2) 저자 정보 (Editorial Reviews)
      // ================================
      let authorInfo = '';
      const editorial = document.querySelector('#editorialReviews_feature_div');

      if (editorial) {
        const txt = getTextFromNode(editorial);
        if (txt.length > 50) {
          authorInfo = txt;
          console.log('📌 저자 소개 추출 성공');
        }
      }

      // ================================
      // 3) 출판 정보
      // ================================
      let publisher = '';
      let publishDate = '';

      const liItems = document.querySelectorAll(
        '#detailBullets_feature_div li, #detailBulletsWrapper_feature_div li',
      );

      liItems.forEach(li => {
        const text = li.innerText || '';

        if (text.includes('Editorial') || text.includes('Publisher')) {
          publisher = text.split(':')[1]?.trim() || '';
        }
        if (
          text.includes('Fecha de publicación') ||
          text.includes('Publication')
        ) {
          publishDate = text.split(':')[1]?.trim() || '';
        }
      });

      return {
        description,
        authorInfo,
        publisher,
        publishDate,
      };
    });

    await browser.close();

    console.log('✅ 스페인 책 상세 정보 크롤링 성공');
    console.log(
      '줄거리:',
      bookDetail.description
        ? `있음 (${bookDetail.description.length}자)`
        : '없음',
    );
    console.log(
      '저자 소개:',
      bookDetail.authorInfo
        ? `있음 (${bookDetail.authorInfo.length}자)`
        : '없음',
    );

    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 스페인 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: '상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});
app.listen(4000, () => console.log(`🚀 JP Server running on port 4000`));
app.listen(4000, () => console.log('🚀 Amazon Server running on port 4000'));
app.listen(4000, () => console.log('🚀 Server running on port 4000'));
