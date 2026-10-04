import { useSyncExternalStore } from 'react';
import { getWorkbenchEnvironment, subscribeWorkbenchEnvironment } from './consoleDirectory';

export function useWorkbenchEnvironment(): string {
  return useSyncExternalStore(subscribeWorkbenchEnvironment, getWorkbenchEnvironment, () => 'dev');
}
