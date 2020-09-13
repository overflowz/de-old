type primitive = string | number | boolean | undefined | null;
type DeepReadonly<T> = T extends primitive ? T : DeepReadonlyObject<T>;
type DeepReadonlyObject<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export interface IDomainEvent<P extends object = object, S extends object = object> {
  readonly id: string;
  readonly parent: this['id'] | null;
  readonly type: string;
  readonly createdAt: number;
  readonly initiatedAt: number | null;
  readonly executedAt: number | null;
  readonly completedAt: number | null;
  readonly params: DeepReadonly<P>;
  readonly state: DeepReadonly<S>;
  readonly errors: DeepReadonly<Error[]>;
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
