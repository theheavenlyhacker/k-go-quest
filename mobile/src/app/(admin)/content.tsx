import { useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Folder, Upload } from 'lucide-react-native';

import { importPack, PackFileError, parsePackFile, type ImportPack, type ImportProgress } from '@/domain/admin-actions';
import { ADMIN_DATA_SOURCE } from '@/state/admin-context';
import { useOnline } from '@/state/online-context';
import { libraryView } from '@/domain/admin-library';
import { useAdminData } from '@/state/admin-data';
import { AdminSidebar, LoadGate } from '@/ui/admin';
import { Bar, Button, Card, Empty, Eyebrow, Field, IconTile, Pill, Row, Sheet, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { tokens, useTheme } from '@/ui/theme';
import { View } from 'react-native';

/** Content Management (277:496). */
export default function Content() {
  const load = useAdminData();
  const theme = useTheme();
  const { caretakerCall } = useOnline();
  const [preview, setPreview] = useState<ImportPack[] | null>(null);
  const [attribution, setAttribution] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [imported, setImported] = useState(false);
  const progress = useRef<ImportProgress[]>([]);
  const [started, setStarted] = useState(false);
  const [publish, setPublish] = useState<{ id: string; title: string } | null>(null);
  const canAct = ADMIN_DATA_SOURCE !== 'fixture' && !busy;
  async function pick() {
    setErrors([]);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/json', 'text/plain'], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size !== undefined && asset.size > 2 * 1024 * 1024) throw new Error('Choose a Pack JSON file smaller than 2 MB.');
      const text = asset.file ? await asset.file.text() : await new File(asset.uri).text();
      if (text.length > 2 * 1024 * 1024) throw new Error('Choose a Pack JSON file smaller than 2 MB.');
      setPreview(parsePackFile(text)); progress.current = []; setStarted(false); setAttribution(''); setImported(false);
    } catch (error) {
      setErrors(error instanceof PackFileError ? error.errors : [error instanceof Error ? error.message : 'Could not read that file.']);
    }
  }
  async function upload() {
    if (busy || !preview || imported) return;
    setBusy(true); setErrors([]);
    const completed: string[] = [];
    try {
      for (const [i, pack] of preview.entries()) {
        const cursor = progress.current[i] ??= { lessonIds: [], exerciseCounts: [] };
        await importPack(caretakerCall, pack, attribution, cursor); completed.push(pack.title);
      }
      setImported(true);
    } catch (error) {
      setErrors([...(completed.length ? [`Drafts created: ${completed.join(', ')}.`] : []), error instanceof Error ? error.message : 'Upload failed.']);
    } finally { setStarted(progress.current.some((p) => p.packId)); setBusy(false); load.reload(); }
  }
  function closeImport() { if (!busy) { setPreview(null); setAttribution(''); setErrors([]); } }
  return (
    <Screen chrome title="Content Management" menu={AdminSidebar}>
      <LoadGate load={load}>
        {({ data }) => {
          const view = libraryView(data.library);
          return (
            <>
              <Card index={0} style={{ gap: 10 }}>
                <View accessible accessibilityLabel={`Library storage: ${view.used} of ${view.capacity} used`} style={{ gap: 10 }}>
                  <Row>
                    <T variant="titleM" style={{ flex: 1 }}>Library storage</T>
                    <T variant="bodyS" color={theme.muted}>{`${view.used} of ${view.capacity}`}</T>
                  </Row>
                  <Bar value={view.fraction} color={theme.navActive} />
                </View>
              </Card>
              <Button title="Upload New Content" icon={Upload} disabled={!canAct} onPress={() => void pick()} />
              {ADMIN_DATA_SOURCE === 'fixture' ? <T variant="bodyS">Content changes require a school server session.</T> : null}
              {!preview && !publish ? errors.map((error, i) => <T key={i} color={tokens.state.critical}>{error}</T>) : null}
              <Eyebrow>Content Packs</Eyebrow>
              {view.rows.length === 0 ? (
                <Empty icon={Folder} title="No Content Packs yet" text="Packs that Pack Authors publish appear here." />
              ) : (
                view.rows.map((row, i) => (
                  <Card key={row.id} index={i + 1}>
                    <Row style={{ gap: 12 }}>
                      <IconTile icon={Folder} color={theme.navActive} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <T variant="titleM">{row.title}</T>
                        <T variant="bodyS" color={theme.muted}>{row.detail}</T>
                      </View>
                      <Pill color={row.published ? tokens.state.success : tokens.state.warning} tint={row.published ? tokens.tint.success : tokens.tint.warning}>{row.chip}</Pill>
                    </Row>
                    {!row.published ? <Button title={`Publish ${row.title}`} variant="soft" disabled={!canAct} onPress={() => { setErrors([]); setPublish({ id: row.id, title: row.title }); }} /> : null}
                  </Card>
                ))
              )}
            </>
          );
        }}
      </LoadGate>
      <Sheet visible={preview !== null} title={imported ? 'Drafts created' : 'Import Content Packs'} onClose={closeImport}>
        {errors.map((error, i) => <T key={i} color={tokens.state.critical}>{error}</T>)}
        {preview?.map((p, i) => <T key={i}>{`${p.title} · ${p.subject} · Grade ${p.grade} · ${p.lessons.length} Lessons`}</T>)}
        {imported ? <>
          <T>Saved as drafts. Close this dialog, then Publish each Pack when it is ready. Caretakers can download published Packs.</T>
          <Button title="Done" onPress={closeImport} />
        </> : <>
          <T>The file has been validated. Imported Packs receive new server IDs and stay in draft until you publish them.</T>
          <Field label="Pack Author / attribution (required)" value={attribution} onChangeText={setAttribution} editable={!busy && !started} multiline />
          <Button title={started ? "Retry remaining content" : "Create drafts"} loading={busy} onPress={() => void upload()} />
          <Button title="Cancel" variant="outline" disabled={busy} onPress={closeImport} />
        </>}
      </Sheet>
      <Sheet visible={publish !== null} title="Publish Content Pack?" onClose={() => { if (!busy) { setPublish(null); setErrors([]); } }}>
        <T>{`Publish ${publish?.title ?? ''}? Caretakers will be able to download it. Published content cannot be changed; corrections need a new version.`}</T>
        {errors.map((error, i) => <T key={i} color={tokens.state.critical}>{error}</T>)}
        <Button title="Confirm publish" loading={busy} onPress={() => {
          if (busy || !publish) return;
          setBusy(true); setErrors([]);
          void caretakerCall('POST', `content/packs/${publish.id}/publish`, {}).then(() => { setPublish(null); load.reload(); })
            .catch((e: unknown) => setErrors([e instanceof Error ? e.message : 'Could not publish.']))
            .finally(() => setBusy(false));
        }} />
        <Button title="Cancel" variant="outline" disabled={busy} onPress={() => setPublish(null)} />
      </Sheet>
    </Screen>
  );
}
