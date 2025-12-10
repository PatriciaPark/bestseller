import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPageBooks(browser) {
    const page = await browser.newPage();
    const url = "https://www.books.com.tw/web/sys_saletopb/books/?attribute=";
    await page.goto(url, { waitUntil: "networkidle2" });
    await sleep(2000);

    const { books, links } = await page.evaluate(() => {
        const books = [];
        const links = [];

        const items = document.querySelectorAll("ul.clearfix li");
        for (let i = 0; i < items.length; i++) {
            if (books.length >= 30) break;

            const li = items[i];
            const title = li.querySelector("div.type02_bd-a h4 a")?.innerText.trim() || "";
            const detailHref = li.querySelector("a")?.href || "";
            const image = li.querySelector("a img")?.src || "";
            const author = li.querySelector("div.type02_bd-a ul.msg li a")?.innerText.trim() || "";

            if (title && author && image && detailHref) {
                books.push({ title, author, image, detailHref });
                links.push(detailHref);
            }
        }

        return { books, links };
    });

    await page.close();
    return { books, links };
}

async function fetchBookDetail(browser, link) {
    const page = await browser.newPage();
    await page.goto(link, { waitUntil: "networkidle2" });
    await sleep(1500);

    const data = await page.evaluate(() => {
        const cleanText = (el) => {
            if (!el) return "";
            const text = el.innerText
                .replace(/\u00a0/g, " ")
                .replace(/\s+\n/g, "\n")
                .replace(/\n{3,}/g, "\n\n");
            return text.trim();
        };

        const pickSectionText = (prefixes) => {
            for (const prefix of prefixes) {
                const anchor = document.querySelector(`a[name^="${prefix}"]`);
                if (!anchor) continue;
                const block = anchor.closest('.mod_b');
                if (!block) continue;
                const content = block.querySelector('.content');
                if (content) return cleanText(content);
            }
            return "";
        };

        const description = pickSectionText(['Intro', 'Preface', 'Summary']) ||
            cleanText(document.querySelector('div.grid_19 .mod_b .content'));
        const other = pickSectionText(['Category', 'Contents']) ||
            cleanText(document.querySelector('#M201105_0_getProdTextInfo_P00a400020009_h2'));
        const writerInfo = pickSectionText(['Author']) ||
            cleanText(document.querySelector('div.grid_19 .mod_b:nth-of-type(2) .content'));

        return { description, other, writerInfo };
    });

    await page.close();
    return data;
}

export default async function taiwanScraper() {
    const startTime = Date.now();
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    console.log("📖 Fetching bestseller list...");
    const { books, links } = await fetchPageBooks(browser);

    const concurrency = 5;
    for (let i = 0; i < books.length; i += concurrency) {
        const batchBooks = books.slice(i, i + concurrency);
        const batchLinks = links.slice(i, i + concurrency);

        const results = await Promise.allSettled(
            batchLinks.map((link) => fetchBookDetail(browser, link))
        );

        results.forEach((res, idx) => {
            const data = res.status === 'fulfilled' ? res.value : { description: '', other: '', writerInfo: '' }; 
            batchBooks[idx].description = data.description;
            batchBooks[idx].other = data.other;
            batchBooks[idx].writerInfo = data.writerInfo;
            console.log(`${i + idx + 1}. ${batchBooks[idx].title} ✅`);
        });
    }

    const resultPath = path.join(process.cwd(), '../json_results/taiwan.json');
    const sanitized = books.map(toPublicBook);
    fs.writeFileSync(resultPath, JSON.stringify(sanitized, null, 2), 'utf-8');

    console.log(`✅ Crawled ${books.length} books`);
    console.log(`Saved to ${resultPath}`);
    console.log(`Done in ${(Date.now() - startTime) / 1000}s`);

    await browser.close();
}

function toPublicBook(raw) {
    const trim = value => (value || '').trim();
    return {
        image: trim(raw.image),
        link: trim(raw.detailHref),
        title: trim(raw.title),
        author: trim(raw.author),
        writerInfo: trim(raw.writerInfo),
        description: trim(raw.description),
        other: trim(raw.other),
    };
}

// Run directly
taiwanScraper();