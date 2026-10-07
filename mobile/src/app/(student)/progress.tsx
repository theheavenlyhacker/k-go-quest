import { useApp } from '@/state/app-context';
import { ProgressView } from '@/ui/progress-view';
import { Screen } from '@/ui/screen';

export default function Progress() {
  const { learning, attempts, uploads, balance, purchases } = useApp();
  return (
    <Screen chrome title="My Progress" caption="Estimates from your answers">
      <ProgressView learning={learning} attempts={attempts} uploads={uploads} balance={balance} purchases={purchases} />
    </Screen>
  );
}
