import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';

import { identifyQuizPaper, markingGrid, parseQuizPapers, type PaperAnswer, type QuizResults, type ServerQuiz, type ServerQuizPaper } from '../domain/quiz';
import { useOnline } from '../state/online-context';
import { readPaperPhoto } from './read-paper-photo';
import { Button, Info, Row, T } from './primitives';
import { MIN_TOUCH, tokens, useTheme } from './theme';

const message = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
const letters = ['A', 'B', 'C', 'D'];

/** QR identification, then one still read in JS to pre-fill the grid; the photo is discarded and nothing saves without Confirm. */
export function QuizScanner({ quiz, onDone }: { quiz: ServerQuiz; onDone: () => void }) {
  const theme = useTheme();
  const { caretakerCall } = useOnline();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [papers, setPapers] = useState<ServerQuizPaper[] | null>(null);
  const [paper, setPaper] = useState<ServerQuizPaper | null>(null);
  const [answers, setAnswers] = useState<PaperAnswer[]>([]);
  const [saved, setSaved] = useState<{ score: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<boolean[]>([]);
  const [reading, setReading] = useState(false);
  const camera = useRef<CameraView>(null);
  const scanned = useRef(false);
  const supported = quiz.questions.every((q) => q.options.length <= 4)
    && quiz.answerKey.every((k) => k.correctOption < 4);

  const loadPapers = () => {
    setError(null);
    void caretakerCall('POST', `quizzes/${quiz.id}/papers`).then(parseQuizPapers).then(setPapers).catch((e: unknown) => setError(message(e)));
  };
  useEffect(() => {
    if (!supported) return;
    let live = true;
    caretakerCall('POST', `quizzes/${quiz.id}/papers`).then(parseQuizPapers)
      .then((list) => { if (live) setPapers(list); }).catch((e: unknown) => { if (live) setError(message(e)); });
    return () => { live = false; };
  }, [caretakerCall, quiz.id, supported]);

  const next = () => { scanned.current = false; setPaper(null); setSaved(null); setAnswers([]); setFlagged([]); setError(null); };
  const scan = (data: string) => {
    if (scanned.current || !papers) return;
    scanned.current = true;
    let identified: ServerQuizPaper;
    try { identified = identifyQuizPaper(data, quiz.id, papers); }
    catch (e) { setError(message(e)); return; }
    const blank = quiz.questions.map(() => null as PaperAnswer);
    const open = (a: PaperAnswer[], f: boolean[]) => { setAnswers(a); setFlagged(f); setPaper(identified); setReading(false); };
    setReading(true);
    // Any failure (no fiducials, camera error) falls back to manual marking without an error.
    void (camera.current ? readPaperPhoto(camera.current, quiz.questions.length) : Promise.resolve(null)).then((r) => {
      if (!r) return open(blank, []);
      const ok = r.answers.map((a, i) => a !== null && a < quiz.questions[i].options.length ? a : null);
      open(ok, r.flagged);
    });
  };
  const confirm = async () => {
    if (!paper || busy) return;
    setBusy(true); setError(null);
    try { setSaved(await caretakerCall('POST', `quizzes/${quiz.id}/results`, { paperId: paper.id, answers })); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const permissionAction = (work: () => Promise<unknown>) => { void work().catch((e: unknown) => setError(message(e))); };

  if (!supported) return <>
    <Info title="A–D papers only" text="This Quiz has an item with more than four options. Create a new Quiz using A–D items to scan papers." color={tokens.state.warning} />
    <Button title="Back to Quiz" variant="soft" onPress={onDone} />
  </>;

  if (saved) return <>
    <Info title="Paper saved" text={`${paper?.alias}: ${saved.score} / ${saved.total}. Mastery and Coins are unchanged.`} />
    <Button title="Next paper" onPress={next} />
    <Button title="Done marking" variant="soft" onPress={onDone} />
  </>;

  if (paper) {
    const grid = markingGrid(quiz, answers);
    return <>
      <T variant="titleM">{paper.alias}</T>
      <T variant="bodyS" color={theme.muted}>Check each answer against the paper. Highlighted items could not be read clearly, so please set them yourself.</T>
      <T variant="titleS">{`Score: ${grid.score} / ${grid.total}`}</T>
      {grid.rows.map((row, index) => <View key={row.number} style={{ gap: 4, ...(flagged[index] ? { borderWidth: 2, borderColor: tokens.state.warning, borderRadius: 8, padding: 4 } : {}) }}>
        <Row style={{ gap: 4 }}>
          <T variant="titleS" style={{ width: 22 }}>{row.number}</T>
          {[0, 1, 2, 3, null].map((option) => <Pressable key={option ?? 'blank'} accessibilityRole="button"
            accessibilityLabel={`Item ${row.number}, ${option === null ? 'blank' : letters[option]}`}
            accessibilityState={{ selected: row.answer === option, disabled: busy || (option !== null && option >= quiz.questions[index].options.length) }} disabled={busy || (option !== null && option >= quiz.questions[index].options.length)}
            onPress={() => setAnswers((old) => old.map((a, i) => i === index ? option : a))}
            style={{ minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 8,
              borderColor: theme.border, backgroundColor: row.answer === option ? theme.surfaceAlt : theme.surface }}>
            <T variant="bodyS">{option === null ? 'Blank' : letters[option]}</T>
          </Pressable>)}
        </Row>
        <T variant="bodyS" color={row.correct ? tokens.state.success : theme.muted}>{`${row.answer === null ? 'Blank' : row.correct ? 'Correct' : 'Incorrect'} · Key: ${letters[row.correctOption]}`}</T>
      </View>)}
      {error ? <Info title="Paper was not saved" text={error} color={tokens.state.critical} /> : null}
      <Button title="Confirm" loading={busy} onPress={() => void confirm()} />
      <Button title="Scan another paper without saving" variant="soft" disabled={busy} onPress={next} />
      <Button title="Back to Quiz" variant="soft" disabled={busy} onPress={onDone} />
    </>;
  }

  return <>
    <T variant="bodyS" color={theme.muted}>Point the camera at this Quiz&apos;s paper QR code and hold the whole sheet in view. The photo is used once to pre-fill answers, then deleted.</T>
    {error ? <><Info title="Could not scan this paper" text={error} color={tokens.state.critical} />
      <Button title="Try again" onPress={papers ? next : loadPapers} /></> : !permission || !papers ? <ActivityIndicator accessibilityLabel="Preparing scanner" />
      : !papers.length ? <Info title="No Quiz Papers" text="Add active Learners to this Classroom before scanning." />
      : !permission.granted ? <>
        <Info title="Camera access needed" text="Allow the camera to read paper QR codes. If access is denied, open Settings and enable Camera for K-Go Quests, then check permission." color={tokens.state.warning} />
        {permission.canAskAgain ? <Button title="Allow camera" onPress={() => permissionAction(requestPermission)} /> : null}
        <Button title="Open Settings" variant="soft" onPress={() => permissionAction(Linking.openSettings)} />
        <Button title="Check permission" variant="soft" onPress={() => permissionAction(getPermission)} />
      </> : <CameraView ref={camera} style={{ height: 300, width: '100%' }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => scan(data)} onMountError={(e) => setError(e.message)} />}
    {reading ? <ActivityIndicator accessibilityLabel="Reading sheet" /> : null}
    <Button title="Back to Quiz" variant="soft" onPress={onDone} />
  </>;
}

export function PaperQuizResults({ quizId }: { quizId: string }) {
  const { caretakerGet } = useOnline();
  const [results, setResults] = useState<QuizResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    caretakerGet<QuizResults>(`quizzes/${quizId}/results`).then((next) => { if (live) setResults(next); })
      .catch((e: unknown) => { if (live) setError(message(e)); });
    return () => { live = false; };
  }, [caretakerGet, quizId]);
  if (error) return <Info title="Could not load paper results" text={error} color={tokens.state.critical} />;
  if (!results) return <ActivityIndicator accessibilityLabel="Loading paper results" />;
  return <>
    <T variant="titleS">{`${results.submittedCount} submitted · ${results.classAverage === null ? 'No class average yet' : `${Math.round(results.classAverage)}% class average`}`}</T>
    {results.learners.map((learner) => <T key={learner.paperId} variant="bodyS">{`${learner.alias}: ${learner.score} / ${results.total}`}</T>)}
    <T variant="titleS">Item difficulty</T>
    {results.items.map((item, i) => <T key={item.exerciseId} variant="bodyS">{`Item ${i + 1}: ${item.difficulty === null ? 'No submissions yet' : `${Math.round(item.difficulty * 100)}% incorrect or blank`}`}</T>)}
  </>;
}
