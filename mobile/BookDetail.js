// BookDetail.js - 통합 상세 화면 (모든 국가 지원)
import React, { useEffect, useMemo, useState } from 'react';
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
  SafeAreaView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useBookmark } from './BookmarkContext';
import { CloseIcon, StarIcon, ShareIcon, ExternalLinkIcon } from './components/IconButton';
import apiConfig from './config/api';
import { useLanguage } from './LanguageContext';
import MyAds from './BannerAd';
import { BannerAdSize } from 'react-native-google-mobile-ads';

// 국가별 설정
const COUNTRY_CONFIG = {
  KR: {
    apiEndpoint: 'kr-book-detail',
    storeName: 'Kyobo',
    defaultAuthorText: 'is a renowned author known for their insightful works.',
  },
  US: {
    apiEndpoint: 'us-book-detail',
    storeName: 'Amazon',
    defaultAuthorText: 'is a renowned writer known for their insightful works.',
  },
  JP: {
    apiEndpoint: 'jp-book-detail',
    storeName: 'Amazon',
    defaultAuthorText: 'は、洞察力のある作品で知られる著名な作家です。',
  },
  TW: {
    apiEndpoint: 'tw-book-detail',
    storeName: 'Books.com.tw',
    defaultAuthorText: 'is a renowned writer known for their insightful works.',
  },
  FR: {
    apiEndpoint: 'fr-book-detail',
    storeName: 'Amazon FR',
    defaultAuthorText: 'est un écrivain renommé connu pour ses œuvres perspicaces.',
  },
  UK: {
    apiEndpoint: 'uk-book-detail',
    storeName: 'Waterstones',
    defaultAuthorText: 'is a renowned writer known for their insightful works.',
  },
};

export default function BookDetail({ route, navigation }) {
  const { book } = route.params;
  const country = book.country || 'US';
  const config = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.US;
  const { columnHeaders } = useLanguage();
  
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('contents');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const { isBookmarked, toggleBookmark } = useBookmark();
  
  // Wiki Modal State
  const [wikiModalVisible, setWikiModalVisible] = useState(false);
  const [wikiUrl, setWikiUrl] = useState('');

  const openWiki = (query) => {
    const url = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`;
    setWikiUrl(url);
    setWikiModalVisible(true);
  };

  const tabHeaderMap = useMemo(
    () => ({
      author: columnHeaders[3] || '',
      contents: columnHeaders[4] || '',
      other: columnHeaders[5] || '',
    }),
    [columnHeaders]
  );

  // 책 상세 정보 가져오기
  useEffect(() => {
    // 먼저 book 객체에 이미 상세 정보가 있는지 확인 (캐시 데이터)
    if (book.authorInfo || book.publisherReview || book.description || book.contents || book.plot) {
      setDetails({
        authorInfo: book.authorInfo || '',
        publisherReview: book.publisherReview || '',
        description: book.description || '',
        contents: book.contents || '',
        plot: book.plot || '',
        tableOfContents: book.tableOfContents || '',
        other: book.other || "",
      });
      setLoading(false);
      
      // link가 있으면 추가로 API 호출하여 더 자세한 정보 가져오기 (선택적)
      if (book.link) {
        const countryKey = country.toLowerCase();
        const detailUrl = apiConfig.endpoints[`${countryKey}BookDetail`] || 
          `${apiConfig.baseURL}/${config.apiEndpoint}`;
        fetch(
          `${detailUrl}?url=${encodeURIComponent(
            book.link,
          )}`,
        )
          .then(res => {
            if (res.ok) {
              return res.json();
            }
            return null;
          })
          .then(data => {
            if (data) {
              // API에서 받은 데이터로 기존 details 업데이트 (빈 필드만 채움)
              setDetails(prev => ({
                ...prev,
                authorInfo: data.authorInfo || prev.authorInfo || '',
                publisherReview: data.publisherReview || prev.publisherReview || '',
                description: data.description || prev.description || '',
                contents: data.contents || prev.contents || '',
                plot: data.plot || prev.plot || '',
                tableOfContents: data.tableOfContents || prev.tableOfContents || '',
                other: data.other || prev.other || '',
              }));
            }
          })
          .catch(err => {
            console.error('❌ Detail Fetch Error (optional):', err);
            // 에러가 나도 캐시 데이터는 이미 표시되므로 무시
          });
      }
    } else if (book.link) {
      // 캐시 데이터가 없고 link만 있는 경우 API 호출
      console.log('📘 요청 URL:', book.link);

      const countryKey = country.toLowerCase();
      const detailUrl = apiConfig.endpoints[`${countryKey}BookDetail`] || 
        `${apiConfig.baseURL}/${config.apiEndpoint}`;
      fetch(
        `${detailUrl}?url=${encodeURIComponent(
          book.link,
        )}`,
      )
        .then(res => {
          console.log('📘 응답 상태:', res.status);
          return res.json();
        })
        .then(data => {
          console.log('📘 받은 데이터:', data);
          setDetails(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('❌ Detail Fetch Error:', err);
          setLoading(false);
        });
    } else {
      // 데이터가 전혀 없는 경우
      setLoading(false);
    }
  }, [book.link, book.description, book.contents, book.authorInfo, book.other, book.plot, config.apiEndpoint]);

  // 탭 제목을 데이터에 따라 동적으로 결정
  const getTabTitle = (tab) => {
    if (tabHeaderMap[tab]) {
      return tabHeaderMap[tab];
    }
    switch (tab) {
      case 'contents':
        if (details?.tableOfContents) return 'Table of Contents';
        if (details?.plot) return 'Plot Summary';
        if (details?.description || details?.contents) return 'Book Description';
        return 'Description';
      case 'author':
        if (details?.authorInfo) return 'About the Author';
        return 'Author Info';
      case 'other':
        if (details?.other) return 'Other Information';
        return 'Other';
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
              {details?.authorInfo || 
                `${book.author || 'The author'} ${config.defaultAuthorText}`}
            </Text>
          </View>
        );
      case 'contents':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabContentTitle}>{getTabTitle('contents')}</Text>
            {details?.tableOfContents ? (
              <Text style={styles.tabContentText}>{details.tableOfContents}</Text>
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
                    <Text style={styles.tabContentSubtitle}>Publication Information</Text>
                    <Text style={styles.tabContentText}>
                      Publisher: {details.publisher || book.publisher}
                    </Text>
                    {details?.publishDate && (
                      <Text style={styles.tabContentText}>Published: {details.publishDate}</Text>
                    )}
                  </View>
                )}
              </View>
            )}
            <View style={[styles.adContainer, { marginTop: 20 }]}>
              <MyAds type="adaptive" size={BannerAdSize.LARGE_BANNER} />
            </View>
          </View>
        );
      case 'other':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.tabContentTitle}>{getTabTitle('other')}</Text>
            <Text style={styles.tabContentText}>
              {details?.other || 'Other information is not available.'}
            </Text>
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
          <CloseIcon size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => toggleBookmark({ ...book, country })}
          >
            <StarIcon 
              size={24} 
              color="#000" 
              filled={isBookmarked(book.title)} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <ShareIcon size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        {/* 책 커버 및 정보 */}
        <View style={styles.bookHeader}>
          {book.image ? (
            <Image source={{ uri: book.image }} style={styles.bookImage} />
          ) : (
            <View style={[styles.bookImage, styles.imagePlaceholder]}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
          <View style={styles.bookInfo}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>#{book.rank || 1} Best Seller</Text>
            </View>
            <Text style={styles.title}>{book.title}</Text>
            <View style={styles.authorContainer}>
              <Text style={styles.author}>{book.author || 'Unknown Author'}</Text>
              <TouchableOpacity 
                onPress={() => {
                  if (book.author) {
                    openWiki(book.author);
                  }
                }}
                style={styles.wikiButton}
              >
                <Text style={styles.wikiButtonText}>Author Wiki</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.descriptionContainer}>
              <Text 
                style={styles.description}
                numberOfLines={descriptionExpanded ? undefined : 3}
              >
                {details?.contents || details?.description || 
                  'A compelling story that captivates readers with its depth and insight.'}
              </Text>
              {((details?.contents || details?.description) && 
                ((details.contents?.length > 150) || (details.description?.length > 150))) && (
                <TouchableOpacity
                  onPress={() => setDescriptionExpanded(!descriptionExpanded)}
                  style={styles.moreButton}
                >
                  <Text style={styles.moreButtonText}>
                    {descriptionExpanded ? 'Show Less' : 'See More'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* 버튼 영역 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.viewStoreButton}
            onPress={async () => {
              if (book.link) {
                try {
                  const canOpen = await Linking.canOpenURL(book.link);
                  if (canOpen) {
                    await Linking.openURL(book.link);
                  } else {
                    console.error('Cannot open URL:', book.link);
                  }
                } catch (error) {
                  console.error('Error opening URL:', error);
                }
              }
            }}
          >
            <ExternalLinkIcon size={16} color="#fff" />
            <Text style={styles.viewStoreText}>View on {config.storeName}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.previewButton}
            onPress={() => openWiki(book.title)}
          >
            <Text style={styles.previewText}>Wikipedia</Text>
          </TouchableOpacity>
        </View>

        {/* 탭 네비게이션 */}
        <View style={styles.tabNavigation}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'contents' && styles.activeTab]}
            onPress={() => setActiveTab('contents')}
          >
            <Text style={[styles.tabText, activeTab === 'contents' && styles.activeTabText]}>
              {getTabTitle('contents')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'author' && styles.activeTab]}
            onPress={() => setActiveTab('author')}
          >
            <Text style={[styles.tabText, activeTab === 'author' && styles.activeTabText]}>
              {getTabTitle('author')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'other' && styles.activeTab]}
            onPress={() => setActiveTab('other')}
          >
            <Text style={[styles.tabText, activeTab === 'other' && styles.activeTabText]}>
              {getTabTitle('other')}
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

      {/* 위키피디아 모달 */}
      <Modal
        visible={wikiModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setWikiModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalBackgroundClick} 
            onPress={() => setWikiModalVisible(false)} 
            activeOpacity={1}
          />

          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setWikiModalVisible(false)}
            >
              <CloseIcon size={24} color="#000" />
            </TouchableOpacity>
            <WebView 
              source={{ uri: wikiUrl }}
              style={styles.webView}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              scalesPageToFit={true}
              mixedContentMode="always"
            />
          </View>

          <View style={[styles.adContainer, { marginBottom: 0 }]} >
            <MyAds type="adaptive" size={BannerAdSize.BANNER} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  bookHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  adContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  bookImage: {
    width: 120,
    height: 180,
    borderRadius: 8,
    resizeMode: 'cover',
    marginRight: 15,
  },
  imagePlaceholder: {
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#999',
    fontSize: 12,
  },
  bookInfo: {
    flex: 1,
  },
  badge: {
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    lineHeight: 28,
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  author: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
  wikiButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  wikiButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  descriptionContainer: {
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  moreButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  moreButtonText: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 30,
    gap: 12,
  },
  viewStoreButton: {
    flex: 1,
    backgroundColor: '#4285F4',
    borderRadius: 8,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewStoreText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  previewButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '600',
  },
  tabNavigation: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 20,
  },
  tab: {
    paddingBottom: 12,
    marginRight: 24,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4285F4',
  },
  tabText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4285F4',
    fontWeight: '600',
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  tabContentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  tabContentText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 24,
  },
  tabContentSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  infoSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#666',
    marginTop: 10,
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackgroundClick: {
    flex: 1,
  },
  modalContent: {
    height: '90%',
    width: '100%',
    top: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  closeModalButton: {
    alignSelf: 'flex-end',
    padding: 15,
    zIndex: 1,
  },
  webView: {
    flex: 1,
  },
});

