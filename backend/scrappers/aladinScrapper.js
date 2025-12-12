// import fs from 'fs';
// import path from 'path';
// import puppeteer from 'puppeteer';

// function sleep(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

// async function fetchPageBooks(browser) {
//   const page = await browser.newPage();
//   const url = 'https://www.aladin.co.kr/shop/common/wbest.aspx?BranchType=1';
//   await page.goto(url, { waitUntil: 'networkidle2' });
//   await sleep(2000);

//   const { books, links } = await page.evaluate(() => {
//     const books = [];
//     const links = [];

//     const boxes = document.querySelectorAll('.ss_book_box');
//     for (let i = 0; i < boxes.length && books.length < 20; i++) {
//       const box = boxes[i];
//       const titleEl = box.querySelector('a.bo3');
//       const title = titleEl?.innerText.trim() || '';
//       const detailHref = titleEl?.href || '';
//       const coverImage = box.querySelector('.front_cover')?.src || '';
//       const author = box.querySelector('.ss_book_list ul li:nth-child(3) a:nth-child(1)')?.innerText.trim() || '';
//       // const publisher = box.querySelector('.ss_book_list ul li:nth-child(3) a:nth-child(2)')?.innerText.trim() || '';

//       if (title && author && coverImage && detailHref) {
//         books.push({ title, author, coverImage });
//         links.push(detailHref);
//       }
//     }

//     return { books, links };
//   });

//   await page.close();
//   return { books, links };
// }

// async function fetchBookDetail(browser, link) {
//   const detailPage = await browser.newPage();
//   await detailPage.goto(link, { waitUntil: 'networkidle2' });
//   await sleep(1000);

//   const data = await detailPage.evaluate(() => {
//     const writerInfo = document.querySelector("div[id^='div_AuthorInfo_'][id$='_Short']")?.innerText.trim() || '';
//     const contents = document.querySelector("div#tocTemplate div[id^='div_TOC_'][id$='_Short']")?.innerText.trim() || '';
//     const publisherReview = document.querySelector('div.Ere_prod_mconts_R')?.innerText.trim() || '';

//     return { writerInfo, contents, publisherReview };
//   });

//   await detailPage.close();
//   return data;
// }

// export default async function aladinScrapper() {
//   const startTime = Date.now();
//   const browser = await puppeteer.launch({
//     headless: true,
//     args: ['--no-sandbox', '--disable-setuid-sandbox'],
//   });

//   console.log('🚀 Fetching Aladin bestseller list...');
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
//           : { writerInfo: '', contents: '', publisherReview: '' };
//       batchBooks[idx].link = batchLinks[idx]; // link 추가
//       batchBooks[idx].writerInfo = data.writerInfo;
//       batchBooks[idx].contents = data.contents;
//       batchBooks[idx].publisherReview = data.publisherReview;
//       console.log(`${i + idx + 1}. ${batchBooks[idx].title} ✅`);
//     });
//   }

//   const resultPath = path.join(process.cwd(), './json_results/aladin.json');
//   fs.writeFileSync(resultPath, JSON.stringify(books, null, 2), 'utf-8');

//   console.log(`✅ Crawled ${books.length} books and saved to aladin.json`);
//   console.log(`⏱ Done in ${(Date.now() - startTime) / 1000}s`);
//   await browser.close();
// }

// // Run directly
// aladinScrapper();