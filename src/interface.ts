import { DeepReadonly } from 'utility-types';

type PureActionReturnType = void | IDomainEvent[];
type ImpureActionReturnType = PureActionReturnType | Promise<PureActionReturnType>;
export type CreateDomainEventReturnType<T extends IDomainEvent> = Pick<T, keyof IDomainEvent>;
export type CreateDomainEventArgs<T extends IDomainEvent> = Pick<T, 'name'> & {
  params: DeepReadonly<T['params']>;
  state: DeepReadonly<T['state']>;
  parent?: T['parent'];
};

export interface IDomainEvent<P extends object = {}, S extends object = {}> {
  readonly id: string;
  readonly parent: string | null;
  readonly name: string;
  readonly params: DeepReadonly<P>;
  readonly errors: DeepReadonly<Error[]>;
  readonly createdAt: number;
  readonly executedAt: number | null;
  readonly completedAt: number | null;
  state: DeepReadonly<S>;
}

export interface IDomainHandler<T extends IDomainEvent> {
  initiate?: (event: T) => T | Promise<T>;
  execute?: (event: T) => ImpureActionReturnType;
  complete?: (event: T, childEvents: IDomainEvent[]) => T | undefined;
}

export interface IDomainEventAdapter {
  beforeInvoke?: (event: IDomainEvent) => void | Promise<void>;
  afterInvoke?: (event: IDomainEvent) => void | Promise<void>;
}
