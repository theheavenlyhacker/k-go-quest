import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Check, Replace, Trash2 } from 'lucide-react-native';

import { skillLabel, suggestedSkills, toggleSkill, type ServerQuiz, type SkillChoice } from '../domain/quiz';
import { subjects, subjectTitles } from '../domain/subjects';
import type { Subject } from '../domain/types';
import { useOnline } from '../state/online-context';
import { useTeacher } from '../state/teacher-context';
import { Button, Field, Info, Pills, Row, Sheet, T } from './primitives';
import { MIN_TOUCH, tokens, useTheme } from './theme';

const COUNTS = ['5', '10', '15', '20'] as const;
const message = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong. Try again.');

/** A draft Quiz: the questions, with rename, remove, replace and publish. Used to preview a new draft and to edit an old one. */
function QuizDraft({ quizId, onDone }: { quizId: string; onDone: () => void }) {
  const theme = useTheme();
  const { caretakerGet, caretakerCall } = useOnline();
  const { reload } = useTeacher();
  const [quiz, setQuiz] = useState<ServerQuiz | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback((next: ServerQuiz) => { setQuiz(next); setTitle(next.title); }, []);
  useEffect(() => {
    caretakerGet<ServerQuiz>(`quizzes/${quizId}`).then(show).catch((e: unknown) => setError(message(e)));
  }, [caretakerGet, quizId, show]);

  const run = async (work: () => Promise<ServerQuiz>) => {
    setBusy(true); setError(null);
    try { show(await work()); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const patch = (body: object) => run(() => caretakerCall<ServerQuiz>('PATCH', `quizzes/${quizId}`, body));
  const close = () => { reload(); onDone(); };
  const published = quiz?.status === 'PUBLISHED';

  if (!quiz) return error ? <Info title="Could not open this quiz" text={error} color={tokens.state.critical} /> : <ActivityIndicator accessibilityLabel="Loading" color={theme.navActive} />;
  return (
    <>
      <T variant="bodyS" color={theme.muted}>Picked for your Classroom&apos;s weakest Skills. You can rename it, remove questions or replace them.</T>
      <Field label="Quiz title" value={title} editable={!published} onChangeText={setTitle} onEndEditing={() => { if (title.trim() && title !== quiz.title) void patch({ title: title.trim() }); }} />
      {quiz.questions.map((question, index) => (
        <View key={question.id} style={{ gap: 4, paddingVertical: 6, borderBottomWidth: 1, borderColor: theme.border }}>
          <T variant="titleS">{`${index + 1}. ${question.prompt}`}</T>
          <T variant="bodyS" color={theme.muted}>{`${skillLabel(question.skillCode)} · ${question.options.join(' / ')}`}</T>
          {published ? null : (
            <Row>
              <Pressable accessibilityRole="button" accessibilityLabel={`Replace question ${index + 1}`} disabled={busy} onPress={() => void patch({ replaceExerciseId: question.id })} style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}>
                <Row><Replace size={16} color={theme.navActive} /><T variant="bodyS" color={theme.navActive}>Replace</T></Row>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove question ${index + 1}`} disabled={busy || quiz.questions.length < 2} onPress={() => void patch({ exerciseIds: quiz.questions.filter((q) => q.id !== question.id).map((q) => q.id) })} style={{ minHeight: MIN_TOUCH, justifyContent: 'center', opacity: quiz.questions.length < 2 ? 0.4 : 1 }}>
                <Row><Trash2 size={16} color={tokens.state.critical} /><T variant="bodyS" color={tokens.state.critical}>Remove</T></Row>
              </Pressable>
            </Row>
          )}
        </View>
      ))}
      {error ? <Info title="Could not save" text={error} color={tokens.state.critical} /> : null}
      {published ? (
        <>
          <Info icon={Check} title="Published" text="This quiz is final. Print it for the paper test." />
          <Button title="Done" onPress={close} />
        </>
      ) : (
        <>
          <Button title="Publish quiz" loading={busy} onPress={() => void run(async () => { const done = await caretakerCall<ServerQuiz>('POST', `quizzes/${quizId}/publish`); return done; })} />
          <Button title="Save as draft" variant="soft" onPress={close} />
        </>
      )}
    </>
  );
}

/** Create flow: Subject, then Skills (the weakest pre-ticked), then item count, then the draft preview. */
export function CreateQuizSheet({ visible, classroomId, onClose }: { visible: boolean; classroomId: string; onClose: () => void }) {
  const theme = useTheme();
  const { caretakerGet, caretakerCall } = useOnline();
  const { reload } = useTeacher();
  const [subject, setSubject] = useState<Subject>('MATH');
  const [choices, setChoices] = useState<SkillChoice[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [count, setCount] = useState<(typeof COUNTS)[number]>('10');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    caretakerGet<SkillChoice[]>(`quizzes/skills?classroomId=${classroomId}&subject=${subject}`)
      .then((list) => { if (live) { setChoices(list); setPicked(suggestedSkills(list)); } })
      .catch((e: unknown) => { if (live) setError(message(e)); });
    return () => { live = false; };
  }, [visible, caretakerGet, classroomId, subject]);

  const close = () => { setDraftId(null); onClose(); };
  const build = async () => {
    setBusy(true); setError(null);
    try {
      const quiz = await caretakerCall<ServerQuiz>('POST', 'quizzes', { classroomId, subject, itemCount: Number(count), ...(picked.length ? { skillCodes: picked } : {}) });
      reload();
      setDraftId(quiz.id);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };

  return (
    <Sheet visible={visible} title={draftId ? 'Preview quiz' : 'Create New Quiz'} onClose={close}>
      {draftId ? <QuizDraft quizId={draftId} onDone={close} /> : (
        <>
          <T variant="titleS">Subject</T>
          <Pills items={subjects.map((s) => ({ label: subjectTitles[s], value: s }))} value={subject} onChange={(next) => { setSubject(next); setChoices(null); setError(null); }} />
          <T variant="titleS">Skills</T>
          <T variant="bodyS" color={theme.muted}>The weakest Skills for your Classroom are ticked. Change them if you like.</T>
          {choices ? choices.map((choice) => {
            const on = picked.includes(choice.skillCode);
            return (
              <Pressable key={choice.skillCode} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${skillLabel(choice.skillCode)}, Classroom Mastery ${Math.round(choice.meanMastery * 100)} percent`} onPress={() => setPicked((p) => toggleSkill(p, choice.skillCode))} style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}>
                <Row>
                  <Check size={18} color={on ? theme.navActive : 'transparent'} />
                  <T variant="bodyS" style={{ flex: 1 }}>{skillLabel(choice.skillCode)}</T>
                  <T variant="bodyS" color={theme.muted}>{`${Math.round(choice.meanMastery * 100)}%`}</T>
                </Row>
              </Pressable>
            );
          }) : error ? null : <ActivityIndicator accessibilityLabel="Loading Skills" color={theme.navActive} />}
          {choices && !choices.length ? <T variant="bodyS" color={theme.muted}>No published Exercises for this Subject and grade yet.</T> : null}
          <T variant="titleS">Number of questions</T>
          <Pills items={COUNTS.map((c) => ({ label: c, value: c }))} value={count} onChange={setCount} />
          {error ? <Info title="Could not continue" text={error} color={tokens.state.critical} /> : null}
          <Button title="Preview questions" loading={busy} disabled={!choices?.length || !picked.length} onPress={() => void build()} />
        </>
      )}
    </Sheet>
  );
}

/** Edit an existing draft. A published quiz opens read-only. */
export function EditQuizSheet({ quizId, onClose }: { quizId: string | null; onClose: () => void }) {
  return (
    <Sheet visible={quizId !== null} title="Edit quiz" onClose={onClose}>
      {quizId ? <QuizDraft key={quizId} quizId={quizId} onDone={onClose} /> : null}
    </Sheet>
  );
}
