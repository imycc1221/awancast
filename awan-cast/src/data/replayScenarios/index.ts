import type { ReplayScenario, ReplayScenarioId } from '../../types';
import { peninsularStorm } from './peninsular-storm';
import { sarawakPartial } from './sarawak-partial';
import { sabahClear } from './sabah-clear';

export const replayScenarios: Record<ReplayScenarioId, ReplayScenario> = {
  'peninsular-storm': peninsularStorm,
  'sarawak-partial': sarawakPartial,
  'sabah-clear': sabahClear,
};

export const replayScenarioList: ReplayScenario[] = [
  peninsularStorm,
  sarawakPartial,
  sabahClear,
];
