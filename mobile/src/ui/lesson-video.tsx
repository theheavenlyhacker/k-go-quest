import { View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Download } from 'lucide-react-native';

import { Action } from '@/ui/primitives';
import { useLessonVideo } from '@/ui/use-lesson-video';

/** Khan Academy video, played from the tablet once cached. Download needs a network, once. */
export function LessonVideo({ id }: { id: string }) {
  const { uri, download, supported } = useLessonVideo(id);
  const player = useVideoPlayer(uri, () => {});

  if (uri) return <VideoView player={player} nativeControls contentFit="contain" style={{ height: 200, backgroundColor: '#000' }} />;
  if (!supported) return null;
  return (
    <View style={{ padding: 14 }}>
      <Action title="Download video (Khan Academy)" icon={Download} task={download} />
    </View>
  );
}
