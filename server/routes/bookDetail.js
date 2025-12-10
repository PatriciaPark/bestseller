import express from 'express';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const router = express.Router();

/**
 * 한국 책 상세 정보
 */
router.get('/kr-book-detail', async (req, res) => {
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
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 스크롤하여 동적 콘텐츠 로드
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    const bookDetail = await page.evaluate(() => {
      let writerInfo = '';
      let contents = '';
      let publisherReview = '';

      // 1. 저자 정보 찾기 - 다양한 방법 시도
      // 방법 1: 기본 셀렉터
      const authorDivs = document.querySelectorAll(
        "div[id^='div_AuthorInfo_']",
      );
      for (const div of authorDivs) {
        const text = div.innerText?.trim() || '';
        if (
          text.length > 50 &&
          !text.includes('ISBN') &&
          !text.includes('쪽')
        ) {
          writerInfo = text;
          break;
        }
      }

      // 방법 2: Ere_prod_mconts_box에서 "저자" 키워드 찾기
      if (!writerInfo) {
        const ereBoxes = document.querySelectorAll('.Ere_prod_mconts_box');
        for (const box of ereBoxes) {
          const title =
            box.querySelector('.Ere_prod_mconts_LL')?.innerText?.trim() || '';
          const content =
            box.querySelector('.Ere_prod_mconts_R')?.innerText?.trim() || '';
          if (
            (title.includes('저자') || title.includes('작가')) &&
            content.length > 50
          ) {
            writerInfo = content;
            break;
          }
        }
      }

      // 방법 3: 모든 텍스트에서 "저자" 키워드 포함된 섹션 찾기
      if (!writerInfo) {
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
          const text = div.innerText?.trim() || '';
          if (
            text.length > 100 &&
            (text.includes('저자') || text.includes('작가')) &&
            !text.includes('ISBN') &&
            !text.includes('쪽') &&
            !text.includes('mm')
          ) {
            writerInfo = text;
            break;
          }
        }
      }

      // 2. 목차/책 소개 찾기
      // 방법 1: 기본 셀렉터
      const tocDivs = document.querySelectorAll("div[id^='div_TOC_']");
      for (const div of tocDivs) {
        const text = div.innerText?.trim() || '';
        if (text.length > 50) {
          contents = text;
          break;
        }
      }

      // 방법 2: tocTemplate에서 찾기
      if (!contents) {
        const tocTemplate = document.querySelector('#tocTemplate');
        if (tocTemplate) {
          const text = tocTemplate.innerText?.trim() || '';
          if (text.length > 50) {
            contents = text;
          }
        }
      }

      // 방법 3: Ere_prod_mconts_box에서 "목차" 또는 "책소개" 키워드 찾기
      if (!contents) {
        const ereBoxes = document.querySelectorAll('.Ere_prod_mconts_box');
        for (const box of ereBoxes) {
          const title =
            box.querySelector('.Ere_prod_mconts_LL')?.innerText?.trim() || '';
          const content =
            box.querySelector('.Ere_prod_mconts_R')?.innerText?.trim() || '';
          if (
            (title.includes('목차') ||
              title.includes('책소개') ||
              title.includes('책 소개')) &&
            content.length > 50 &&
            !content.includes('ISBN') &&
            !content.includes('쪽')
          ) {
            contents = content;
            break;
          }
        }
      }

      // 3. 출판사 리뷰 찾기 (ISBN, 쪽 등이 없는 실제 리뷰)
      const ereBoxes = document.querySelectorAll('.Ere_prod_mconts_box');
      for (const box of ereBoxes) {
        const title =
          box.querySelector('.Ere_prod_mconts_LL')?.innerText?.trim() || '';
        const content =
          box.querySelector('.Ere_prod_mconts_R')?.innerText?.trim() || '';
        if (
          (title.includes('출판사') ||
            title.includes('리뷰') ||
            title.includes('추천')) &&
          content.length > 100 &&
          !content.includes('ISBN') &&
          !content.includes('쪽') &&
          !content.includes('mm')
        ) {
          publisherReview = content;
          break;
        }
      }

      return {
        description: contents, // 책 소개 (목차 정보)
        plot: '', // 한국은 plot 정보 없음
        authorInfo: writerInfo, // 저자소개
        publisherReview: publisherReview, // 출판사 리뷰
      };
    });

    await browser.close();

    console.log('✅ 한국 책 상세 정보 크롤링 성공');
    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 한국 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: '상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});

/**
 * 미국 책 상세 정보
 */
router.get('/us-book-detail', async (req, res) => {
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

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const bookDetail = await page.evaluate(() => {
      let description = '';

      const expanderButtons = document.querySelectorAll(
        '[data-a-expander-name="book_description_expander"]',
      );
      expanderButtons.forEach(btn => {
        if (btn.click) btn.click();
      });

      const bookDescDiv = document.querySelector(
        '#bookDescription_feature_div',
      );
      if (bookDescDiv) {
        const expanderContent = bookDescDiv.querySelector(
          '.a-expander-content',
        );
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

      const editorialDiv = document.querySelector(
        '#editorialReviews_feature_div',
      );
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

      return {
        description,
        authorInfo,
        publisher,
        publishDate,
      };
    });

    await browser.close();

    console.log('✅ 미국 책 상세 정보 크롤링 성공');
    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 미국 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: '상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});

/**
 * 일본 책 상세 정보
 */
router.get('/jp-book-detail', async (req, res) => {
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

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const bookDetail = await page.evaluate(() => {
      let description = '';
      const descEl = document.querySelector('p[itemprop="description"]');
      if (descEl) {
        description = descEl.innerText.trim();
      }

      let plot = '';
      const careerBox = document.querySelector('.career_box');
      if (careerBox) {
        const paragraphs = careerBox.querySelectorAll('p');
        const textParts = [];

        for (let p of paragraphs) {
          const text = p.innerText.trim();
          if (text && !p.hasAttribute('itemprop')) {
            textParts.push(text);
          }
        }

        if (textParts.length > 0) {
          plot = textParts.slice(0, 3).join('\n\n');
        }
      }

      let authorInfo = '';
      if (careerBox) {
        const allText = careerBox.innerText;
        const lines = allText.split('\n');
        let foundAuthorSection = false;
        const authorLines = [];

        for (let line of lines) {
          line = line.trim();
          if (!line) continue;

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

          if (foundAuthorSection) {
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
        }
      }

      let publisher = '';
      let publishDate = '';

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
    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 일본 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: 'JP 상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});

/**
 * 대만 책 상세 정보 (books.com.tw)
 */
router.get('/tw-book-detail', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL이 필요합니다' });
    }

    console.log('📘 대만 책 상세 정보 요청:', url);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 스크롤하여 동적 콘텐츠 로드
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    const bookDetail = await page.evaluate(() => {
      let contents = '';
      let outline = '';
      let writerInfo = '';

      // 1. 책 소개 (contents) 찾기
      // 방법 1: 기본 셀렉터
      const firstContent = document.querySelector(
        'body div.container_24.main_wrap.clearfix div.grid_19.alpha div.content:first-of-type',
      );
      if (firstContent) {
        const text = firstContent.innerText?.trim() || '';
        if (text.length > 100) {
          contents = text;
        }
      }

      // 방법 2: 모든 content div를 확인
      if (!contents) {
        const allContents = document.querySelectorAll(
          'body div.container_24.main_wrap.clearfix div.grid_19.alpha div.content',
        );
        for (let i = 0; i < allContents.length; i++) {
          const text = allContents[i]?.innerText?.trim() || '';
          // 첫 번째 긴 텍스트가 책 소개일 가능성이 높음
          if (
            text.length > 200 &&
            !text.includes('作者') &&
            !text.includes('著者')
          ) {
            contents = text;
            break;
          }
        }
      }

      // 2. 줄거리 (outline) 찾기
      // 방법 1: 기본 셀렉터
      const outlineH2 = document.querySelector(
        '#M201105_0_getProdTextInfo_P00a400020009_h2',
      );
      if (outlineH2) {
        const text = outlineH2.innerText?.trim() || '';
        if (text.length > 50) {
          outline = text;
        } else {
          // h2 다음 형제 요소 확인
          let nextEl = outlineH2.nextElementSibling;
          while (nextEl && outline.length < 50) {
            const text = nextEl.innerText?.trim() || '';
            if (text.length > 50) {
              outline = text;
              break;
            }
            nextEl = nextEl.nextElementSibling;
          }
        }
      }

      // 방법 2: "內容簡介" 또는 "內容說明" 키워드로 찾기
      if (!outline) {
        const allH2 = document.querySelectorAll('h2');
        for (const h2 of allH2) {
          const title = h2.innerText?.trim() || '';
          if (
            title.includes('內容簡介') ||
            title.includes('內容說明') ||
            title.includes('內容介紹')
          ) {
            let nextEl = h2.nextElementSibling;
            while (nextEl && outline.length < 50) {
              const text = nextEl.innerText?.trim() || '';
              if (text.length > 50) {
                outline = text;
                break;
              }
              nextEl = nextEl.nextElementSibling;
            }
            if (outline) break;
          }
        }
      }

      // 3. 저자 정보 (writerInfo) 찾기
      // 방법 1: 기본 셀렉터 (두 번째 content)
      const allContents = document.querySelectorAll(
        'body div.container_24.main_wrap.clearfix div.grid_19.alpha div.content',
      );
      for (let i = 0; i < allContents.length; i++) {
        const text = allContents[i]?.innerText?.trim() || '';
        // 저자 관련 키워드가 포함된 경우
        if (
          text &&
          (text.includes('作者') ||
            text.includes('著者') ||
            text.includes('作家') ||
            text.includes('作者簡介') ||
            text.includes('著者紹介'))
        ) {
          writerInfo = text;
          break;
        }
      }

      // 방법 2: 모든 텍스트에서 저자 정보 찾기
      if (!writerInfo) {
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
          const text = div.innerText?.trim() || '';
          if (
            text.length > 100 &&
            (text.includes('作者') || text.includes('著者')) &&
            !text.includes('內容簡介') &&
            !text.includes('內容說明')
          ) {
            writerInfo = text;
            break;
          }
        }
      }

      return {
        description: contents, // 책 소개
        plot: outline, // 줄거리
        authorInfo: writerInfo, // 저자소개
        tableOfContents: '', // 목차는 별도로 크롤링하지 않음
      };
    });

    await browser.close();

    console.log('✅ 대만 책 상세 정보 크롤링 성공');
    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 대만 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: '대만 상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});

/**
 * 프랑스 책 상세 정보 (Amazon.fr)
 */
router.get('/fr-book-detail', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL이 필요합니다' });
    }

    console.log('📘 프랑스 책 상세 정보 요청:', url);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    );

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 스크롤하여 동적 콘텐츠 로드
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // expander 버튼 클릭하여 내용 펼치기
    try {
      const expanderButtons = await page.$$(
        '[data-a-expander-name="book_description_expander"]',
      );
      for (const btn of expanderButtons) {
        await btn.click();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.log('⚠️ Expander 버튼 클릭 실패 (무시):', err.message);
    }

    // 추가 스크롤
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    const bookDetail = await page.evaluate(() => {
      let contents = '';
      let review = '';
      let writerInfo = '';

      // 1. 책소개 (contents) 찾기
      // 방법 1: 기본 셀렉터
      const descDiv = document.querySelector('#bookDescription_feature_div');
      if (descDiv) {
        const expanderContent = descDiv.querySelector(
          'div.a-expander-content.a-expander-partial-collapse-content',
        );
        if (expanderContent) {
          contents = expanderContent.innerText?.trim() || '';
        }
        // expander content가 없으면 다른 방법 시도
        if (!contents) {
          const spans = descDiv.querySelectorAll('span');
          for (const span of spans) {
            const text = span.innerText?.trim() || '';
            if (text.length > 100) {
              contents = text;
              break;
            }
          }
        }
      }

      // 2. 출판사 리뷰 (review) 찾기
      const editorialDiv = document.querySelector(
        '#editorialReviews_feature_div',
      );
      if (editorialDiv) {
        // 방법 1: 기본 셀렉터
        const section = editorialDiv.querySelector(
          'div.a-section.a-spacing-small.a-padding-base',
        );
        if (section) {
          review = section.innerText?.trim() || '';
        }
        // 방법 2: 모든 섹션 확인
        if (!review) {
          const sections = editorialDiv.querySelectorAll('div.a-section');
          for (const sec of sections) {
            const text = sec.innerText?.trim() || '';
            if (text.length > 100) {
              review = text;
              break;
            }
          }
        }
      }

      // 3. 저자 정보 (writerInfo) 찾기
      // 방법 1: 기본 셀렉터
      const authorCard = document.querySelector(
        'div._about-the-author-card_style_cardContentDiv__FXLPd',
      );
      if (authorCard) {
        const cardBody = authorCard.querySelector(
          'div.a-fixed-left-grid-col.a-col-right div.a-cardui-body',
        );
        if (cardBody) {
          writerInfo = cardBody.innerText?.trim() || '';
        }
      }

      // 방법 2: 대체 셀렉터
      if (!writerInfo) {
        const authorSelectors = [
          'div[data-card-type="about-the-author"]',
          'div#author_feature_div',
          'div.a-section.a-spacing-small:has-text("About the Author")',
        ];
        for (const selector of authorSelectors) {
          try {
            const el = document.querySelector(selector);
            if (el) {
              const text = el.innerText?.trim() || '';
              if (text.length > 100) {
                writerInfo = text;
                break;
              }
            }
          } catch (e) {}
        }
      }

      // 방법 3: 모든 텍스트에서 "About the Author" 또는 "À propos de l'auteur" 찾기
      if (!writerInfo) {
        const allDivs = document.querySelectorAll('div');
        for (const div of allDivs) {
          const text = div.innerText?.trim() || '';
          if (
            text.length > 100 &&
            (text.includes('About the Author') ||
              text.includes("À propos de l'auteur") ||
              text.includes("Biographie de l'auteur"))
          ) {
            writerInfo = text;
            break;
          }
        }
      }

      return {
        description: contents, // 책소개
        publisherReview: review, // 출판사 리뷰
        authorInfo: writerInfo, // 저자소개
      };
    });

    await browser.close();

    console.log('✅ 프랑스 책 상세 정보 크롤링 성공');
    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 프랑스 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: '프랑스 상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});
router.get('/es-book-detail', async (req, res) => {
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

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const bookDetail = await page.evaluate(() => {
      let description = '';

      const expanderButtons = document.querySelectorAll(
        '[data-a-expander-name="book_description_expander"]',
      );
      expanderButtons.forEach(btn => {
        if (btn.click) btn.click();
      });

      const bookDescDiv = document.querySelector(
        '#bookDescription_feature_div',
      );
      if (bookDescDiv) {
        const expanderContent = bookDescDiv.querySelector(
          '.a-expander-content',
        );
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

      const editorialDiv = document.querySelector(
        '#editorialReviews_feature_div',
      );
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

      return {
        description,
        authorInfo,
        publisher,
        publishDate,
      };
    });

    await browser.close();

    console.log('✅ 스페인 책 상세 정보 크롤링 성공');
    res.json(bookDetail);
  } catch (err) {
    console.error('❌ 스페인 책 상세 정보 크롤링 실패:', err);
    res.status(500).json({
      error: '상세 정보 크롤링 실패',
      message: err.message,
    });
  }
});

export default router;
