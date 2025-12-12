import fs from "fs";
import { google } from "googleapis";
import { GoogleAuth } from "google-auth-library";

// Helper: read JSON and format rows
function readBooksJSON(filename) {
  const jsonPath = `./json_results/${filename}`;
  if (!fs.existsSync(jsonPath)) {
    console.error(`⚠️ File not found: ${jsonPath}`);
    return [];
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  const rows = data.map((book) => [
    book.image || "",
    book.link || "",
    book.title || "",
    book.author || "",
    book.writerInfo || "",
    book.description || "",
    book.other || ""
  ]);

  return rows;
}

// Batch update multiple sheets
async function batchUpdateValues(spreadsheetId, valueInputOption, data) {
  const auth = new GoogleAuth({
    keyFile: "./credentials.json", // service account JSON
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });

  const sheets = google.sheets({ version: "v4", auth });

  const resource = {
    data,
    valueInputOption,
  };

  const result = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource,
  });

  console.log(`✅ Updated ${result.data.totalUpdatedCells} cells.`);
}

// Main function
(async () => {
  // Run scrapers
  // await kyoboScrapper();
  // await usScrapper();
  // await japanScrapper();
  // await ukScrapper();
  // await chinaScrapper();
  // await taiwanScrapper();
  // await franceScrapper();

  const spreadsheetId = "1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs";
  const uploadData = [
    {
      range: "Korea Data!B3",
      values: readBooksJSON("korea.json"),
    },
    {
      range: "USA Data!B3",
      values: readBooksJSON("us.json"),
    },
    {
      range: "Japan Data!B3",
      values: readBooksJSON("japan.json"),
    },
    {
      range: "UK Data!B3",
      values: readBooksJSON("uk.json"),
    },
    {
      range: "China Data!B3",
      values: readBooksJSON("china.json"),
    },
    {
      range: "Taiwan Data!B3",
      values: readBooksJSON("taiwan.json"),
    },
    {
      range: "France Data!B3",
      values: readBooksJSON("france.json"),
    },
  ];

  await batchUpdateValues(spreadsheetId, "RAW", uploadData);
})();