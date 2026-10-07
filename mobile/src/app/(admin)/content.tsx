import { useState } from 'react';
import { Folder, Upload } from 'lucide-react-native';

import { libraryView } from '@/domain/admin-library';
import { useAdminData } from '@/state/admin-data';
import { AdminSidebar, ComingSoonSheet, LoadGate } from '@/ui/admin';
import { Bar, Button, Card, Empty, Eyebrow, IconTile, Pill, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { tokens, useTheme } from '@/ui/theme';
import { View } from 'react-native';

/** Content Management (277:496). */
export default function Content() {
  const load = useAdminData();
  const theme = useTheme();
  const [soon, setSoon] = useState(false);
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
              <Button title="Upload New Content" icon={Upload} onPress={() => setSoon(true)} />
              <Eyebrow>Content Packs</Eyebrow>
              {view.rows.length === 0 ? (
                <Empty icon={Folder} title="No Content Packs yet" text="Packs that Pack Authors publish appear here." />
              ) : (
                view.rows.map((row, i) => (
                  <Card key={row.id} index={i + 1} accessibilityLabel={`${row.title}, ${row.detail}, ${row.chip}`}>
                    <Row style={{ gap: 12 }}>
                      <IconTile icon={Folder} color={theme.navActive} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <T variant="titleM">{row.title}</T>
                        <T variant="bodyS" color={theme.muted}>{row.detail}</T>
                      </View>
                      <Pill color={row.published ? tokens.state.success : tokens.state.warning} tint={row.published ? tokens.tint.success : tokens.tint.warning}>{row.chip}</Pill>
                    </Row>
                  </Card>
                ))
              )}
            </>
          );
        }}
      </LoadGate>
      <ComingSoonSheet feature={soon ? 'Uploading new content' : null} onClose={() => setSoon(false)} />
    </Screen>
  );
}
