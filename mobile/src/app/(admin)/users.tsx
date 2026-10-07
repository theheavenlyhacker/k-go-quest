import { useState } from 'react';
import { View } from 'react-native';
import { Search, Users as UsersIcon } from 'lucide-react-native';

import { userRows, type RoleFilter } from '@/domain/admin-library';
import { useAdminData } from '@/state/admin-data';
import { AdminSidebar, LoadGate } from '@/ui/admin';
import { Card, Empty, Field, IconTile, Pill, Pills, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { tokens, useTheme } from '@/ui/theme';

const TABS: { label: string; value: RoleFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Learners', value: 'STUDENT' },
  { label: 'Teachers', value: 'TEACHER' },
  { label: 'Admins', value: 'LGU_ADMIN' },
];

/** User Management (277:553). */
export default function Users() {
  const load = useAdminData();
  const theme = useTheme();
  const [filter, setFilter] = useState<RoleFilter>('ALL');
  const [query, setQuery] = useState('');
  return (
    <Screen chrome title="User Management" menu={AdminSidebar}>
      <Field label="Search accounts" icon={Search} value={query} onChangeText={setQuery} placeholder="Search by alias or login" autoCapitalize="none" autoCorrect={false} />
      <Pills items={TABS} value={filter} onChange={setFilter} />
      <LoadGate load={load}>
        {({ data }) => {
          const rows = userRows(data.users, data.schoolName, filter, query);
          return (
            <>
              <T variant="bodyS" color={theme.muted} >{`${rows.length} ${rows.length === 1 ? 'account' : 'accounts'}`}</T>
              {rows.length === 0 ? (
                <Empty icon={UsersIcon} title="No accounts found" text="Try another name or a different tab." />
              ) : (
                rows.map((row, i) => (
                  <Card key={row.id} index={Math.min(i, 8)} accessibilityLabel={`${row.name}, ${row.context}, ${row.chip}`}>
                    <Row style={{ gap: 12 }}>
                      <IconTile icon={UsersIcon} color={theme.navActive} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <T variant="titleM">{row.name}</T>
                        <T variant="bodyS" color={theme.muted}>{row.context}</T>
                      </View>
                      <Pill color={row.active ? tokens.state.success : tokens.state.critical} tint={row.active ? tokens.tint.success : tokens.tint.warning}>{row.chip}</Pill>
                    </Row>
                  </Card>
                ))
              )}
            </>
          );
        }}
      </LoadGate>
    </Screen>
  );
}
