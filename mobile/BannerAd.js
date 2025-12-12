import React from 'react';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

export default function MyAds({ type, size }) {
  let adUnitId;

  switch (type) {
    case "adaptive":
      adUnitId = __DEV__ ? TestIds.BANNER : "ca-app-pub-3940256099942544/9214589741";
      break;
    case "native":
      adUnitId = __DEV__ ? TestIds.BANNER : "ca-app-pub-3940256099942544/2247696110";
      break;
    case "nativeVideo":
      adUnitId = __DEV__ ? TestIds.BANNER : "ca-app-pub-3940256099942544/1044960115";
      break;
    default:
      adUnitId = TestIds.BANNER;
  }

  return <BannerAd unitId={adUnitId} size={size || BannerAdSize.BANNER} />;
}

