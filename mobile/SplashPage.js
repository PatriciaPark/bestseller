import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 번역 데이터 (Google Sheets 기반)
// 참조: https://docs.google.com/spreadsheets/d/1GoeMU5HbM7g2jujoO5vBI6Z1BH_EjUtnVmV9zWAKpHs/edit?gid=0#gid=0
// Row 13: 제목 (title)
// Row 14: 부제목 (subtitle)
const translations = {
  korean: {
    title: '월드 베스트 셀러', // Row 13, Column A
    subtitle: '전 세계가 주목하는 놀라운 책들을 발견해보세요!', // Row 14, Column A
  },
  english: {
    title: 'World Best Sellers', // Row 13, Column B
    subtitle: 'Discover amazing books the world is talking about!', // Row 14, Column B
  },
  japanese: {
    title: 'ワールドベストセラーズ', // Row 13, Column C
    subtitle: '世界中が注目する素晴らしい本を見つけよう！', // Row 14, Column C
  },
  chinese: {
    title: '全球畅销书', // Row 13, Column D
    subtitle: '探索那些吸引全球关注的精彩书籍！', // Row 14, Column D
  },
  traditionalChinese: {
    title: '世界暢銷書', // Row 13, Column E
    subtitle: '發現全球都在熱議的精彩書籍！', // Row 14, Column E
  },
  french: {
    title: 'Meilleures ventes mondiales', // Row 13, Column F
    subtitle:
      'Découvrez des livres exceptionnels qui captivent le monde entier !', // Row 14, Column F
  },
  spanish: {
    title: 'Superventas mundiales', // Row 13, Column G
    subtitle:
      'Descubre libros increíbles de los que todo el mundo está hablando', // Row 14, Column G
  },
};

export default function SplashPage({ navigation }) {
  const [language, setLanguage] = useState('english');
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  // 언어 설정 불러오기
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('appLanguage');
        if (savedLanguage) {
          // 저장된 언어를 번역 키로 매핑
          const languageMap = {
            Korean: 'korean',
            English: 'english',
            Japanese: 'japanese',
            Chinese: 'chinese',
            'Traditional Chinese': 'traditionalChinese',
            French: 'french',
            spanish: 'spanish',
          };
          setLanguage(languageMap[savedLanguage] || 'english');
        }
      } catch (error) {
        console.error('언어 설정 불러오기 실패:', error);
      }
    };
    loadLanguage();
  }, []);

  // 자동으로 메인 화면으로 이동 (2초 후)
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.navigate('Main');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation]);

  useEffect(() => {
    const animateDots = () => {
      // 첫 번째 점
      Animated.sequence([
        Animated.timing(dot1Opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(dot1Opacity, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // 두 번째 점 (200ms 지연)
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(dot2Opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot2Opacity, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }, 200);

      // 세 번째 점 (400ms 지연)
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(dot3Opacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot3Opacity, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }, 400);
    };

    // 초기 애니메이션 시작
    animateDots();

    // 반복 실행 (각 사이클은 약 1.2초)
    const interval = setInterval(animateDots, 1200);

    return () => clearInterval(interval);
  }, [dot1Opacity, dot2Opacity, dot3Opacity]);

  const currentTranslations = translations[language] || translations.english;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('./assets/Frame1.png')}
          style={styles.iconImage}
          resizeMode="contain"
        />
        <View style={styles.textContainer}>
          <Text style={styles.title}>{currentTranslations.title}</Text>
          <Text style={styles.subtitle}>{currentTranslations.subtitle}</Text>
        </View>
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, { opacity: dot1Opacity }]} />
          <Animated.View style={[styles.dot, { opacity: dot2Opacity }]} />
          <Animated.View style={[styles.dot, { opacity: dot3Opacity }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconImage: {
    width: 150,
    height: 75,
    marginBottom: 32,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#E3F2FD',
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 48,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E3F2FD',
  },
});
