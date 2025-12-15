// import fs from 'fs';
// import path from 'path';
// import puppeteer from 'puppeteer';

// function sleep(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

// async function fetchPageBooks(browser) {
//   const page = await browser.newPage();
//   const url = 'https://www.kinokuniya.co.jp/disp/CKnRankingPageCList.jsp?dispNo=107002001001&vTp=w';
//   await page.goto(url, { waitUntil: 'networkidle2' });
//   await sleep(5000);

//   const { books, links } = await page.evaluate(() => {
//     const books = [];
//     const links = [];

//     const items = Array.from(document.querySelectorAll('.list_area_wrap div'));
//     const allImages = Array.from(document.querySelectorAll('img'));

//     items.slice(0, 20).forEach((el, idx) => {
//       let title = '';
//       const linkEl = el.querySelector('a[href*="dsg"]') || el.querySelector('a[href*="product"]');
//       if (linkEl) {
//         title = linkEl.innerText.trim() || linkEl.textContent.trim();
//       }

//       if (!title) {
//         const titleElements = [
//           el.querySelector('.booksname'),
//           el.querySelector('[class*="title"]'),
//           el.querySelector('h3'),
//           el.querySelector('h4'),
//           el.querySelector('strong'),
//           el.querySelector('span[class*="name"]'),
//         ];

//         for (let el2 of titleElements) {
//           if (el2 && el2.innerText.trim()) {
//             title = el2.innerText.trim();
//             break;
//           }
//         }
//       }

//       if (!title) {
//         const imgEl = el.querySelector('img');
//         if (imgEl) title = imgEl.alt || imgEl.title || `Book ${idx + 1}`;
//       }

//       title = title.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

//       let author = '著者不明';
//       const authorEl = el.querySelector('.clearfix.ml10');
//       const fallbackAuthorEl = Array.from(el.querySelectorAll('*')).find(e =>
//         e.innerText?.includes('著'),
//       );
//       if (authorEl) author = authorEl.innerText.trim();
//       else if (fallbackAuthorEl) author = fallbackAuthorEl.innerText.trim();

//       const imgEl = allImages.find(img => {
//         const src = img.src || img.getAttribute('data-src') || '';
//         if (!src) return false;
//         if (
//           src.includes('ranking') ||
//           src.includes('number') ||
//           src.includes('icon') ||
//           src.includes('logo') ||
//           src.includes('banner') ||
//           src.includes('service') ||
//           src.includes('event') ||
//           src.includes('business') ||
//           src.includes('store-event') ||
//           src.includes('inc/')
//         )
//           return false;
//         if (
//           !(
//             src.includes('product') ||
//             src.includes('goods') ||
//             src.includes('item')
//           )
//         )
//           return false;
//         return el.contains(img);
//       });
//       const image = imgEl
//         ? imgEl.src || imgEl.getAttribute('data-src') || ''
//         : '';

//       const linkHref = el.querySelector('a')?.getAttribute('href') || '';
//       const link = linkHref
//         ? linkHref.startsWith('http')
//           ? linkHref
//           : 'https://www.kinokuniya.co.jp' + linkHref
//         : '';

//       if (title && author && image && link) {
//         books.push({ title, author, image });
//         links.push(link);
//       }
//     });

//     return { books, links };
//   });

//   await page.close();
//   return { books, links };
// }

// async function fetchBookDetail(browser, link) {
//   const detailPage = await browser.newPage();
//   try {
//     await detailPage.goto(link, { waitUntil: 'networkidle2', timeout: 30000 });
//     await sleep(3000);

//     await detailPage.evaluate(() => {
//       window.scrollTo(0, document.body.scrollHeight / 2);
//     });
//     await sleep(2000);

//     const data = await detailPage.evaluate(() => {
//       let description = '';
//       const descEl = document.querySelector('p[itemprop="description"]');
//       if (descEl) {
//         description = descEl.innerText.trim();
//       }

//       let plot = '';
//       const careerBox = document.querySelector('.career_box');
//       if (careerBox) {
//         const paragraphs = careerBox.querySelectorAll('p');
//         const textParts = [];

//         for (let p of paragraphs) {
//           const text = p.innerText.trim();
//           if (text && !p.hasAttribute('itemprop')) {
//             textParts.push(text);
//           }
//         }

//         if (textParts.length > 0) {
//           plot = textParts.slice(0, 3).join('\n\n');
//         }
//       }

//       let writerInfo = '';
//       if (careerBox) {
//         const allText = careerBox.innerText;
//         const lines = allText.split('\n');
//         let foundAuthorSection = false;
//         const authorLines = [];

//         for (let line of lines) {
//           line = line.trim();
//           if (!line) continue;

//           if (
//             line.includes('저자') ||
//             line.includes('著者') ||
//             line.includes('作者') ||
//             line.includes('저자 등 소개') ||
//             line.includes('著者紹介')
//           ) {
//             foundAuthorSection = true;
//             continue;
//           }

//           if (foundAuthorSection) {
//             if (
//               line.includes('내용 설명') ||
//               line.includes('内容説明') ||
//               line.includes('목차') ||
//               line.includes('目次')
//             ) {
//               break;
//             }
//             authorLines.push(line);
//           }
//         }

//         if (authorLines.length > 0) {
//           writerInfo = authorLines.join('\n');
//         }
//       }

//       return {
//         description,
//         plot,
//         writerInfo,
//       };
//     });

//     await detailPage.close();
//     return data;
//   } catch (err) {
//     await detailPage.close();
//     console.error(`⚠️ 상세 정보 크롤링 실패 (${link}):`, err.message);
//     return { description: '', plot: '', writerInfo: '' };
//   }
// }

// export default async function jpScrapper() {
//   const startTime = Date.now();
//   const date = new Date();
//   const browser = await puppeteer.launch({
//     headless: true,
//     args: ['--no-sandbox', '--disable-setuid-sandbox'],
//   });

//   console.log('🚀 Fetching Japan (Kinokuniya) bestseller list...');
//   const { books, links } = await fetchPageBooks(browser);
//   const concurrency = 5;

//   for (let i = 0; i < books.length; i += concurrency) {
//     const batchBooks = books.slice(i, i + concurrency);
//     const batchLinks = links.slice(i, i + concurrency);

//     const results = await Promise.allSettled(
//       batchLinks.map(link => fetchBookDetail(browser, link))
//     );

//     results.forEach((res, idx) => {
//       const data =
//         res.status === 'fulfilled'
//           ? res.value
//           : { description: '', plot: '', writerInfo: '' };
//       batchBooks[idx].link = batchLinks[idx];
//       batchBooks[idx].description = data.description || '';
//       batchBooks[idx].contents = data.description || '';
//       batchBooks[idx].plot = data.plot || '';
//       batchBooks[idx].outline = data.plot || '';
//       batchBooks[idx].writerInfo = data.writerInfo || '';
//       batchBooks[idx].authorInfo = data.writerInfo || '';
//       console.log(`${i + idx + 1}. ${batchBooks[idx].title} ✅`);
//     });
//   }

//   const resultPath = path.join(process.cwd(), '../json_results/jpbooks.json');
//   fs.writeFileSync(resultPath, JSON.stringify(books, null, 2), 'utf-8');

//   console.log(`✅ Crawled ${books.length} books and saved to jpbooks.json`);
//   console.log(`⏱ Done in ${(Date.now() - startTime) / 1000}s`);
//   await browser.close();
// }

// // Run directly
// jpScrapper();