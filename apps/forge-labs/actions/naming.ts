'use server';

import type { EngineInput, WebNamingResult } from '@mediafox/naming-engine';
import { runWebEngine } from '@mediafox/naming-engine';

export async function generateNames(
  input: EngineInput,
): Promise<WebNamingResult> {
  return runWebEngine(input);
}
