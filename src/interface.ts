type Primitive = string | number | boolean | undefined | null;
type DeepReadonly<T> = T extends Primitive ? T : DeepReadonlyObject<T>;
type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export interface IDomainEvent<P extends object = object, S extends object = object> {
  /**
   * id of the event
   */
  readonly id: string;
  /**
   * parent of the event
   */
  readonly parent: this['id'] | null;
  /**
   * type of the event
   */
  readonly type: string;
  /**
   * when the event was created
   */
  readonly createdAt: number;
  /**
   * when the event was initiated
   */
  readonly initiatedAt: number | null;
  /**
   * when the event was executed
   */
  readonly executedAt: number | null;
  /**
   * when the event was completed
   */
  readonly completedAt: number | null;
  /**
   * parameters required for the event
   */
  readonly params: DeepReadonly<P>;
  /**
   * state returned by the event
   */
  readonly state: DeepReadonly<S>;
  /**
   * if there were any errors in the event
   */
  readonly errors: DeepReadonly<Error[]>;
  /**
   * custom metadata to attach (can be modified from the hooks)
   */
  readonly metadata: DeepReadonly<Record<string, any>>;
}

export type CreateDomainEventReturnType<T extends IDomainEvent> = Pick<T, keyof IDomainEvent>;
export type CreateDomainEventArgs<T extends IDomainEvent> = Pick<T, 'type' | 'params'>;

type PureActionReturnType = void | IDomainEvent[];
type ImpureActionReturnType = PureActionReturnType | Promise<PureActionReturnType>;

export interface IDomainHandler<T extends IDomainEvent> {
  initiate?: (event: T) => ImpureActionReturnType;
  execute?: (event: T, children: IDomainEvent[]) => ImpureActionReturnType;
  complete?: (event: T, children: IDomainEvent[]) => T['state'] | void | Promise<T['state'] | void>;
}

export interface IDomainEventHooks {
  beforeInvoke?: <T extends IDomainEvent>(event: IDomainEvent) => void | Promise<void> | T | Promise<T>;
  beforeInitiate?: <T extends IDomainEvent>(event: T) => void | Promise<void> | T | Promise<T>;
  afterInitiate?: <T extends IDomainEvent>(event: T) => void | Promise<void>;
  beforeExecute?: <T extends IDomainEvent>(event: T) => void | Promise<void> | T | Promise<T>;
  afterExecute?: <T extends IDomainEvent>(event: T) => void | Promise<void>;
  beforeComplete?: <T extends IDomainEvent>(event: T) => void | Promise<void> | T | Promise<T>;
  afterComplete?: <T extends IDomainEvent>(event: T) => void | Promise<void>;
  afterInvoke?: (event: IDomainEvent) => void | Promise<void>;
}
