import React, { useMemo, useState } from 'react';
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
import SettingsPage, { LANGUAGE_OPTIONS } from './SettingsPage';
import LoadingScreen from './LoadingScreen';
import { useBookmark } from './BookmarkContext';
import { useLanguage } from './LanguageContext';
import { useTheme } from './ThemeContext';
import { BannerAdSize } from 'react-native-google-mobile-ads';
import MyAds from './BannerAd';

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
    USA: 'USA', // Row 3, Column B
    GBR: 'UK', // Row 5, Column B
    KOR: 'Korea', // Row 2, Column B
    JPN: 'Japan', // Row 4, Column B
    CHN: 'China', // Row 6, Column B
    TPE: 'Taiwan', // Row 7, Column B
    FRA: 'France', // Row 8, Column B
    ESP: 'Spain',
  },
  spanish: {
    ESP: 'España',
    USA: 'EE. UU.',
    GBR: 'Reino Unido',
    KOR: 'Corea',
    JPN: 'Japón',
    CHN: 'China',
    TPE: 'Taiwán',
    FRA: 'Francia',
  },
};

const COUNTRY_TABS = [
  { label: 'KOR', index: 0 },
  { label: 'USA', index: 1 },
  { label: 'JPN', index: 2 },
  { label: 'GBR', index: 3 },
  { label: 'CHN', index: 4 },
  { label: 'TPE', index: 5 },
  { label: 'FRA', index: 6 },
  { label: 'ESP', index: 7 },
];

const INDEX_TO_COUNTRY_LABEL = {
  0: 'KOR',
  1: 'USA',
  2: 'JPN',
  3: 'GBR',
  4: 'CHN',
  5: 'TPE',
  6: 'FRA',
  7: 'ESP',
};

const COUNTRY_LABEL_TO_INDEX = {
  'KOR': 0,
  'USA': 1,
  'JPN': 2,
  'GBR': 3,
  'CHN': 4,
  'TPE': 5,
  'FRA': 6,
  'ESP': 7,
};

const COUNTRY_INDEX_TO_LABEL_COLUMN = {
  0: 1, // KOR -> Column B (English)
  1: 0, // USA -> Column A (Korean)
  2: 0, // JPN -> Column A (Korean)
  3: 0, // GBR -> Column A (Korean)
  4: 0, // CHN -> Column A (Korean)
  5: 0, // TPE -> Column A (Korean)
  6: 0, // FRA -> Column A (Korean)
  7: 0, // ESP -> Column A (Korean)
};

export default function MainScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('home');
  const { isBookmarked, toggleBookmark } = useBookmark();
  const {
    country,
    setCountry,
    language,
    setLanguage,
    userLanguage,
    filteredData,
    originalLangs,
    loading,
    error,
    fetchSheets,
  } = useLanguage();

  const activeCountryTab = useMemo(
    () => INDEX_TO_COUNTRY_LABEL[country] ?? 'KOR',
    [country]
  );

  const orderedCountryTabs = useMemo(() => {
    let order = ['KOR', 'USA', 'JPN', 'GBR', 'CHN', 'TPE', 'FRA', 'ESP'];
    
    if (userLanguage === 1) { // English
      order = ['USA', 'GBR', 'KOR', 'JPN', 'CHN', 'TPE', 'FRA', 'ESP'];
    } else if (userLanguage === 2) { // Japanese
      order = ['JPN', 'USA', 'KOR', 'GBR', 'CHN', 'TPE', 'FRA', 'ESP'];
    } else if (userLanguage === 3) { // Chinese
      order = ['CHN', 'USA', 'KOR', 'JPN', 'GBR', 'TPE', 'FRA', 'ESP'];
    } else if (userLanguage === 4) { // Traditional Chinese
      order = ['TPE', 'USA', 'KOR', 'JPN', 'GBR', 'CHN', 'FRA', 'ESP'];
    } else if (userLanguage === 5) { // French
      order = ['FRA', 'USA', 'GBR', 'KOR', 'JPN', 'CHN', 'TPE', 'ESP'];
    } else if (userLanguage === 6) { // Spanish
      order = ['ESP', 'USA', 'GBR', 'KOR', 'JPN', 'CHN', 'TPE', 'FRA'];
    }

    return order.map(label => COUNTRY_TABS.find(tab => tab.label === label));
  }, [userLanguage]);

  const books = useMemo(
    () =>
      filteredData.map(row => ({
        image: row[0] || '',
        title: row[1] || '',
        author: row[2] || '',
        authorInfo: row[3] || '',
        description: row[4] || '',
        moreInfo: row[5] || '',
      })),
    [filteredData]
  );

  const userLanguageLabel = useMemo(() => {
    const option = LANGUAGE_OPTIONS.find(opt => opt.value === userLanguage);
    return option ? option.label : '한국어';
  }, [userLanguage]);

  const originalLanguageIndex = COUNTRY_INDEX_TO_LABEL_COLUMN[country] ?? 1;
  
  const originalLabel = useMemo(() => {
    if (originalLangs && originalLangs[userLanguage]) {
      return originalLangs[userLanguage];
    }
    return 'Original';
  }, [userLanguage, originalLangs]);

  const setCountryByLabel = label => {
    const nextIndex = COUNTRY_LABEL_TO_INDEX[label];
    if (typeof nextIndex === 'number') {
      setCountry(nextIndex);
    }
  };

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
              other: item.moreInfo,
              rank: index + 1,
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
              other: item.moreInfo,
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
      return <LoadingScreen />;
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Text style={{ color: '#d32f2f', marginBottom: 12 }}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchSheets}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const visibleBooks = books.slice(0, 20);

    if (!visibleBooks.length) {
      return (
        <View style={styles.center}>
          <Text style={{ color: '#666' }}>표시할 데이터가 없습니다.</Text>
        </View>
      );
    }

    return (
      <View style={styles.homeContainer}>
        {/* 상단 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Best Sellers</Text>
          <View style={styles.languageToggle}>
            <TouchableOpacity
              style={[
                styles.languageOption,
                language === (userLanguage + 1) && styles.languageOptionActive
              ]}
              onPress={() => setLanguage(userLanguage + 1)}
            >
              <Text style={[
                styles.languageText,
                language === (userLanguage + 1) && styles.languageTextActive
              ]}>
              {userLanguageLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.languageOption,
                language === 0 && styles.languageOptionActive
              ]}
              onPress={() => setLanguage(0)}
            >
              <Text style={[
                styles.languageText,
                language === 0 && styles.languageTextActive
              ]}>
              {originalLabel}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 국가 선택 탭 */}
        <View style={styles.tabContainer}>
          {orderedCountryTabs.map(tab => (
            <TouchableOpacity
              key={tab.label}
              style={[styles.countryTab, activeCountryTab === tab.label && styles.activeCountryTab]}
              onPress={() => setCountryByLabel(tab.label)}
            >
              <Text
                style={[styles.countryTabText, activeCountryTab === tab.label && styles.activeCountryTabText]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 책 목록 */}
        <FlatList
          ListHeaderComponent={
            <View style={styles.adContainer}>
              <MyAds type="adaptive" size={BannerAdSize.BANNER} />
            </View>
          }
          data={visibleBooks}
          renderItem={renderBookItem}
          keyExtractor={(item, index) => `${activeCountryTab}-${index}`}
          contentContainerStyle={styles.listContainer}
          ListFooterComponent={
            <View style={styles.adContainer}>
              <MyAds type="adaptive" size={BannerAdSize.MEDIUM_RECTANGLE} />
            </View>
          }
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
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>
      
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
          <Text style={[styles.navLabel, activeTab === 'home' && styles.activeNavLabel]}>
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
          <Text style={[styles.navLabel, activeTab === 'bookmark' && styles.activeNavLabel]}>
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
          <Text style={[styles.navLabel, activeTab === 'settings' && styles.activeNavLabel]}>
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
  retryButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
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
  adContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
