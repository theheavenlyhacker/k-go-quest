import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { BookOpen, Check, ChevronRight, Crown, Flag, Star, Trophy } from 'lucide-react-native';
import { lessonPath } from '@/domain/lesson-path';
import type { Attempt } from '@/domain/engine';
import type { Pack } from '@/domain/types';
import { Bar, Button, Card, Row, T } from './primitives';
import { useSubjectTheme, tokens, useTheme } from './theme';

const STEP = 142;

/** A recommended route through practice; every saved lesson remains tappable. */
export function LessonPath({ pack, attempts }: { pack: Pack; attempts: Attempt[] }) {
  const theme = useTheme();
  const tone = useSubjectTheme()[pack.subject];
  const router = useRouter();
  const [width, setWidth] = useState(335);
  const path = lessonPath(pack, attempts);
  const point = (index: number) => ({ x: width / 2 + Math.sin(index * 1.25) * Math.min(70, width * 0.2), y: 66 + index * STEP });
  const connectors = path.nodes.slice(1).map((_, index) => {
    const a = point(index), b = point(index + 1);
    return `M ${a.x} ${a.y} C ${a.x} ${a.y + STEP / 2}, ${b.x} ${b.y - STEP / 2}, ${b.x} ${b.y}`;
  }).join(' ');
  const open = (lessonId: string) => router.push({ pathname: '/lesson', params: { lessonId } });
  return <View style={{ gap: 18 }}>
    <View style={{ backgroundColor: tone.brand, borderRadius: 20, padding: 18, gap: 9 }}>
      <Row style={{ gap: 10 }}><BookOpen size={22} color="#fff" /><View style={{ flex: 1, gap: 3 }}><T variant="eyebrow" color="#fff">YOUR LEARNING PATH · GRADE {pack.grade}</T><T variant="titleM" color="#fff">{pack.title}</T></View><Trophy size={25} color="#fff" /></Row>
      <Row><View style={{ flex: 1 }}><Bar value={path.total ? path.completed / path.total : 0} color="#ffffff" height={7} /></View><T variant="labelPill" color="#fff">{path.completed}/{path.total}</T></Row>
    </View>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: Math.max(140, path.nodes.length * STEP + 12), position: 'relative' }}>
      <Svg width={width} height="100%" style={{ position: 'absolute', top: 0, left: 0 }}><Path d={connectors} stroke={theme.dark ? '#34473b' : '#dbe8d0'} strokeWidth={8} strokeLinecap="round" strokeDasharray="2 16" fill="none" /></Svg>
      {path.nodes.map(item => {
        const p = point(item.index), current = item.state === 'current', complete = item.complete;
        const fill = complete ? tokens.brand.green : current ? '#78bd32' : theme.dark ? '#2a3335' : '#e6e9e1';
        const ink = complete || current ? '#fff' : theme.muted;
        const Icon = complete ? Check : current ? Star : BookOpen;
        return <View key={item.lesson.id} style={{ position: 'absolute', top: p.y - 38, left: p.x - 70, width: 140, alignItems: 'center', gap: 9 }}>
          {current ? <View style={{ position: 'absolute', top: -29, zIndex: 2, backgroundColor: theme.surface, borderWidth: 2, borderColor: '#78bd32', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 5 }}><T variant="labelPill" color={theme.dark ? '#a4db6c' : '#518923'}>{item.answered ? 'KEEP GOING' : 'START HERE'}</T></View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={`${complete ? 'Review' : current ? 'Continue' : 'Open'} level ${item.index + 1}: ${item.lesson.title}`} onPress={() => open(item.lesson.id)} style={({ pressed }) => ({ width: 78, height: 78, borderRadius: 39, backgroundColor: fill, borderBottomWidth: pressed ? 2 : 7, borderBottomColor: complete ? '#1d7550' : current ? '#508d23' : theme.dark ? '#1b2425' : '#c9d0c0', alignItems: 'center', justifyContent: 'center', transform: [{ translateY: pressed ? 5 : 0 }], ...(current ? { borderWidth: 3, borderColor: '#b1df79' } : {}) })}>
            <Icon size={32} strokeWidth={2.6} color={ink} fill={current ? '#fff' : 'none'} />
          </Pressable>
          <View style={{ alignItems: 'center', gap: 2, paddingHorizontal: 2 }}><T variant="labelPill" color={current ? theme.navActive : theme.muted}>LEVEL {item.index + 1}</T><T variant="titleS" lines={2} style={{ textAlign: 'center' }}>{item.lesson.title}</T></View>
        </View>;
      })}
    </View>
    <Card style={{ alignItems: 'center', gap: 9, paddingVertical: 22, borderWidth: 2, borderStyle: path.finished ? 'solid' : 'dashed', borderColor: path.finished ? tokens.brand.sun : theme.borderStrong, backgroundColor: path.finished ? tokens.tint.sun : theme.surface }}>
      <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: path.finished ? tokens.brand.sun : theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Crown size={29} color={path.finished ? '#fff' : theme.muted} /></View>
      <T variant="titleM">{path.finished ? 'Unit complete. Look at you go!' : 'Your next milestone'}</T>
      <T variant="bodyS" color={theme.muted} style={{ textAlign: 'center', maxWidth: 270 }}>{path.finished ? 'Every lesson has a saved answer. Revisit a level to practise or try another subject.' : `Complete ${path.total - path.completed} more lesson${path.total - path.completed === 1 ? '' : 's'} to finish this learning path.`}</T>
      {path.currentIndex >= 0 ? <Button title="Continue learning" icon={ChevronRight} onPress={() => open(path.nodes[path.currentIndex].lesson.id)} style={{ marginTop: 3 }} /> : <Row style={{ gap: 6 }}><Flag size={15} color={tokens.brand.sunDeep} /><T variant="labelPill" color={tokens.brand.sunDeep}>PRACTICE MILESTONE REACHED</T></Row>}
    </Card>
  </View>;
}
