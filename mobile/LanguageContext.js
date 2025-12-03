import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const LanguageContext = createContext();

const TRANSLATION_URL =
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=0&range=A1:F31';
const DATA_SHEETS = [
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=161667220&range=A1:AK32', // Korea
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=638692902&range=A1:AK32', // US
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=1994696482&range=A1:AK32', // JAPAN
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=1872205236&range=A1:AK32', // UK
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=225038494&range=A1:AK32', // CHINA
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=287677657&range=A1:AK32', // TAIWAN
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=460284331&range=A1:AK32', // FRANCE
];

const parseTSV = text =>
  text
    .trim()
    .split('\n')
    .map(line => line.split('\t').map(cell => cell.trim()));

const filterColumns = (rows, startIndex) =>
  rows.map(row => {
    const image = row[1] ?? '';
    const slice = row.slice(startIndex, startIndex + 5);
    while (slice.length < 5) {
      slice.push('');
    }
    return [image, ...slice];
  });

const fetchSheet = async url => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const text = await response.text();
  return parseTSV(text);
};

const blockMatrix = {
  0: { 0: 0, 1: 1, 2: 1 }, // Korean
  1: { 0: 1, 1: 2, 2: 2 }, // English
  2: { 0: 3, 1: 3, 2: 4 }, // Japanese
  3: { 0: 0, 1: 0, 2: 0 }, // Chinese (placeholder)
  4: { 0: 3, 1: 0, 2: 4 }, // Taiwanese
  5: { 0: 4, 1: 4, 2: 0 }, // French
};

export const LanguageProvider = ({ children }) => {
  const [userLanguage, setUserLanguage] = useState(0);
  const [language, setLanguage] = useState(0);
  const [country, setCountry] = useState(0);
  const [translations, setTranslations] = useState([]);
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [columnHeaders, setColumnHeaders] = useState([]);
  const [languageLabels, setLanguageLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const sheetUrl = useMemo(() => DATA_SHEETS[country] ?? DATA_SHEETS[0], [country]);

  const resolveBlockIndex = useCallback(() => {
    const languageMap = blockMatrix[language];
    if (languageMap && typeof languageMap[country] === 'number') {
      return languageMap[country];
    }
    return 0;
  }, [country, language]);

  const fetchSheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [translationRows, sheetRows] = await Promise.all([
        fetchSheet(TRANSLATION_URL),
        fetchSheet(sheetUrl),
      ]);

      setTranslations(translationRows);
      const labelsRow = translationRows[18] ?? [];
      const normalizedLabels = [...labelsRow];
      while (normalizedLabels.length < 6) {
        normalizedLabels.push('');
      }
      setLanguageLabels(normalizedLabels);
      setData(sheetRows);

      const blockIndex = resolveBlockIndex();
      const startIndex = 2 + blockIndex * 5;

      const rawHeaderRow = sheetRows[0] ?? [];
      const headerSlice = rawHeaderRow.slice(startIndex, startIndex + 5);
      const headerRow = [rawHeaderRow[1] ?? '', ...headerSlice];
      while (headerRow.length < 6) {
        headerRow.push('');
      }
      setColumnHeaders(headerRow);

      const rowsWithoutHeader = sheetRows.slice(1);
      const filtered = filterColumns(rowsWithoutHeader, startIndex);
      setFilteredData(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [resolveBlockIndex, sheetUrl]);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  const contextValue = useMemo(
    () => ({
      userLanguage,
      setUserLanguage,
      language,
      setLanguage,
      country,
      setCountry,
      translations,
      data,
      filteredData,
      columnHeaders,
      languageLabels,
      loading,
      error,
      fetchSheets,
    }),
    [
      userLanguage,
      setUserLanguage,
      language,
      country,
      translations,
      data,
      filteredData,
      columnHeaders,
      languageLabels,
      loading,
      error,
      fetchSheets,
    ]
  );

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
