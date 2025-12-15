import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPageBooks(browser) {
    const page = await browser.newPage();
    const url = 'https://www.amazon.fr/gp/bestsellers/books?utm_source=chatgpt.com';
    await page.goto(url, { waitUntil: 'networkidle2' });
    await sleep(2000);

    const { books, links } = await page.evaluate(() => {
        const books = [];
        const links = [];

        const items = document.querySelectorAll('ol li.zg-no-numbers');
        for (let i = 0; i < items.length; i++) {
            if (books.length >= 30) break;

            const li = items[i];
            const detailHref = li.querySelector('div a.a-link-normal')?.href || '';
            const title = li.querySelector('div a.a-link-normal span div')?.innerText || '';
            const image = li.querySelector('div.a-section img')?.src || '';
            const author = li.querySelector('div a.a-size-small div')?.innerText || '';

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
        const description = document.querySelector('#bookDescription_feature_div div.a-expander-content.a-expander-partial-collapse-content')?.innerText.trim() || '';
        const reviewSection = document.querySelector('#editorialReviews_feature_div div.a-section.a-spacing-small.a-padding-base')?.innerText.trim() || '';
        const writerInfo = document.querySelector('div._about-the-author-card_style_cardContentDiv__FXLPd div.a-fixed-left-grid-col.a-col-right div.a-cardui-body')?.innerText.trim() || '';
        return { description, other: reviewSection, writerInfo };
    });

    await detailPage.close();
    return data;
}

export default async function amazonScrapper() {
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
    const resultPath = path.join(outputDir, 'france.json');
    const sanitized = books.map(toPublicBook);
    fs.writeFileSync(resultPath, JSON.stringify(sanitized, null, 2), 'utf-8');

    console.log(`✅ Crawled ${books.length} books`);
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
amazonScrapper();