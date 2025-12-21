import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import 'dotenv/config';

function readBooksJSON(filename) {
  const jsonPath = path.join(process.cwd(), 'json_results', filename);

  if (!fs.existsSync(jsonPath)) {
    console.error(`⚠️ File not found: ${jsonPath}`);
    return [];
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  return data.map(book => [
    book.image || '',
    book.link || '',
    book.title || '',
    book.author || '',
    book.writerInfo || '',
    book.description || '',
    book.other || '',
  ]);
}

async function batchUpdateValues(spreadsheetId, valueInputOption, data) {
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

  const auth = new GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const resource = { data, valueInputOption };

  const result = await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource,
  });

  console.log(`✅ Updated ${result.data.totalUpdatedCells} cells.`);
}

(async () => {
  const spreadsheetId = '1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs';

  const uploadData = [
    { range: 'Korea Data!B3', values: readBooksJSON('korea.json') },
    { range: 'USA Data!B3', values: readBooksJSON('us.json') },
    { range: 'Japan Data!B3', values: readBooksJSON('japan.json') },
    { range: 'UK Data!B3', values: readBooksJSON('uk.json') },
    { range: 'China Data!B3', values: readBooksJSON('china.json') },
    { range: 'Taiwan Data!B3', values: readBooksJSON('taiwan.json') },
    { range: 'France Data!B3', values: readBooksJSON('france.json') },
    { range: 'Spain Data!B3', values: readBooksJSON('spain.json') },
  ];

  await batchUpdateValues(spreadsheetId, 'RAW', uploadData);
})();
