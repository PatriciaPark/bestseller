// BookDetail.js - 통합 상세 화면 (모든 국가 지원)
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';

import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBookmark } from './BookmarkContext';
import {
  CloseIcon,
  StarIcon,
  ShareIcon,
  ExternalLinkIcon,
} from './components/IconButton';
import { useLanguage } from './LanguageContext';
import { useTheme } from './ThemeContext';
import MyAds from './BannerAd';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import koreaAuthors from '../backend/json_results/korea_author.json';
import usAuthors from '../backend/json_results/us_author.json';
import japanAuthors from '../backend/json_results/japan_author.json';
import ukAuthors from '../backend/json_results/uk_author.json';
import chinaAuthors from '../backend/json_results/china_author.json';
import taiwanAuthors from '../backend/json_results/taiwan_author.json';
import franceAuthors from '../backend/json_results/france_author.json';
import spainAuthors from '../backend/json_results/spain_author.json';

const authorDataMap = {
  KR: koreaAuthors,
  US: usAuthors,
  JP: japanAuthors,
  UK: ukAuthors,
  CN: chinaAuthors,
  TW: taiwanAuthors,
  FR: franceAuthors,
  ES: spainAuthors,
};

// 번역 데이터 (Google Sheets 기반)
const translations = {
  korean: {
    viewOnStore: '스토어 방문',
    author: '저자',
    aboutBook: '도서 정보',
    moreInfo: '상세 정보',
  },
  english: {
    viewOnStore: 'View on Store',
    author: 'Author',
    aboutBook: 'About Book',
    moreInfo: 'More Info',
  },
  japanese: {
    viewOnStore: 'ストアで見る',
    author: '著者',
    aboutBook: '書籍情報',
    moreInfo: '詳細情報',
  },
  chinese: {
    viewOnStore: '前往商店',
    author: '作者',
    aboutBook: '图书信息',
    moreInfo: '细节',
  },
  traditionalChinese: {
    viewOnStore: '查看店鋪',
    author: '作者',
    aboutBook: '關於本書',
    moreInfo: '更多資訊',
  },
  french: {
    viewOnStore: 'Voir en magasin',
    author: 'auteur',
    aboutBook: 'Informations sur le livre',
    moreInfo: "Plus d'informations",
  },
  spanish: {
    viewOnStore: 'Ver en la tienda',
    author: 'Autor',
    aboutBook: 'Sobre el libro',
    moreInfo: 'Más información',
  },
};

// 국가별 설정
const COUNTRY_CONFIG = {
  KR: {
    apiEndpoint: 'kr-book-detail',
    storeName: 'Store',
    defaultAuthorText: 'is a renowned author known for their insightful works.',
  },
  US: {
    apiEndpoint: 'us-book-detail',
    storeName: 'Store',
    defaultAuthorText: 'is a renowned writer known for their insightful works.',
  },
  JP: {
    apiEndpoint: 'jp-book-detail',
    storeName: 'Store',
    defaultAuthorText: 'は、洞察力のある作品で知られる著名な作家です。',
  },
  TW: {
    apiEndpoint: 'tw-book-detail',
    storeName: 'Store',
    defaultAuthorText: 'is a renowned writer known for their insightful works.',
  },
  FR: {
    apiEndpoint: 'fr-book-detail',
    storeName: 'Store',
    defaultAuthorText:
      'est un écrivain renommé connu pour ses œuvres perspicaces.',
  },
  UK: {
    apiEndpoint: 'uk-book-detail',
    storeName: 'Waterstones',
    defaultAuthorText: 'is a renowned writer known for their insightful works.',
  },
  ES: {
    apiEndpoint: 'es-book-detail',
    storeName: 'elcorteingles',
    defaultAuthorText: 'is a renowned writer known for their insightful works',
  },
};

export default function BookDetail({ route, navigation }) {
  const { book, language: languageFromRoute } = route.params || {};
  const { columnHeaders } = useLanguage();
  const { isBookmarked, toggleBookmark } = useBookmark();
  const { colors, isDark } = useTheme();

  const [language, setLanguage] = useState(languageFromRoute || 'original');
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('author');
  const [appLanguage, setAppLanguage] = useState('English');
  const [wikiModalVisible, setWikiModalVisible] = useState(false);
  const [wikiUrl, setWikiUrl] = useState('');
  const [wikiType, setWikiType] = useState('');
  const [imageModalVisible, setImageModalVisible] = useState(false);

  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  if (!book) {
    return (
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <CloseIcon size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={{ color: colors.text }}>
            책 정보를 불러올 수 없습니다.
          </Text>
        </View>
      </View>
    );
  }

  const country = book.country || 'US';
  const config = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.US;

  // 앱 언어 설정에 따라 Wikipedia 언어 결정
  const getWikiLangByAppLanguage = () => {
    const languageMap = {
      Korean: 'ko',
      English: 'en',
      Japanese: 'ja',
      Chinese: 'zh',
      'Traditional Chinese': 'zh',
      French: 'fr',
      Spanish: 'es',
    };
    return languageMap[appLanguage] || 'en';
  };

  // 작가 번역된 이름 가져오기 + Wikidata 확인
  const getAuthorTranslatedName = (authorName, country, targetLang) => {
    const authorData = authorDataMap[country];
    if (!authorData) return { name: authorName, hasWikidata: false };

    const authorInfo = authorData.find(a => a.original === authorName);
    if (!authorInfo) return { name: authorName, hasWikidata: false };

    // source가 'wikidata'가 아니면 Wikipedia 검색 불가
    if (authorInfo.source !== 'wikidata') {
      return { name: authorName, hasWikidata: false };
    }

    // targetLang에 맞는 번역된 이름 가져오기
    const translatedName =
      authorInfo[targetLang] || authorInfo.en || authorInfo.original;

    return { name: translatedName, hasWikidata: true };
  };

  // route params에서 language 업데이트
  useEffect(() => {
    if (languageFromRoute) {
      setLanguage(languageFromRoute);
    }
  }, [languageFromRoute]);

  // 앱 언어 설정 불러오기
  useEffect(() => {
    const loadAppLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('appLanguage');
        if (savedLanguage) {
          setAppLanguage(savedLanguage);
        }
      } catch (error) {
        console.error('[BookDetail] Failed to load language:', error);
      }
    };
    loadAppLanguage();
  }, []);

  // 작가 검색 - 앱 언어에 맞는 Wikipedia + 번역된 이름 사용
  const searchAuthor = authorName => {
    if (
      !authorName ||
      authorName === '저자 정보 없음' ||
      authorName === 'Unknown Author'
    ) {
      return;
    }

    // 앱 언어에 맞는 Wikipedia 언어
    const wikiLang = getWikiLangByAppLanguage();

    // 번역된 이름 가져오기
    const { name: translatedName, hasWikidata } = getAuthorTranslatedName(
      authorName,
      country,
      wikiLang === 'ko'
        ? 'ko'
        : wikiLang === 'ja'
        ? 'ja'
        : wikiLang === 'zh'
        ? 'zh'
        : wikiLang === 'fr'
        ? 'fr'
        : wikiLang === 'es'
        ? 'es'
        : 'en',
    );

    // Wikidata에 없으면 검색 안 함
    if (!hasWikidata) {
      console.log(
        `⚠️ Author not in Wikidata: ${authorName} (source: translate_failed or wikidata_not_found)`,
      );
      return;
    }

    // 번역된 이름으로 Wikipedia 검색
    const url = `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(
      translatedName,
    )}`;

    setWikiUrl(url);
    setWikiType('author');
    setWikiModalVisible(true);
  };

  // 책 상세 정보 가져오기
  useEffect(() => {
    if (
      book.authorInfo ||
      book.publisherReview ||
      book.description ||
      book.contents ||
      book.plot ||
      book.authorInfo_kr ||
      book.description_kr ||
      book.moreInfo_kr
    ) {
      setDetails({
        authorInfo: book.authorInfo || '',
        publisherReview: book.publisherReview || '',
        description: book.description || '',
        contents: book.contents || '',
        plot: book.plot || '',
        tableOfContents: book.tableOfContents || '',
        authorInfo_kr: book.authorInfo_kr || '',
        description_kr: book.description_kr || '',
        moreInfo_kr: book.moreInfo_kr || '',
      });
    }
    setLoading(false);
  }, [
    book?.link,
    book?.description,
    book?.contents,
    book?.authorInfo,
    book?.publisherReview,
    book?.plot,
    book?.authorInfo_kr,
    book?.description_kr,
    book?.moreInfo_kr,
  ]);

  // 번역 가져오기
  const getTranslation = key => {
    const languageMap = {
      Korean: 'korean',
      English: 'english',
      Japanese: 'japanese',
      Chinese: 'chinese',
      'Traditional Chinese': 'traditionalChinese',
      French: 'french',
      Spanish: 'spanish',
    };
    const langKey = languageMap[appLanguage] || 'english';
    return translations[langKey]?.[key] || translations.english[key];
  };

  // 탭 제목 가져오기
  const getTabTitle = tab => {
    switch (tab) {
      case 'author':
        return getTranslation('author');
      case 'aboutBook':
        return getTranslation('aboutBook');
      case 'moreInfo':
        return getTranslation('moreInfo');
      default:
        return '';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'author':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabContentTitle}>{getTabTitle('author')}</Text>
            <Text style={styles.tabContentText}>
              {language === 'korean' && details?.authorInfo_kr
                ? details.authorInfo_kr
                : details?.authorInfo ||
                  `${book.author || 'The author'} ${config.defaultAuthorText}`}
            </Text>
          </View>
        );
      case 'aboutBook':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabContentTitle}>
              {getTabTitle('aboutBook')}
            </Text>
            {language === 'korean' && details?.description_kr ? (
              <View>
                <Text style={styles.tabContentText}>
                  {details.description_kr}
                </Text>
              </View>
            ) : details?.tableOfContents ? (
              <Text style={styles.tabContentText}>
                {details.tableOfContents}
              </Text>
            ) : details?.plot ? (
              <View>
                <Text style={styles.tabContentText}>{details.plot}</Text>
              </View>
            ) : details?.description || details?.contents ? (
              <View>
                <Text style={styles.tabContentText}>
                  {details.description || details.contents}
                </Text>
              </View>
            ) : (
              <View>
                <Text style={styles.tabContentText}>
                  Table of contents information is not available for this book.
                </Text>
                {(details?.publisher || book.publisher) && (
                  <View style={styles.infoSection}>
                    <Text style={styles.tabContentSubtitle}>
                      Publication Information
                    </Text>
                    <Text style={styles.tabContentText}>
                      Publisher: {details.publisher || book.publisher}
                    </Text>
                    {details?.publishDate && (
                      <Text style={styles.tabContentText}>
                        Published: {details.publishDate}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      case 'moreInfo':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabContentTitle}>
              {getTabTitle('moreInfo')}
            </Text>
            <Text style={styles.tabContentText}>
              {language === 'korean' && details?.moreInfo_kr
                ? details.moreInfo_kr
                : details?.publisherReview ||
                  details?.review ||
                  details?.contents ||
                  details?.description ||
                  'Publisher review information is not available.'}
            </Text>
            <View
              style={[styles.adContainer, { marginTop: 20, marginBottom: 20 }]}
            >
              <MyAds type="adaptive" size={BannerAdSize.LARGE_BANNER} />
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <CloseIcon size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => toggleBookmark({ ...book, country })}
          >
            <StarIcon
              size={24}
              color={colors.text}
              filled={isBookmarked(book.title)}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <ShareIcon size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* 책 커버 및 정보 */}
        <View style={styles.bookHeaderContainer}>
          <View style={styles.bookHeader}>
            <View style={styles.bookImageContainer}>
              {book.image ? (
                <TouchableOpacity
                  onPress={() => setImageModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: book.image }}
                    style={styles.bookImage}
                  />
                </TouchableOpacity>
              ) : (
                <View style={[styles.bookImage, styles.imagePlaceholder]}>
                  <Text style={styles.placeholderText}>No Image</Text>
                </View>
              )}
              {/* View on Store 버튼 */}
              {book.link && (
                <TouchableOpacity
                  style={styles.viewStoreButton}
                  onPress={async () => {
                    try {
                      const canOpen = await Linking.canOpenURL(book.link);
                      if (canOpen) {
                        await Linking.openURL(book.link);
                      } else {
                        console.error(
                          '[BookDetail] Cannot open URL:',
                          book.link,
                        );
                      }
                    } catch (error) {
                      console.error('[BookDetail] Error opening URL:', error);
                    }
                  }}
                >
                  <Text style={styles.viewStoreText} numberOfLines={1}>
                    {getTranslation('viewOnStore')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.bookInfo}>
              {/* 제목 */}
              <Text style={styles.title}>{book.title}</Text>
              {/* 작가 클릭 - Wikidata 확인 후 클릭 가능 */}
              <TouchableOpacity onPress={() => searchAuthor(book.author)}>
                <Text style={styles.author}>
                  {language === 'korean' && book.author_kr
                    ? book.author_kr
                    : language === 'japanese' && book.author_ja
                    ? book.author_ja
                    : language === 'chinese' && book.author_zh
                    ? book.author_zh
                    : language === 'french' && book.author_fr
                    ? book.author_fr
                    : language === 'spanish' && book.author_es
                    ? book.author_es
                    : book.author || 'Unknown Author'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 탭 네비게이션 */}
        <View style={styles.tabNavigation}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'author' && styles.activeTab]}
            onPress={() => setActiveTab('author')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'author' && styles.activeTabText,
              ]}
            >
              {getTabTitle('author')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'aboutBook' && styles.activeTab]}
            onPress={() => setActiveTab('aboutBook')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'aboutBook' && styles.activeTabText,
              ]}
            >
              {getTabTitle('aboutBook')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'moreInfo' && styles.activeTab]}
            onPress={() => setActiveTab('moreInfo')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'moreInfo' && styles.activeTabText,
              ]}
            >
              {getTabTitle('moreInfo')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 탭 컨텐츠 */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4285F4" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          renderTabContent()
        )}
      </ScrollView>

      {/* Wikipedia 모달 */}
      {wikiModalVisible && (
        <Modal
          visible={wikiModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setWikiModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.adContainer, { marginBottom: 0 }]}>
              <MyAds type="adaptive" size={BannerAdSize.BANNER} />
            </View>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={() => setWikiModalVisible(false)}
                  style={styles.modalCloseButton}
                >
                  <CloseIcon size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {wikiType === 'title'
                    ? // 앱 언어에 따라 번역된 제목 표시
                      appLanguage === 'Korean' && book.title_kr
                      ? book.title_kr
                      : appLanguage === 'Japanese' && book.title_ja
                      ? book.title_ja
                      : appLanguage === 'Chinese' && book.title_zh
                      ? book.title_zh
                      : appLanguage === 'French' && book.title_fr
                      ? book.title_fr
                      : appLanguage === 'Spanish' && book.title_es
                      ? book.title_es
                      : book.title
                    : // 작가명도 동일하게
                    appLanguage === 'Korean' && book.author_kr
                    ? book.author_kr
                    : appLanguage === 'Japanese' && book.author_ja
                    ? book.author_ja
                    : appLanguage === 'Chinese' && book.author_zh
                    ? book.author_zh
                    : appLanguage === 'French' && book.author_fr
                    ? book.author_fr
                    : appLanguage === 'Spanish' && book.author_es
                    ? book.author_es
                    : book.author}
                </Text>

                <View style={{ width: 32 }} />
              </View>
              <WebView
                source={{ uri: wikiUrl }}
                style={styles.webView}
                startInLoadingState={true}
                onError={syntheticEvent => {
                  const { nativeEvent } = syntheticEvent;
                  console.warn('WebView error:', nativeEvent);
                  setTimeout(() => {
                    setWikiModalVisible(false);
                  }, 1000);
                }}
                onHttpError={syntheticEvent => {
                  const { nativeEvent } = syntheticEvent;
                  if (nativeEvent.statusCode === 404) {
                    console.warn('Page not found');
                    setTimeout(() => {
                      setWikiModalVisible(false);
                    }, 1000);
                  }
                }}
                onMessage={event => {
                  if (event.nativeEvent.data === 'PAGE_NOT_FOUND') {
                    setWikiModalVisible(false);
                  }
                }}
                renderLoading={() => (
                  <View style={styles.webViewLoading}>
                    <ActivityIndicator size="large" color="#4285F4" />
                  </View>
                )}
                injectedJavaScript={`
    (function() {
      const adHtml = '<div style="width: 100%; height: 50px; background-color: #FFF9E6; display: flex; justify-content: center; align-items: center; border-top: 1px solid #E0E0E0; border-bottom: 1px solid #E0E0E0; position: sticky; top: 0; z-index: 9999;"><span style="color: #999; font-size: 14px; font-weight: 500;">Banner Ad</span></div>';
      
      function insertAd() {
        const content = document.querySelector('#content') || document.querySelector('.mw-parser-output') || document.querySelector('body');
        if (content && !document.querySelector('#custom-ad')) {
          const adDiv = document.createElement('div');
          adDiv.id = 'custom-ad';
          adDiv.innerHTML = adHtml;
          content.insertBefore(adDiv, content.firstChild);
        }
      }
      
      function checkPageNotFound() {
        const bodyText = document.body.innerText || document.body.textContent;
        const notFoundPatterns = [
          'does not have an article',
          'Wikipedia does not have',
          '문서가 없습니다',
          '項目不存在',
          'ページが見つかりません',
          "n'existe pas",
          'no existe'
        ];
        
        const isNotFound = notFoundPatterns.some(pattern => 
          bodyText.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (isNotFound) {
          window.ReactNativeWebView.postMessage('PAGE_NOT_FOUND');
        }
      }
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          insertAd();
          setTimeout(checkPageNotFound, 1000);
        });
      } else {
        insertAd();
        setTimeout(checkPageNotFound, 1000);
      }
      
      setTimeout(insertAd, 500);
      setTimeout(insertAd, 1000);
      setTimeout(checkPageNotFound, 2000);
    })();
    true;
  `}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* 이미지 확대 모달 */}
      {imageModalVisible && book.image && (
        <Modal
          visible={imageModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setImageModalVisible(false)}
        >
          <View style={styles.imageModalOverlay}>
            <TouchableOpacity
              style={styles.imageModalCloseButton}
              onPress={() => setImageModalVisible(false)}
              activeOpacity={0.7}
            >
              <CloseIcon size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.imageModalContent}
              activeOpacity={1}
              onPress={() => setImageModalVisible(false)}
            >
              <Image
                source={{ uri: book.image }}
                style={styles.imageModalImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </View>
  );
}

// 스타일을 함수로 변경하여 테마에 따라 동적으로 생성
const getStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primaryBackground,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    topHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 50,
      paddingHorizontal: 20,
      paddingBottom: 15,
    },
    closeButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerRight: {
      flexDirection: 'row',
      gap: 15,
    },
    iconButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    bookHeaderContainer: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    bookHeader: {
      flexDirection: 'row',
    },
    bookHeaderExpanded: {
      marginBottom: 0,
    },
    bookImageContainer: {
      marginRight: 15,
    },
    bookImage: {
      width: 120,
      height: 180,
      borderRadius: 8,
      resizeMode: 'cover',
      marginBottom: 12,
    },
    imagePlaceholder: {
      backgroundColor: colors.secondaryBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderText: {
      color: colors.secondaryText,
      fontSize: 12,
    },
    bookInfo: {
      flex: 1,
    },
    bookInfoExpanded: {
      paddingBottom: 0,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
      lineHeight: 28,
    },
    author: {
      fontSize: 16,
      color: colors.secondaryText,
      marginBottom: 12,
    },
    descriptionContainer: {
      marginTop: 4,
    },
    descriptionContainerExpanded: {
      marginTop: 0,
      marginBottom: 0,
      paddingBottom: 0,
    },
    description: {
      fontSize: 14,
      color: colors.secondaryText,
      lineHeight: 20,
    },
    moreButton: {
      marginTop: 8,
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    moreButtonText: {
      fontSize: 14,
      color: colors.link,
      fontWeight: '500',
    },
    viewStoreButton: {
      backgroundColor: colors.link,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: 120,
    },
    viewStoreText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
    },
    tabNavigation: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 20,
    },
    tab: {
      paddingBottom: 12,
      marginRight: 24,
    },
    activeTab: {
      borderBottomWidth: 2,
      borderBottomColor: colors.link,
    },
    tabText: {
      fontSize: 15,
      color: colors.secondaryText,
      fontWeight: '500',
    },
    activeTabText: {
      color: colors.link,
      fontWeight: '600',
    },
    tabContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    tabContentTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    tabContentText: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 24,
    },
    tabContentSubtitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    infoSection: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      color: colors.secondaryText,
      marginTop: 10,
      fontSize: 14,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      height: '85%',
      backgroundColor: colors.primaryBackground,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: -3,
      },
      shadowOpacity: 0.1,
      shadowRadius: 5,
      elevation: 5,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 20,
      paddingBottom: 16,
      backgroundColor: colors.primaryBackground,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    modalCloseButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
    },
    webView: {
      flex: 1,
    },
    webViewLoading: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.primaryBackground,
    },
    adText: {
      fontSize: 14,
      color: colors.secondaryText,
      fontWeight: '500',
    },
    adContainer: {
      paddingHorizontal: 20,
      paddingBottom: 5,
      alignItems: 'center',
    },
    imageModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageModalCloseButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      zIndex: 1000,
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 20,
    },
    imageModalContent: {
      width: Dimensions.get('window').width,
      height: Dimensions.get('window').height,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 60,
    },
    imageModalImage: {
      width: Dimensions.get('window').width - 40,
      height: Dimensions.get('window').height - 120,
    },
  });
