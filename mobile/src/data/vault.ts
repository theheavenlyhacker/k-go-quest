import * as SecureStore from 'expo-secure-store';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export const vault = {
  get: (key: string) => SecureStore.getItemAsync(key, options),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value, options),
  remove: (key: string) => SecureStore.deleteItemAsync(key, options),
};
