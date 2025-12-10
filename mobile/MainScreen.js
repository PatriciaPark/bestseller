import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BookmarkScreen from './Bookmark';
import SettingsPage from './SettingsPage';
import { useBookmark } from './BookmarkContext';
import apiConfig from './config/api';

// 번역 데이터 (Google Sheets 기반)
// 참조: https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/edit?gid=0#gid=0
// Row 2-8: 국가 이름
// Row 20: Best Sellers
const translations = {
  korean: {
    bestSellers: '베스트 셀러', // Row 20, Column A
  },
  english: {
    bestSellers: 'Best Sellers', // Row 20, Column B
  },
  japanese: {
    bestSellers: 'ベストセラーズ', // Row 20, Column C
  },
  chinese: {
    bestSellers: '畅销书', // Row 20, Column D
  },
  traditionalChinese: {
    bestSellers: '暢銷書', // Row 20, Column E
  },
  french: {
    bestSellers: 'Meilleures ventes', // Row 20, Column F
  },
  spanish: {
    bestSellers: 'Superventas',
  },
};

const countryTranslations = {
  korean: {
    KOR: '한국', // Row 2, Column A
    USA: '미국', // Row 3, Column A
    JPN: '일본', // Row 4, Column A
    GBR: '영국', // Row 5, Column A
    CHN: '중국', // Row 6, Column A
    TPE: '대만', // Row 7, Column A
    FRA: '프랑스', // Row 8, Column A
    ESP: '스페인',
  },
  japanese: {
    JPN: '日本', // Row 4, Column C
    USA: '美国', // Row 3, Column C
    KOR: '韓国', // Row 2, Column C
    CHN: '中国', // Row 6, Column C
    TPE: '台湾', // Row 7, Column C
    GBR: '英国', // Row 5, Column C
    FRA: '仏国', // Row 8, Column C
    ESP: 'スペイン',
  },
  chinese: {
    CHN: '中国', // Row 6, Column D
    TPE: '台湾', // Row 7, Column D
    USA: '美国', // Row 3, Column D
    JPN: '日本', // Row 4, Column D
    KOR: '韩国', // Row 2, Column D
    GBR: '英国', // Row 5, Column D
    FRA: '法国', // Row 8, Column D
    ESP: '西班牙',
  },
  traditionalChinese: {
    TPE: '台灣', // Row 7, Column E
    CHN: '中國', // Row 6, Column E
    USA: '美國', // Row 3, Column E
    JPN: '日本', // Row 4, Column E
    KOR: '韓國', // Row 2, Column E
    GBR: '英國', // Row 5, Column E
    FRA: '法國', // Row 8, Column E
    ESP: '西班牙',
  },
  french: {
    FRA: 'France', // Row 8, Column F
    USA: 'USA', // Row 3, Column F
    GBR: 'UK', // Row 5, Column F
    KOR: 'Corée', // Row 2, Column F
    JPN: 'Japon', // Row 4, Column F
    CHN: 'Chine', // Row 6, Column F
    TPE: 'Taïwan', // Row 7, Column F
    ESP: 'Espagne',
  },
  english: {
    USA: 'USA',
    GBR: 'GBR',
    FRA: 'FRA',
    KOR: 'KOR',
    JPN: 'JPN',
    CHN: 'CHN',
    TPE: 'TPE',
    ESP: 'ESP',
  },
  spanish: {
    USA: 'USA',
    GBR: 'UK',
    FRA: 'Francia',
    KOR: 'Corea',
    JPN: 'Japón',
    CHN: 'China',
    TPE: 'Taiwán',
    ESP: 'España',
  },
};

export default function MainScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('home');
  const [activeCountryTab, setActiveCountryTab] = useState('KOR');
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState('original'); // 'korean' or 'original'
  const [appLanguage, setAppLanguage] = useState('English'); // 앱 언어 설정
  const { isBookmarked, toggleBookmark } = useBookmark();

  // 앱 언어 설정 불러오기
  useEffect(() => {
    const loadAppLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('appLanguage');
        if (savedLanguage) {
          setAppLanguage(savedLanguage);
        }
      } catch (error) {
        console.error('언어 설정 불러오기 실패:', error);
      }
    };
    loadAppLanguage();

    // 화면이 포커스될 때마다 언어 설정 다시 불러오기
    const unsubscribe = navigation.addListener('focus', () => {
      loadAppLanguage();
    });

    return unsubscribe;
  }, [navigation]);

  // 📘 베스트셀러 데이터 가져오기 (Home 탭일 때만)
  useEffect(() => {
    if (activeTab !== 'home') return;

    const fetchBooks = async () => {
      setLoading(true);
      try {
        let url = '';
        if (activeCountryTab === 'KOR') {
          url = apiConfig.endpoints.krBooks;
        } else if (activeCountryTab === 'JPN') {
          url = apiConfig.endpoints.jpBooks;
        } else if (activeCountryTab === 'USA') {
          url = apiConfig.endpoints.usBooks;
        } else if (activeCountryTab === 'TPE') {
          url = apiConfig.endpoints.twBooks;
        } else if (activeCountryTab === 'FRA') {
          url = apiConfig.endpoints.frBooks;
        } else if (activeCountryTab === 'GBR') {
          url = apiConfig.endpoints.ukBooks;
        } else if (activeCountryTab === 'CHN') {
          // 중국 데이터가 있다면 추가
          url = apiConfig.endpoints.twBooks; // 임시로 대만 URL 사용
        } else if (activeCountryTab === 'ESP') {
          url = apiConfig.endpoints.esBooks;
        }

        const res = await fetch(url);
        const data = await res.json();
        setBooks(data.books || []);
        setLoading(false);
      } catch (err) {
        console.error('❌ Fetch Error:', err);
        setLoading(false);
      }
    };

    fetchBooks();
  }, [activeTab, activeCountryTab]);

  // 📚 책 아이템 렌더링
  const renderBookItem = ({ item, index }) => {
    const getDetailScreen = () => {
      if (activeCountryTab === 'KOR') return 'KrDetail';
      if (activeCountryTab === 'JPN') return 'JpDetail';
      if (activeCountryTab === 'USA') return 'UsDetail';
      if (activeCountryTab === 'TPE') return 'TwDetail';
      if (activeCountryTab === 'FRA') return 'FrDetail';
      if (activeCountryTab === 'GBR') return 'UkDetail';
      if (activeCountryTab === 'CHN') return 'TwDetail'; // 임시로 대만 디테일 사용
      if (activeCountryTab === 'ESP') return 'EsDetail';
      return 'UsDetail';
    };

    const getCountry = () => {
      if (activeCountryTab === 'KOR') return 'KR';
      if (activeCountryTab === 'JPN') return 'JP';
      if (activeCountryTab === 'USA') return 'US';
      if (activeCountryTab === 'TPE') return 'TW';
      if (activeCountryTab === 'FRA') return 'FR';
      if (activeCountryTab === 'GBR') return 'UK';
      if (activeCountryTab === 'CHN') return 'CN';
      if (activeCountryTab === 'ESP') return 'ES';
      return 'US';
    };

    return (
      <TouchableOpacity
        style={styles.bookItem}
        onPress={() => {
          navigation.navigate(getDetailScreen(), {
            book: {
              title: item.title,
              author: item.author,
              publisher: item.publisher,
              image: item.image,
              link: item.link,
              country: getCountry(),
              // 상세 정보 필드도 전달 (캐시에서 온 데이터)
              description: item.description,
              contents: item.contents,
              authorInfo: item.authorInfo,
              publisherReview: item.publisherReview,
              plot: item.plot,
            },
          });
        }}
      >
        <View style={styles.rankContainer}>
          <Text style={styles.rank}>{index + 1}</Text>
        </View>

        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.bookImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>No Image</Text>
          </View>
        )}

        <View style={styles.bookInfo}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.bookAuthor} numberOfLines={1}>
            {item.author || 'Unknown Author'}
          </Text>
          {item.publisher && (
            <Text style={styles.bookMeta} numberOfLines={1}>
              {item.publisher} {item.genre ? `• ${item.genre}` : ''}
            </Text>
          )}
          {item.description && (
            <Text style={styles.bookDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.bookmarkIcon}
          onPress={e => {
            e.stopPropagation();
            const bookData = {
              title: item.title,
              author: item.author,
              publisher: item.publisher,
              image: item.image,
              link: item.link,
              country: getCountry(),
              // 상세 정보 필드도 포함
              description: item.description,
              contents: item.contents,
              authorInfo: item.authorInfo,
              publisherReview: item.publisherReview,
              plot: item.plot,
            };
            toggleBookmark(bookData);
          }}
        >
          <Icon
            name={isBookmarked(item.title) ? 'star' : 'star-outline'}
            size={24}
            color={isBookmarked(item.title) ? '#FFD700' : '#999'}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderHomeContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={{ color: '#666', marginTop: 10 }}>불러오는 중...</Text>
        </View>
      );
    }

    return (
      <View style={styles.homeContainer}>
        {/* 상단 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {(() => {
              const languageMap = {
                Korean: 'korean',
                English: 'english',
                Japanese: 'japanese',
                Chinese: 'chinese',
                'Traditional Chinese': 'traditionalChinese',
                French: 'french',
                spanish: 'spanish',
              };
              const langKey = languageMap[appLanguage] || 'english';
              return (
                translations[langKey]?.bestSellers ||
                translations.english.bestSellers
              );
            })()}
          </Text>
          <View style={styles.languageToggle}>
            <TouchableOpacity
              style={[
                styles.languageOption,
                language === 'korean' && styles.languageOptionActive,
              ]}
              onPress={() => setLanguage('korean')}
            >
              <Text
                style={[
                  styles.languageText,
                  language === 'korean' && styles.languageTextActive,
                ]}
              >
                한국어
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.languageOption,
                language === 'original' && styles.languageOptionActive,
              ]}
              onPress={() => setLanguage('original')}
            >
              <Text
                style={[
                  styles.languageText,
                  language === 'original' && styles.languageTextActive,
                ]}
              >
                Original
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 국가 선택 탭 */}
        <View style={styles.tabContainerWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabContainer}
          >
            {(() => {
              // 언어에 따른 국가 순서 및 번역 가져오기
              const getCountryOrder = () => {
                const languageMap = {
                  Korean: 'korean',
                  English: 'english',
                  Japanese: 'japanese',
                  Chinese: 'chinese',
                  'Traditional Chinese': 'traditionalChinese',
                  French: 'french',
                  spanish: 'spanish',
                };
                const langKey = languageMap[appLanguage] || 'english';
                const translations =
                  countryTranslations[langKey] || countryTranslations.english;

                // 언어별 국가 순서
                const orders = {
                  korean: [
                    'KOR',
                    'USA',
                    'JPN',
                    'GBR',
                    'CHN',
                    'TPE',
                    'FRA',
                    'ESP',
                  ],
                  japanese: [
                    'JPN',
                    'USA',
                    'KOR',
                    'CHN',
                    'TPE',
                    'GBR',
                    'FRA',
                    'ESP',
                  ],
                  chinese: [
                    'CHN',
                    'TPE',
                    'USA',
                    'JPN',
                    'KOR',
                    'GBR',
                    'FRA',
                    'ESP',
                  ],
                  traditionalChinese: [
                    'TPE',
                    'CHN',
                    'USA',
                    'JPN',
                    'KOR',
                    'GBR',
                    'FRA',
                  ],
                  french: [
                    'FRA',
                    'USA',
                    'GBR',
                    'KOR',
                    'JPN',
                    'CHN',
                    'TPE',
                    'ESP',
                  ],
                  english: [
                    'USA',
                    'GBR',
                    'FRA',
                    'KOR',
                    'JPN',
                    'CHN',
                    'TPE',
                    'ESP',
                  ],
                  spanish: [
                    'ESP',
                    'FRA',
                    'USA',
                    'GBR',
                    'KOR',
                    'JPN',
                    'CHN',
                    'TPE',
                  ],
                };

                return {
                  order: orders[langKey] || orders.english,
                  translations,
                };
              };

              const { order, translations } = getCountryOrder();

              return order.map(countryCode => (
                <TouchableOpacity
                  key={countryCode}
                  style={[
                    styles.countryTab,
                    activeCountryTab === countryCode && styles.activeCountryTab,
                  ]}
                  onPress={() => setActiveCountryTab(countryCode)}
                >
                  <Text
                    style={[
                      styles.countryTabText,
                      activeCountryTab === countryCode &&
                        styles.activeCountryTabText,
                    ]}
                  >
                    {translations[countryCode] || countryCode}
                  </Text>
                </TouchableOpacity>
              ));
            })()}
          </ScrollView>
        </View>

        {/* 책 목록 */}
        <FlatList
          data={books.slice(0, 20)}
          renderItem={renderBookItem}
          keyExtractor={(item, index) => `${activeCountryTab}-${index}`}
          contentContainerStyle={styles.listContainer}
        />
      </View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return renderHomeContent();
      case 'bookmark':
        return <BookmarkScreen navigation={navigation} />;
      case 'settings':
        return <SettingsPage navigation={navigation} />;
      default:
        return renderHomeContent();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>{renderContent()}</View>

      {/* 하단 네비게이션 */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('home')}
        >
          <Icon
            name="home-outline"
            size={24}
            color={activeTab === 'home' ? '#4285F4' : '#666'}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'home' && styles.activeNavLabel,
            ]}
          >
            Home
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('bookmark')}
        >
          <Icon
            name="bookmark-outline"
            size={24}
            color={activeTab === 'bookmark' ? '#4285F4' : '#666'}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'bookmark' && styles.activeNavLabel,
            ]}
          >
            Bookmarks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('settings')}
        >
          <Icon
            name="cog-outline"
            size={24}
            color={activeTab === 'settings' ? '#4285F4' : '#666'}
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'settings' && styles.activeNavLabel,
            ]}
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flex: 1,
    paddingBottom: 80, // 하단 네비게이션 공간 확보
  },
  homeContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  languageToggle: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  languageOption: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
  },
  languageOptionActive: {
    backgroundColor: '#4285F4',
  },
  languageText: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  languageTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  tabContainerWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  countryTab: {
    marginRight: 30,
    paddingBottom: 10,
  },
  activeCountryTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#4285F4',
  },
  countryTabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeCountryTabText: {
    color: '#4285F4',
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 20,
  },
  bookItem: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rankContainer: {
    width: 30,
    justifyContent: 'flex-start',
    paddingTop: 5,
  },
  rank: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  bookImage: {
    width: 80,
    height: 120,
    borderRadius: 8,
    resizeMode: 'cover',
    marginRight: 15,
  },
  imagePlaceholder: {
    width: 80,
    height: 120,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  placeholderText: {
    color: '#999',
    fontSize: 12,
  },
  bookInfo: {
    flex: 1,
    paddingRight: 10,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
    lineHeight: 22,
  },
  bookAuthor: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  bookMeta: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  bookDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  bookmarkIcon: {
    paddingTop: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    paddingBottom: 25,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    zIndex: 1000,
  },
  navItem: {
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 12,
    color: '#666',
  },
  activeNavLabel: {
    color: '#4285F4',
    fontWeight: 'bold',
  },
});
