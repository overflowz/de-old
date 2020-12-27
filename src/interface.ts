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
   * current event status
   */
  readonly status: EventStatus;
  /**
   * event parameters (input)
   */
  readonly params: DeepReadonly<P>;
  /**
   * state of the event (output)
   */
  readonly state: DeepReadonly<S>;
  /**
   * custom metadata
   */
  readonly metadata: DeepReadonly<Record<string, string>>;
  /**
   * reason of failure
   */
  readonly error: Error | string | null;
}

export type PhaseReturnType = void | IDomainEvent | readonly IDomainEvent[] | Promise<void | IDomainEvent | readonly IDomainEvent[]>;

export interface IDomainEventHandler<T extends IDomainEvent> {
  [EventPhase.INITIATE]?: (event: T) => PhaseReturnType;
  [EventPhase.EXECUTE]?: (event: T, children: readonly IDomainEvent[]) => PhaseReturnType;
  [EventPhase.COMPLETE]?: (event: T, children: readonly IDomainEvent[]) => PhaseReturnType;
}

export type EventCallback<T extends IDomainEvent> = (value: T) => void;

export type GenerateDomainEventArgs<T extends IDomainEvent> =
  & DeepReadonly<Pick<T, 'action' | 'params'>>
  & Partial<Pick<T, 'id' | 'state' | 'metadata' | 'parent'>>;

export type GenerateDomainEventReturnType<T extends IDomainEvent> =
  IDomainEvent<T['params'], T['state']> & Pick<T, 'action' | 'metadata'>;

// TODO: early exit?
export type Middleware<T> = {
  /** executed before event handler */
  before?: (event: T, exit: () => void) => void | T | Promise<void | T>;
  /** executed after event handler */
  after?: (event: T, exit: () => void) => void | T | Promise<void | T>;
  /** executed before each phase */
  beforeEach?: (event: T, children: readonly IDomainEvent[], phase: EventPhase, exit: () => void) => void | T | Promise<void | T>;
  /** executed after each phase */
  afterEach?: (event: T, children: readonly IDomainEvent[], phase: EventPhase, exit: () => void) => void | T | Promise<void | T>;
};

export type HandlerMapRecord<T extends IDomainEvent> = {
  handler: IDomainEventHandler<T>;
  middlewares: Middleware<T>[];
};
