import { useState } from 'react';
import { View } from 'react-native';
import { Info as InfoIcon, Plus, ShieldCheck } from 'lucide-react-native';

import { useApp } from '@/state/app-context';
import { roleName } from '@/domain/format';
import type { Role } from '@/domain/types';
import { Action, Card, Empty, Eyebrow, Field, Info, Pill, Pills, Row, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, tokens, useTheme } from '@/ui/theme';

const roleOptions = [
  { label: 'Learner', value: 'STUDENT' as const },
  { label: 'Teacher', value: 'TEACHER' as const },
  { label: 'Admin', value: 'LGU_ADMIN' as const },
];

export default function UserManagement() {
  const { snapshot, mutate } = useApp();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>('STUDENT');
  const [alias, setAlias] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [schoolId, setSchoolId] = useState('');

  const counts = {
    STUDENT: snapshot.users.filter((user) => user.role === 'STUDENT').length,
    TEACHER: snapshot.users.filter((user) => user.role === 'TEACHER').length,
    LGU_ADMIN: snapshot.users.filter((user) => user.role === 'LGU_ADMIN').length,
  };
  const schoolName = (id: string | null) => snapshot.schools.find((school) => school.id === id)?.name ?? 'No school';

  return (
    <Screen chrome title="User Management" caption="Anonymised IDs and session security">
      <Card style={{ backgroundColor: tokens.tint.forestBright, borderColor: `${tokens.state.success}40` }}>
        <Row style={{ alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={19} color={theme.navActive} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="titleS">Data Privacy Act of 2012</T>
            <T variant="bodyS" color={theme.secondary}>
              No names, no faces, no location leave the device. Every record is an anonymised system ID.
            </T>
          </View>
        </Row>
      </Card>

      <Row style={{ gap: 11, alignItems: 'stretch' }}>
        {([['STUDENT', 'learners'], ['TEACHER', 'teachers'], ['LGU_ADMIN', 'admins']] as const).map(([key, label]) => (
          <Card key={key} style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 16 }}>
            <T variant="displayL" style={{ fontSize: 24, lineHeight: 28 }}>{counts[key]}</T>
            <T variant="bodyS" color={theme.muted}>{label}</T>
          </Card>
        ))}
      </Row>

      <Eyebrow>Anonymised records</Eyebrow>
      {snapshot.users.length ? snapshot.users.map((user, index) => (
        <Card key={user.id} index={index}>
          <Row style={{ gap: 11 }}>
            <View style={{ width: 38, height: 34, borderRadius: radius.sm, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <T variant="dataS" color={theme.muted}>{user.id.slice(0, 3).toUpperCase()}</T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="titleS" lines={1}>{user.alias}</T>
              <T variant="bodyS" color={theme.muted}>{`${roleName(user.role)} · ${schoolName(user.schoolId)}`}</T>
            </View>
            <Pill
              color={user.active === false ? theme.muted : tokens.state.success}
              tint={user.active === false ? theme.surfaceAlt : tokens.tint.success}
            >
              {user.active === false ? 'Disabled' : 'Active'}
            </Pill>
          </Row>
        </Card>
      )) : (
        <Empty title="No accounts yet" text="Create the first teacher and learner accounts for your jurisdiction." />
      )}

      <Action title="Create an account" icon={Plus} variant="soft" task={async () => { setOpen(true); }} />

      <Card style={{ gap: 7 }}>
        <Row>
          <T variant="titleS" style={{ flex: 1 }}>Session security</T>
          <Pill color={theme.navActive} tint={tokens.tint.forestBright}>5 min</Pill>
        </Row>
        <T variant="bodyS" color={theme.muted}>
          Devices lock after five minutes of inactivity and whenever the app goes to the background. Unlocking needs the profile PIN.
        </T>
      </Card>

      <Info
        icon={InfoIcon}
        color={tokens.brand.sky}
        title="Login IDs are not in this list"
        text="GET /users omits loginId from its select, so an admin cannot map an alias back to the ID a learner types. Adding it to that query would complete this screen."
      />

      {open ? (
        <Card style={{ gap: 14 }}>
          <T variant="titleM">New account</T>
          <Pills items={roleOptions} value={role} onChange={setRole} />
          <Field label="Alias" value={alias} onChangeText={setAlias} placeholder="Learner Demo" />
          <Field label="Login ID" value={loginId} onChangeText={setLoginId} autoCapitalize="none" placeholder="learner-001" />
          <Field label="Starting password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 12 characters" />
          {role !== 'LGU_ADMIN' ? (
            <View style={{ gap: 7 }}>
              <Eyebrow>School</Eyebrow>
              <Pills
                items={snapshot.schools.slice(0, 3).map((school) => ({ label: school.name, value: school.id }))}
                value={schoolId || snapshot.schools[0]?.id || ''}
                onChange={setSchoolId}
              />
            </View>
          ) : null}
          <Action
            title="Create account"
            disabled={alias.trim().length < 2 || loginId.trim().length < 3 || password.length < 12 || (role !== 'LGU_ADMIN' && !(schoolId || snapshot.schools[0]?.id))}
            task={async () => {
              await mutate('POST', 'users', {
                alias: alias.trim(),
                loginId: loginId.trim().toLowerCase(),
                role,
                password,
                ...(role === 'LGU_ADMIN' ? {} : { schoolId: schoolId || snapshot.schools[0]?.id }),
              });
              setAlias(''); setLoginId(''); setPassword(''); setOpen(false);
            }}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
