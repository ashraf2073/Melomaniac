import { Alert, Platform, ToastAndroid } from 'react-native';

/** Tiny cross-platform "toast": native toast on Android, an alert on iOS. */
export function notify(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(message);
}
