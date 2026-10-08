import { useState } from 'react';
import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';

/** Khan Academy's own low-bitrate file (CC BY-NC-SA), small enough for a shared tablet. */
const url = (id: string) => `https://cdn.kastatic.org/KA-youtube-converted/${id}.mp4-low/${id}-low.mp4`;
const dir = () => new Directory(Paths.document, 'videos');
const cached = (id: string) => new File(dir(), `${id}.mp4`);

/** Local file uri once cached; `download` fetches it while online. Null uri = not on this tablet yet. Key the caller by `id`. */
export function useLessonVideo(id: string) {
  const supported = Platform.OS !== 'web';
  const [uri, setUri] = useState<string | null>(() => (supported && cached(id).exists ? cached(id).uri : null));

  const download = async () => {
    dir().create({ idempotent: true });
    const part = await File.downloadFileAsync(url(id), new File(dir(), `${id}.part`), { idempotent: true });
    part.move(cached(id)); // ponytail: a half download never counts as cached
    setUri(cached(id).uri);
  };

  return { uri, download, supported };
}
