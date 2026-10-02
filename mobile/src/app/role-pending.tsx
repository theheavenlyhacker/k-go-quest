import { useApp } from '@/state/app-context';
import { roleName } from '@/domain/format';
import { Action, Card, Empty, T } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { useTheme } from '@/ui/theme';
import { Hammer } from 'lucide-react-native';

/** Teacher and LGU screens are not built yet; land signed-in staff somewhere honest. */
export default function RolePending() {
  const { session, logout } = useApp();
  const theme = useTheme();
  const role = session ? roleName(session.user.role) : 'This role';
  return (
    <Screen title="Almost there" refreshable={false}>
      <Empty icon={Hammer} title={`${role} view in progress`} text={`You are signed in as ${session?.user.alias ?? 'staff'}. The ${role.toLowerCase()} screens are the next thing being built — the learner experience is ready today.`} />
      <Card style={{ gap: 10 }}>
        <T size={12} bold>Signed in</T>
        <T size={11} color={theme.muted}>{session?.user.loginId} · {role}</T>
        <Action title="Sign out" variant="outline" task={logout} />
      </Card>
    </Screen>
  );
}
