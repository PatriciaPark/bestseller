// API 설정 파일
// 개발/프로덕션 환경에 따라 자동 전환
const API_BASE_URL = __DEV__ 
  ? 'http://10.0.2.2:4000'  // 개발: 안드로이드 에뮬레이터
  : 'https://bestseller-979970292886.us-central1.run.app';  // 프로덕션: 구글 클라우드


//개발: 안드포이드 폰 시뮬
// const API_BASE_URL = 'https://bestseller-979970292886.us-central1.run.app';

export default {
  baseURL: API_BASE_URL,
  endpoints: {
    // 베스트셀러 목록
    krBooks: `${API_BASE_URL}/kr-books`,
    jpBooks: `${API_BASE_URL}/jp-books`,
    usBooks: `${API_BASE_URL}/us-books`,
    twBooks: `${API_BASE_URL}/tw-books`,
    frBooks: `${API_BASE_URL}/fr-books`,
    ukBooks: `${API_BASE_URL}/uk-books`,
    // 책 상세 정보
    krBookDetail: `${API_BASE_URL}/kr-book-detail`,
    jpBookDetail: `${API_BASE_URL}/jp-book-detail`,
    usBookDetail: `${API_BASE_URL}/us-book-detail`,
    twBookDetail: `${API_BASE_URL}/tw-book-detail`,
    frBookDetail: `${API_BASE_URL}/fr-book-detail`,
    ukBookDetail: `${API_BASE_URL}/uk-book-detail`,
  },
};

