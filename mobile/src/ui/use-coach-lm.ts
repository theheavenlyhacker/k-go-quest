import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { initLlama } from 'llama.rn';

const SYSTEM = 'You are a kind tutor for a young child. Say the given advice in one short, cheerful sentence. Do not add facts, numbers or answers.';

/**
 * Rewords `advice` (the rule-based line from `coach`) with the small model
 * bundled in the Android app (plugins/coach-model.js). It only rewords; if the
 * model is missing, fails, or drops a number, `advice` is kept as it was.
 */
export function useCoachLm(advice: string) {
  const [text, setText] = useState(advice);

  useEffect(() => {
    setText(advice);
    if (Platform.OS !== 'android') return;
    let stopped = false;
    let release: (() => Promise<void>) | undefined;
    (async () => {
      const ctx = await initLlama({ model: 'coach.gguf', is_model_asset: true, n_ctx: 512, n_gpu_layers: 0 });
      release = () => ctx.release();
      if (stopped) return;
      const { text: out } = await ctx.completion({
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: advice }],
        n_predict: 48,
        temperature: 0.3,
      });
      const nums = advice.match(/\d+/g) ?? [];
      if (!stopped && out.trim() && nums.every((n) => out.includes(n))) setText(out.trim());
    })().catch(() => {}).finally(() => { if (stopped) release?.(); });
    return () => { stopped = true; release?.(); };
  }, [advice]);

  return text;
}
