import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JSON 파일 경로 - 모든 캐시 파일을 backend/json_results로 통합
const BACKEND_JSON_DIR = path.join(__dirname, '../../backend/json_results');

/**
 * JSON 파일에서 책 데이터 읽기
 * @param {string} country - 국가 코드 (kr, jp, us, tw, fr, uk)
 * @returns {Promise<Array>} 책 목록
 */
export async function getBooksFromCache(country) {
  try {
    // 모든 국가의 캐시 파일을 backend/json_results에서 읽음
    const fileMap = {
      kr: 'aladin.json',
      jp: 'jpbooks.json', // 일본
      us: 'usbooks.json', // 미국
      fr: 'amazon.json', // 프랑스는 amazon.json
      tw: 'taiwan.json',
      uk: 'uk.json',
      es: 'es.json',
    };

    const filename = fileMap[country];
    if (!filename) {
      throw new Error(`Unknown country: ${country}`);
    }

    const filePath = path.join(BACKEND_JSON_DIR, filename);

    const data = await readFile(filePath, 'utf-8');

    // 빈 파일 처리
    if (!data || data.trim() === '') {
      console.log(`⚠️ ${country} 캐시 파일이 비어있음`);
      return [];
    }

    const books = JSON.parse(data);

    // 빈 배열 처리
    if (!Array.isArray(books) || books.length === 0) {
      console.log(`⚠️ ${country} 캐시 데이터가 비어있음`);
      return [];
    }

    // 데이터 형식 통일 (coverImage -> image, writerInfo -> authorInfo 등)
    return books.map(book => ({
      title: book.title || '',
      author: book.author || '',
      publisher: book.publisher || '',
      image: book.coverImage || book.image || '',
      link: book.link || book.href || '',
      // 상세 정보 필드
      description: book.description || book.contents || '',
      plot: book.plot || book.outline || '',
      authorInfo: book.authorInfo || book.writerInfo || '',
      publisherReview: book.publisherReview || book.review || '',
    }));
  } catch (err) {
    console.error(`❌ Cache read error (${country}):`, err.message);
    return [];
  }
}

/**
 * 캐시 파일 존재 여부 확인
 * @param {string} country - 국가 코드
 * @returns {Promise<boolean>}
 */
export async function cacheExists(country) {
  try {
    // 모든 국가의 캐시 파일을 backend/json_results에서 확인
    const fileMap = {
      kr: 'aladin.json',
      jp: 'jpbooks.json', // 일본
      us: 'usbooks.json', // 미국
      fr: 'amazon.json', // 프랑스는 amazon.json
      tw: 'taiwan.json',
      uk: 'uk.json',
      es: 'es.json',
    };

    const filename = fileMap[country];
    if (!filename) return false;

    const filePath = path.join(BACKEND_JSON_DIR, filename);

    const { access } = await import('fs/promises');
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
