import * as React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BookDetail from './BookDetail';
import { BookmarkProvider } from './BookmarkContext';
import SplashPage from './SplashPage';
import MainScreen from './MainScreen';
import SettingsPage from './SettingsPage';
import UserDataPage from './UserDataPage';

const Stack = createNativeStackNavigator();

// 디자인 시안에 없었던 Home 화면 - 주석 처리
// function HomeScreen({ navigation }) {
//   return (
//     <View style={styles.container}>
//       <TouchableOpacity
//         style={styles.countryButton}
//         onPress={() => navigation.navigate('Bookmark')}
//       >
//         <Text style={styles.buttonText}>🔖 내 북마크 확인하기</Text>
//       </TouchableOpacity>
//       <TouchableOpacity
//         style={styles.countryButton}
//         onPress={() => navigation.navigate('Settings')}
//       >
//         <Text style={styles.buttonText}>⚙️ 설정</Text>
//       </TouchableOpacity>
//       <Text style={styles.title}>🌏 나라를 선택하세요</Text>

//       <TouchableOpacity
//         style={styles.button}
//         onPress={() => navigation.navigate('KrMain')}
//       >
//         <Text style={styles.text}>🇰🇷 한국 베스트셀러</Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         style={styles.button}
//         onPress={() => navigation.navigate('UsMain')}
//       >
//         <Text style={styles.text}>🇺🇸 미국 베스트셀러</Text>
//       </TouchableOpacity>
//       <TouchableOpacity
//         style={styles.button}
//         onPress={() => navigation.navigate('JpMain')}
//       >
//         <Text style={styles.text}>🇯🇵 일본 베스트셀러</Text>
//       </TouchableOpacity>
//     </View>
//   );
// }

export default function App() {
  return (
    <BookmarkProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashPage} />
          <Stack.Screen name="Main" component={MainScreen} />
          <Stack.Screen name="KrDetail" component={BookDetail} />
          <Stack.Screen name="UsDetail" component={BookDetail} />
          <Stack.Screen name="JpDetail" component={BookDetail} />
          <Stack.Screen name="TwDetail" component={BookDetail} />
          <Stack.Screen name="FrDetail" component={BookDetail} />
          <Stack.Screen name="UkDetail" component={BookDetail} />
          <Stack.Screen name="EsDetail" component={BookDetail} />
          <Stack.Screen name="Settings" component={SettingsPage} />
          <Stack.Screen name="UserData" component={UserDataPage} />
        </Stack.Navigator>
      </NavigationContainer>
    </BookmarkProvider>
  );
}

// HomeScreen 관련 스타일 - 주석 처리
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#fff',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   title: {
//     fontSize: 26,
//     color: '#000',
//     marginBottom: 50,
//     fontWeight: 'bold',
//   },
//   button: {
//     backgroundColor: '#4285F4',
//     paddingVertical: 15,
//     paddingHorizontal: 50,
//     borderRadius: 12,
//     marginVertical: 10,
//   },
//   text: {
//     color: '#fff',
//     fontSize: 18,
//     fontWeight: '600',
//   },
//   countryButton: {
//     backgroundColor: '#4285F4',
//     paddingVertical: 12,
//     paddingHorizontal: 40,
//     borderRadius: 10,
//     marginVertical: 8,
//     alignItems: 'center',
//   },
//   buttonText: {
//     color: '#fff',
//     fontSize: 16,
//     fontWeight: '600',
//   },
// });
