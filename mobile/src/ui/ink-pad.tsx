import { useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import type { Point, Stroke } from '@/domain/ink';
import { Button, Row, T } from '@/ui/primitives';
import { radius, tokens, useTheme } from '@/ui/theme';

/**
 * A surface to write on.
 *
 * Built on the view responder rather than a gesture library: the only thing
 * needed here is where a finger is, and keeping it plain means the pad has no
 * dependency that could stop it working inside Expo Go.
 *
 * The pad reports strokes in its own pixel space. `src/domain/ink.ts` turns
 * those into the 28x28 fields the model reads.
 */
export const PAD_HEIGHT = 170;
/** Brush width in pad pixels — about what a fingertip lays down. */
export const PAD_THICKNESS = 3.4;

const path = (stroke: Stroke): string =>
  stroke.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');

export function InkPad({ strokes, onChange, disabled = false }: {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: PAD_HEIGHT });
  const [drawing, setDrawing] = useState<Stroke>([]);
  // Kept in a ref as well so the responder callbacks never read a stale stroke.
  const current = useRef<Stroke>([]);

  const measure = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  const add = (x: number, y: number) => {
    const point: Point = { x, y };
    const last = current.current[current.current.length - 1];
    // Touch events repeat on the same pixel; dropping those keeps the stroke small.
    if (last && Math.abs(last.x - x) < 1 && Math.abs(last.y - y) < 1) return;
    current.current = [...current.current, point];
    setDrawing(current.current);
  };

  const finish = () => {
    if (current.current.length) onChange([...strokes, current.current]);
    current.current = [];
    setDrawing([]);
  };

  return (
    <View style={{ gap: 9 }}>
      <View
        accessibilityLabel="Writing area"
        onLayout={measure}
        onStartShouldSetResponder={() => !disabled}
        onMoveShouldSetResponder={() => !disabled}
        onResponderGrant={(event) => { current.current = []; add(event.nativeEvent.locationX, event.nativeEvent.locationY); }}
        onResponderMove={(event) => add(event.nativeEvent.locationX, event.nativeEvent.locationY)}
        onResponderRelease={finish}
        onResponderTerminate={finish}
        style={{
          height: PAD_HEIGHT, borderRadius: radius.md, backgroundColor: theme.surface,
          borderWidth: 1.4, borderColor: theme.border, overflow: 'hidden',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <Svg width="100%" height="100%">
          {/* A baseline to write on, so symbols land side by side with gaps. */}
          <Line x1={14} y1={PAD_HEIGHT * 0.74} x2={size.width - 14} y2={PAD_HEIGHT * 0.74} stroke={theme.border} strokeWidth={1} strokeDasharray="5 6" />
          {[...strokes, drawing].map((stroke, index) =>
            stroke.length ? (
              <Path
                key={index}
                d={path(stroke)}
                stroke={theme.text}
                strokeWidth={PAD_THICKNESS * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ) : null,
          )}
        </Svg>
      </View>
      <Row style={{ gap: 8 }}>
        <T variant="bodyS" color={theme.muted} style={{ flex: 1 }}>
          {strokes.length ? `${strokes.length} stroke${strokes.length === 1 ? '' : 's'}` : 'Write one symbol at a time, with a gap between them.'}
        </T>
        <Button title="Undo" variant="outline" disabled={!strokes.length} onPress={() => onChange(strokes.slice(0, -1))} />
        <Button title="Clear" variant="outline" disabled={!strokes.length} onPress={() => onChange([])} />
      </Row>
    </View>
  );
}

/** The 28x28 field the model actually sees, drawn back at a readable size. */
export function FieldPreview({ field, size = 56 }: { field: Float64Array; size?: number }) {
  const theme = useTheme();
  const cell = size / 28;
  const cells: { x: number; y: number; ink: number }[] = [];
  for (let y = 0; y < 28; y += 1) {
    for (let x = 0; x < 28; x += 1) {
      const ink = field[y * 28 + x];
      if (ink > 0.04) cells.push({ x, y, ink });
    }
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: theme.surfaceAlt, overflow: 'hidden' }}>
      <Svg width={size} height={size}>
        {cells.map((c) => (
          <Line
            key={`${c.x}-${c.y}`}
            x1={c.x * cell} y1={c.y * cell + cell / 2} x2={(c.x + 1) * cell} y2={c.y * cell + cell / 2}
            stroke={tokens.brand.sky} strokeWidth={cell} opacity={c.ink}
          />
        ))}
      </Svg>
    </View>
  );
}
