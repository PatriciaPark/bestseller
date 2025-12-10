import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import BookmarkScreen from './Bookmark';
import SettingsPage, { LANGUAGE_OPTIONS } from './SettingsPage';
import LoadingScreen from './LoadingScreen';
import { useBookmark } from './BookmarkContext';
import { useLanguage } from './LanguageContext';
import MyAds from './BannerAd';
import { BannerAdSize } from 'react-native-google-mobile-ads';

const COUNTRY_TABS = [
  { label: 'KOR', index: 0 },
  { label: 'JPN', index: 2 },
  { label: 'USA', index: 1 },
  { label: 'TWN', index: 5 },
  { label: 'FRA', index: 6 },
  { label: 'UK', index: 3 },
];

const COUNTRY_LABEL_TO_INDEX = COUNTRY_TABS.reduce((acc, tab) => {
  acc[tab.label] = tab.index;
  return acc;
}, {});

const INDEX_TO_COUNTRY_LABEL = COUNTRY_TABS.reduce((acc, tab) => {
  acc[tab.index] = tab.label;
  return acc;
}, {});

const COUNTRY_INDEX_TO_LABEL_COLUMN = {
  0: 0, // Korea -> Korean
  1: 1, // USA -> English
  2: 2, // Japan -> Japanese
  3: 1, // UK -> English
  4: 3, // China -> Chinese
  5: 4, // Taiwan -> Taiwanese
  6: 5, // France -> French
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
    if (originalLangs[userLanguage]) {
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
      if (activeCountryTab === 'TWN') return 'TwDetail';
      if (activeCountryTab === 'FRA') return 'FrDetail';
      if (activeCountryTab === 'UK') return 'UkDetail';
      return 'UsDetail';
    };

    const getCountry = () => {
      if (activeCountryTab === 'KOR') return 'KR';
      if (activeCountryTab === 'JPN') return 'JP';
      if (activeCountryTab === 'USA') return 'US';
      if (activeCountryTab === 'TWN') return 'TW';
      if (activeCountryTab === 'FRA') return 'FR';
      if (activeCountryTab === 'UK') return 'UK';
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
          onPress={(e) => {
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
            name={isBookmarked(item.title) ? "star" : "star-outline"} 
            size={24} 
            color={isBookmarked(item.title) ? "#FFD700" : "#999"} 
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
          {COUNTRY_TABS.map(tab => (
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
