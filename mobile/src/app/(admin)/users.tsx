import { useState } from 'react';
import { View } from 'react-native';
import { Search, Users as UsersIcon } from 'lucide-react-native';

import { userRows, type RoleFilter } from '@/domain/admin-library';
import { useAdminData } from '@/state/admin-data';
import { ADMIN_DATA_SOURCE } from '@/state/admin-context';
import { useOnline } from '@/state/online-context';
import { learnerFormErrors, passwordError } from '@/domain/admin-actions';
import { parseClassrooms } from '@/domain/teacher-load';
import type { Page, ServerClassroom, ServerUser } from '@/domain/server';
import { AdminSidebar, LoadGate } from '@/ui/admin';
import { Button, Card, Empty, Field, IconTile, Pill, Pills, Row, Sheet, T } from '@/ui/primitives';
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
  const { caretakerGet, caretakerCall, server } = useOnline();
  const [adding, setAdding] = useState(false);
  const [classrooms, setClassrooms] = useState<ServerClassroom[]>([]);
  const [form, setForm] = useState({ alias: '', loginId: '', password: '', classroomId: '' });
  const [created, setCreated] = useState<{ id: string; loginId: string } | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [selected, setSelected] = useState<ServerUser | null>(null);
  const [reset, setReset] = useState(false);
  const [password, setPassword] = useState('');
  const [credentials, setCredentials] = useState<{ loginId: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canAct = ADMIN_DATA_SOURCE !== 'fixture' && !busy;
  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  function closeAdd() {
    if (busy) return;
    setAdding(false); setCreated(null); setEnrolled(false); setError('');
    setForm({ alias: '', loginId: '', password: '', classroomId: '' });
  }
  function closeAccount() {
    if (busy) return;
    setSelected(null); setReset(false); setPassword(''); setError('');
  }
  async function openAdd() {
    setAdding(true);
    const all: ServerClassroom[] = [];
    for (let page = 1; ; page++) {
      const result = await caretakerGet<Page<ServerClassroom>>(`classrooms?page=${page}&limit=100`);
      all.push(...parseClassrooms(result));
      if (!result.items.length || all.length >= result.total) break;
    }
    setClassrooms(all);
  }
  async function addLearner() {
    const errors = learnerFormErrors(form, classrooms);
    if (errors.length) throw new Error(errors.join('\n'));
    const classroom = classrooms.find((c) => c.id === form.classroomId)!;
    const account = created ?? await caretakerCall<{ id: string; loginId: string }>('POST', 'users', {
      alias: form.alias.trim(), loginId: form.loginId.trim(), password: form.password, role: 'STUDENT', schoolId: classroom.schoolId,
    });
    setCreated(account);
    // Keep the issued credentials and account id if enrollment fails, so retry never creates a second account.
    await caretakerCall('POST', `classrooms/${classroom.id}/enrollments`, { studentId: account.id });
    setEnrolled(true); load.reload();
  }
  return (
    <Screen chrome title="User Management" menu={AdminSidebar}>
      <Button title="Add Learner account" disabled={!canAct} onPress={() => void run(openAdd)} />
      {ADMIN_DATA_SOURCE === 'fixture' ? <T variant="bodyS">Account changes require a school server session.</T> : null}
      {!adding && !selected && error ? <T color={tokens.state.critical}>{error}</T> : null}
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
                  <Card key={row.id} index={Math.min(i, 8)}>
                    <Row style={{ gap: 12 }}>
                      <IconTile icon={UsersIcon} color={theme.navActive} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <T variant="titleM">{row.name}</T>
                        <T variant="bodyS" color={theme.muted}>{row.context}</T>
                      </View>
                      <Pill color={row.active ? tokens.state.success : tokens.state.critical} tint={row.active ? tokens.tint.success : tokens.tint.warning}>{row.chip}</Pill>
                    </Row>
                    <Button title={`Manage ${row.name}`} variant="soft" disabled={!canAct} onPress={() => {
                      setError(''); setSelected(data.users.find((u) => u.id === row.id) ?? null);
                    }} />
                  </Card>
                ))
              )}
            </>
          );
        }}
      </LoadGate>
      <Sheet visible={adding} title={created ? 'Account credentials' : 'Add Learner account'} onClose={closeAdd}>
        {error ? <T color={tokens.state.critical}>{error}</T> : null}
        {created ? <>
          <T>{enrolled ? 'Account created and enrolled. Give these credentials to the Caretaker to link a Profile.' : 'Account created, but enrollment has not finished. Retry enrollment below.'}</T>
          <T bold>{`Login ID: ${created.loginId}`}</T>
          <T bold>{`Temporary password: ${form.password}`}</T>
          <T>Shown once. Save these before closing.</T>
          {enrolled ? <Button title="Done" onPress={closeAdd} /> : <Button title="Retry enrollment" loading={busy} onPress={() => void run(addLearner)} />}
        </> : <>
          <Field label="Learner alias" value={form.alias} onChangeText={(alias) => setForm({ ...form, alias })} />
          <Field label="Login ID" value={form.loginId} autoCapitalize="none" autoCorrect={false} onChangeText={(loginId) => setForm({ ...form, loginId })} />
          <Field label="Temporary password (12–128 characters)" value={form.password} secureTextEntry autoCapitalize="none" autoCorrect={false} onChangeText={(password) => setForm({ ...form, password })} />
          <T bold>Choose a Classroom</T>
          {!classrooms.length && !busy ? <T>No Classrooms available. Create a Classroom on the school server first.</T> : null}
          {classrooms.map((c) => <Button key={c.id} title={`${form.classroomId === c.id ? '✓ ' : ''}${c.name} · Grade ${c.grade}`} variant="soft" disabled={busy} onPress={() => setForm({ ...form, classroomId: c.id })} />)}
          <Button title="Create and enrol" loading={busy} onPress={() => void run(addLearner)} />
        </>}
      </Sheet>
      <Sheet visible={selected !== null} title={selected?.alias ?? 'Manage account'} onClose={closeAccount}>
        {error ? <T color={tokens.state.critical}>{error}</T> : null}
        <T>{`Login ID: ${selected?.loginId ?? ''}`}</T>
        {reset ? <>
          <T>Resetting this password signs the account out on every tablet. The Caretaker must link the Profile again.</T>
          <Field label="New password (12–128 characters)" value={password} secureTextEntry autoCapitalize="none" autoCorrect={false} onChangeText={setPassword} />
          <Button title="Confirm password reset" variant="danger" loading={busy} onPress={() => void run(async () => {
            const problem = passwordError(password);
            if (problem) throw new Error(problem);
            if (!selected) return;
            await caretakerCall('POST', `users/${selected.id}/password`, { newPassword: password });
            setCredentials({ loginId: selected.loginId, password });
            setSelected(null); setPassword(''); setReset(false); load.reload();
          })} />
        </> : <>
          <T>{selected?.active === false ? 'Reactivate this account so it can sign in again.' : 'Deactivating prevents sign-in and signs this account out. Its learning history remains saved.'}</T>
          <Button title={selected?.active === false ? 'Confirm reactivation' : 'Confirm deactivation'} variant={selected?.active === false ? 'primary' : 'danger'} loading={busy} disabled={selected?.id === server?.user.id && selected?.active !== false} onPress={() => void run(async () => {
            if (!selected) return;
            await caretakerCall('PATCH', `users/${selected.id}`, { active: selected.active === false });
            setSelected(null); load.reload();
          })} />
          <Button title="Reset password…" variant="soft" disabled={busy} onPress={() => setReset(true)} />
        </>}
        <Button title="Cancel" variant="outline" disabled={busy} onPress={closeAccount} />
      </Sheet>
      <Sheet visible={credentials !== null} title="New credentials" onClose={() => setCredentials(null)}>
        <T>Password reset. The account must sign in again. Shown once; save these before closing.</T>
        <T bold>{`Login ID: ${credentials?.loginId ?? ''}`}</T>
        <T bold>{`Password: ${credentials?.password ?? ''}`}</T>
        <Button title="Done" onPress={() => setCredentials(null)} />
      </Sheet>
    </Screen>
  );
}
