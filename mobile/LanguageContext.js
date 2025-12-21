import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const LanguageContext = createContext();

const TRANSLATION_URL =
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=0&range=A1:F31';
const DATA_SHEETS = [
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=161667220&range=A1:AQ32', // Korea
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=638692902&range=A1:AQ32', // US
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=1994696482&range=A1:AQ32', // JAPAN
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=1872205236&range=A1:AQ32', // UK
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=225038494&range=A1:AQ32', // CHINA
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=287677657&range=A1:AQ32', // TAIWAN
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=460284331&range=A1:AQ32', // FRANCE
  'https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/export?format=tsv&gid=806262731&range=A1:AQ32', // SPAIN
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
  try {
    console.log(`[LanguageContext] Fetching: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    return parseTSV(text);
  } catch (error) {
    console.error('[LanguageContext] Fetch failed:', error);
    throw error;
  }
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
  const dataCache = React.useRef({});

  const sheetUrl = useMemo(
    () => DATA_SHEETS[country] ?? DATA_SHEETS[0],
    [country],
  );

  // 1. Fetch Translations (Once)
  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const rows = await fetchSheet(TRANSLATION_URL);
        setTranslations(rows);

        const labelsRow = rows[22] ?? [];
        setLanguageLabels(labelsRow);
      } catch (err) {
        console.error('[Language] Failed to load translations:', err.message);
      }
    };
    loadTranslations();
  }, []);

  // 2. Fetch Data (When country/sheetUrl changes)
  const fetchSheets = useCallback(async () => {
    // Check cache first
    if (dataCache.current[sheetUrl]) {
      setData(dataCache.current[sheetUrl]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSheet(sheetUrl);
      dataCache.current[sheetUrl] = rows; // Store in cache
      setData(rows);
    } catch (err) {
      console.error('[LanguageContext] fetchSheets error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sheetUrl]);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  // 3. Process Data (When data or language changes)
  useEffect(() => {
    if (!data.length) return;

    const blockIndex = language;
    const startIndex = 3 + blockIndex * 5;

    const rawHeaderRow = data[1] ?? [];
    const headerSlice = rawHeaderRow.slice(startIndex, startIndex + 5);
    const headerRow = [rawHeaderRow[1] ?? '', ...headerSlice];
    while (headerRow.length < 6) {
      headerRow.push('');
    }
    setColumnHeaders(headerRow);

    // Slice from index 2 to skip:
    // Index 0: Language grouping row (Original, Korean, etc.)
    // Index 1: Header row (Ranking, Image URL, Title, etc.)
    const rowsWithoutHeader = data.slice(2);
    const filtered = filterColumns(rowsWithoutHeader, startIndex);
    setFilteredData(filtered);
  }, [data, language]);

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
      originalLangs: languageLabels,
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
    ],
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
