type Primitive = string | number | boolean | undefined | null;
type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export type DeepReadonly<T> = T extends Primitive ? T : DeepReadonlyObject<T>;

export enum EventPhase {
  INITIATE = 'initiate',
  EXECUTE = 'execute',
  COMPLETE = 'complete',
};

export enum EventStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
};

export interface IDomainEvent<P extends object = object, S extends object = object> {
  /**
   * id of the event
   */
  readonly id: string;
  /**
   * parent of the event
   */
  readonly parent: string | null;
  /**
   * event action id
   */
  readonly action: string;
  /**
   * current event phase
   */
  readonly phase: EventPhase;
  /**
   * current event status
   */
  readonly status: EventStatus;
  /**
   * event parameters (input)
   */
  readonly params: Partial<DeepReadonly<P>>;
  /**
   * state of the event (output)
   */
  state: Partial<DeepReadonly<S>>;
  /**
   * custom metadata
   */
  readonly metadata: DeepReadonly<Record<string, string>>;
  /**
   * reason of failure
   */
  readonly error: string | null;
}

export type PhaseReturnType = void | readonly IDomainEvent[] | Promise<void | readonly IDomainEvent[]>;

export type BeforeHookReturnType<T> = void | Promise<void> | DeepReadonly<T> | Promise<DeepReadonly<T>>;

export type AfterHookReturnType = void | Promise<void>;

export interface IDomainEventHandler<T extends IDomainEvent> {
  [EventPhase.INITIATE]?: (event: T) => PhaseReturnType;
  [EventPhase.EXECUTE]?: (event: T, children: readonly IDomainEvent[]) => PhaseReturnType;
  [EventPhase.COMPLETE]?: (event: T, children: readonly IDomainEvent[]) => PhaseReturnType;
}

export interface IDomainEventHooks {
  beforeInvoke?: <T extends IDomainEvent>(event: DeepReadonly<T>) => BeforeHookReturnType<T>;
  beforeInitiate?: <T extends IDomainEvent>(event: DeepReadonly<T>) => BeforeHookReturnType<T>;
  afterInitiate?: <T extends IDomainEvent>(event: DeepReadonly<T>) => AfterHookReturnType;
  beforeExecute?: <T extends IDomainEvent>(event: DeepReadonly<T>, childEvents: readonly IDomainEvent[]) => BeforeHookReturnType<T>;
  afterExecute?: <T extends IDomainEvent>(event: DeepReadonly<T>, childEvents: readonly IDomainEvent[]) => AfterHookReturnType;
  beforeComplete?: <T extends IDomainEvent>(event: DeepReadonly<T>, childEvents: readonly IDomainEvent[]) => BeforeHookReturnType<T>;
  afterComplete?: <T extends IDomainEvent>(event: DeepReadonly<T>, childEvents: readonly IDomainEvent[]) => AfterHookReturnType;
  afterInvoke?: <T extends IDomainEvent>(event: DeepReadonly<T>) => AfterHookReturnType;
}

export type EventCallback<T extends IDomainEvent> = (value: T) => void;

export type GenerateDomainEventArgs<T extends IDomainEvent> = Pick<T, 'action'> & Partial<Pick<T, 'params' | 'state' | 'metadata' | 'parent'>>

export type GenerateDomainEventReturnType<T extends IDomainEvent> = IDomainEvent<T['params'], T['state']> & Pick<T, 'action' | 'metadata'>;
