/**
 * Backward-compatible import for consumers outside this module.
 * Service lifecycle tasks are persisted in PostgreSQL only.
 */
export {
  LifecycleTasksPgRepository as LifecycleTasksRepository,
  type SvcTaskRow,
} from './lifecycle-tasks-pg.repository';
