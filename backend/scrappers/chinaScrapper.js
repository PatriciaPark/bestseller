import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPageBooks(browser) {
    const page = await browser.newPage();
    const url = 'https://www.bookschina.com/24hour';
    await page.goto(url, { waitUntil: 'networkidle2' });
    await sleep(2000);

    const { books, links } = await page.evaluate(() => {
        const books = [];
        const links = [];

        const items = document.querySelectorAll('#container div div.listLeft div.bookList ul li');
        for (let i = 0; i < items.length; i++) {
            if (books.length >= 30) break;

            const li = items[i];
            const detailHref = li.querySelector('div.infor h2 a')?.href || '';
            const title = li.querySelector('div.infor h2 a')?.innerText || '';
            const image = li.querySelector('div.cover a img')?.src || '';
            const author = li.querySelector('div.infor div.author a')?.innerText || '';

            if (title && author && image && detailHref) {
                books.push({ title, author, image, detailHref });
                links.push(detailHref);
            }
        };

        return { books, links };
    });

    await page.close();
    return { books, links };
}

async function fetchBookDetail(browser, link) {
    const detailPage = await browser.newPage();
    await detailPage.goto(link, { waitUntil: 'networkidle2' });

    const data = await detailPage.evaluate(() => {
        const description = document.querySelector('#brief p')?.innerText.trim() || '';
        const extraSections = [
            document.querySelector('#catalogSwitch')?.innerText.trim() || '',
            document.querySelector('#mindbook')?.innerText.trim() || ''
        ].filter(Boolean);
        const other = extraSections.join('\n\n');
        const writerInfo = document.querySelector('#zuozhejianjie p')?.innerText.trim() || '';
        return { description, other, writerInfo };
    });

    await detailPage.close();
    return data;
}

export default async function chinaScrapper() {
    const startTime = Date.now();
    const date = new Date();
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const { books, links } = await fetchPageBooks(browser);
    const concurrency = 5;

    for (let i = 0; i < books.length; i += concurrency) {
        const batchBooks = books.slice(i, i + concurrency);
        const batchLinks = links.slice(i, i + concurrency);

        const results = await Promise.allSettled(
        batchLinks.map(link => fetchBookDetail(browser, link))
        );

        results.forEach((res, idx) => {
            const data = res.status === 'fulfilled' ? res.value : { description: '', other: '', writerInfo: '' }; 
            batchBooks[idx].description = data.description;
            batchBooks[idx].other = data.other;
            batchBooks[idx].writerInfo = data.writerInfo;
            console.log(`${i + idx + 1}. ${batchBooks[idx].title} ✅`);
        });
    }

    const outputDir = path.join(process.cwd(), 'json_results');
        // Create folder if it doesn't exist
        if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        }
    const resultPath = path.join(outputDir, 'china.json');
    const sanitized = books.map(toPublicBook);
    fs.writeFileSync(resultPath, JSON.stringify(sanitized, null, 2), 'utf-8');

    console.log(`✅ Crawled ${books.length} books`);
    console.log(`💾 Saved to ${resultPath}`);
    console.log(`📆 Date ${date.getDate()}`);
    console.log(`⏱ Done in ${(Date.now() - startTime) / 1000}s`);
    await browser.close();
}

function toPublicBook(raw) {
    const fallback = value => (value || '').trim();
    return {
        image: fallback(raw.image),
        link: fallback(raw.detailHref),
        title: fallback(raw.title),
        author: fallback(raw.author),
        writerInfo: fallback(raw.writerInfo),
        description: fallback(raw.description),
        other: fallback(raw.other),
    };
}

// Run directly
chinaScrapper();