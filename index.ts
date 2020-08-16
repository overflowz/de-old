import uuid from 'uuid';
import { DeepReadonly } from 'utility-types';

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

type PureActionReturnType = void | IDomainEvent[];
type ImpureActionReturnType = PureActionReturnType | Promise<PureActionReturnType>;

export interface IDomainHandler<T extends IDomainEvent> {
  initiate?: (event: T) => T | Promise<T>;
  execute?: (event: T) => ImpureActionReturnType;
  complete?: (event: T, childEvents: IDomainEvent[]) => T | undefined;
}

export interface IDomainEventAdapter {
  beforeInvoke?: (event: IDomainEvent) => void | Promise<void>;
  afterInvoke?: (event: IDomainEvent) => void | Promise<void>;
};

export class DomainEvents {
  constructor(private readonly adapter?: IDomainEventAdapter) { }

  private readonly eventMap: Map<IDomainEvent['name'], IDomainHandler<any>[]> = new Map();

  private async initiateEvent<T extends IDomainEvent>(event: T, handler: IDomainHandler<T>): Promise<T> {
    return await handler.initiate?.(event) ?? event;
  }

  private async executeEvent<T extends IDomainEvent>(event: T, handler: IDomainHandler<T>): Promise<IDomainEvent[]> {
    return await handler.execute?.(event) || [];
  }

  private completeEvent<T extends IDomainEvent>(event: T, events: IDomainEvent[], handler: IDomainHandler<T>): T {
    if (typeof handler.complete === 'function') {
      return handler.complete(event, events) ?? event;
    }

    return event;
  }

  public on<T extends IDomainEvent>(eventName: T['name'], handler: IDomainHandler<T>): void {
    const handlers = this.eventMap.get(eventName) ?? [];

    if (!handlers.includes(handler)) {
      handlers.push(handler);
    }

    this.eventMap.set(eventName, handlers);
  }

  public off<T extends IDomainEvent>(eventName: T['name'], handler: IDomainHandler<T>): void {
    const handlers = this.eventMap.get(eventName) ?? [];

    if (handlers.includes(handler)) {
      this.eventMap.set(eventName, handlers.filter(f => f !== handler));
    }
  }

  public async invoke<T extends IDomainEvent>(event: T, parent?: T['id']): Promise<T> {
    await this.adapter?.beforeInvoke?.(event);

    let returnEvent: T = {
      ...event,
      executedAt: Date.now(),
      parent: parent ?? null,
    };

    for (const [eventTypeId, handlers] of this.eventMap.entries()) {
      if (eventTypeId === event.name) {
        for (const handler of handlers) {
          let childEvents: IDomainEvent[] = [];

          try {
            returnEvent = await this.initiateEvent(returnEvent, handler);
            childEvents = await this.executeEvent(returnEvent, handler);
          } catch (err) {
            returnEvent = {
              ...returnEvent,
              errors: [...returnEvent.errors ?? [], err],
            };
          }

          // if there are any errors, pass an empty array instead.
          const childEventStates = returnEvent.errors.length ? [] : await Promise.all(
            childEvents.map((event) => this.invoke(event, returnEvent.id)),
          );

          returnEvent = {
            ...returnEvent,
            completedAt: Date.now(),
            ...this.completeEvent(returnEvent, childEventStates, handler),
          };
        }
      }
    }

    await this.adapter?.afterInvoke?.(returnEvent);
    return returnEvent;
  }
};

type CreateDomainEventReturnType<T extends IDomainEvent> = Pick<T, keyof IDomainEvent>;

type CreateDomainEventArgs<T extends IDomainEvent> = Pick<T, 'name'> & {
  params: DeepReadonly<T['params']>;
  state: DeepReadonly<T['state']>;
  parent?: T['parent'];
};

export const createDomainEvent = <T extends IDomainEvent>({
  name,
  params,
  state,
  parent,
}: CreateDomainEventArgs<T>): CreateDomainEventReturnType<T> => ({
  id: uuid.v4(),
  parent: parent ?? null,
  createdAt: Date.now(),
  executedAt: null,
  completedAt: null,
  name,
  params,
  state,
  errors: [],
});
