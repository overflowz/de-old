import * as uuid from 'uuid';

import {
  CreateDomainEventArgs, CreateDomainEventReturnType, IDomainEvent, IDomainEventHooks,
  IDomainHandler, DeepReadonly,
} from './interface';

export class DomainEvents {
  constructor(private readonly hooks?: IDomainEventHooks) { }

  private readonly eventMap: Map<IDomainEvent['type'], IDomainHandler<any>[]> = new Map();

  private async initiateEvent<T extends IDomainEvent>(event: T, handler: IDomainHandler<T>): Promise<IDomainEvent[]> {
    return (await handler.initiate?.(event) || []) as T[];
  }

  private async executeEvent<T extends IDomainEvent>(event: T, events: IDomainEvent[], handler: IDomainHandler<T>): Promise<IDomainEvent[]> {
    return (await handler.execute?.(event, events) || []) as T[];
  }

  private async completeEvent<T extends IDomainEvent>(event: T, events: IDomainEvent[], handler: IDomainHandler<T>): Promise<T['state'] | void> {
    if (typeof handler.complete === 'function') {
      return handler.complete(event, events) ?? event.state;
    }

    return event.state;
  }

  public on<T extends IDomainEvent>(eventType: T['type'], handler: IDomainHandler<T>): void {
    const handlers = this.eventMap.get(eventType) ?? [];

    if (!handlers.includes(handler)) {
      handlers.push(handler);
    }

    this.eventMap.set(eventType, handlers);
  }

  public off<T extends IDomainEvent>(eventType: T['type'], handler: IDomainHandler<T>): void {
    const handlers = this.eventMap.get(eventType) ?? [];

    if (handlers.includes(handler)) {
      this.eventMap.set(eventType, handlers.filter(f => f !== handler));
    }
  }

  public async invoke<T extends IDomainEvent>(event: T, parent?: T['id']): Promise<T> {
    let returnEvent: T = {
      ...event,
      parent: parent ?? null,
    };

    returnEvent = await this.hooks?.beforeInvoke?.(returnEvent as DeepReadonly<T>) || returnEvent;

    for (const [eventType, handlers] of this.eventMap.entries()) {
      if (eventType === event.type) {
        for (const handler of handlers) {
          let initiateChildEvents: IDomainEvent[] = [];
          let executeChildEvents: IDomainEvent[] = [];

          returnEvent = await this.hooks?.beforeInitiate?.(returnEvent as DeepReadonly<T>) || returnEvent;

          returnEvent = {
            ...returnEvent,
            initiatedAt: Date.now(),
          };

          try {
            initiateChildEvents = await this.initiateEvent(returnEvent, handler);
          } catch (err) {
            returnEvent = {
              ...returnEvent,
              errors: [...returnEvent.errors ?? [], err],
            };
          }

          const initiateChildEventStates = returnEvent.errors.length ? [] : await Promise.all(
            initiateChildEvents.map((event) => this.invoke(event, returnEvent.id)),
          );

          await this.hooks?.afterInitiate?.(returnEvent as DeepReadonly<T>);

          if (!returnEvent.errors.length) {
            returnEvent = await this.hooks?.beforeExecute?.(returnEvent as DeepReadonly<T>) || returnEvent;

            returnEvent = {
              ...returnEvent,
              executedAt: Date.now(),
            };

            try {
              executeChildEvents = await this.executeEvent(returnEvent, initiateChildEventStates, handler);
            } catch (err) {
              returnEvent = {
                ...returnEvent,
                errors: [...returnEvent.errors ?? [], err],
              };
            }
          }

          const executeChildEventStates = returnEvent.errors.length ? [] : await Promise.all(
            executeChildEvents.map((event) => this.invoke(event, returnEvent.id)),
          );

          await this.hooks?.afterExecute?.(returnEvent as DeepReadonly<T>);
          returnEvent = await this.hooks?.beforeComplete?.(returnEvent as DeepReadonly<T>) || returnEvent;

          returnEvent = {
            ...returnEvent,
            completedAt: Date.now(),
          };

          try {
            returnEvent = {
              ...returnEvent,
              state: await this.completeEvent<T>(returnEvent, executeChildEventStates, handler),
            };
          } catch (err) {
            returnEvent = {
              ...returnEvent,
              errors: [...returnEvent.errors ?? [], err],
            };

            await this.hooks?.afterComplete?.(returnEvent as DeepReadonly<T>);
            await this.hooks?.afterInvoke?.(returnEvent as DeepReadonly<T>);

            throw err;
          }
        }

        await this.hooks?.afterComplete?.(returnEvent as DeepReadonly<T>);
      }
    }

    await this.hooks?.afterInvoke?.(returnEvent as DeepReadonly<T>);
    return returnEvent;
  }
};

export const createDomainEvent = <T extends IDomainEvent>({
  type,
  params,
}: CreateDomainEventArgs<T>): CreateDomainEventReturnType<T> => ({
  id: uuid.v4(),
  parent: null,
  createdAt: Date.now(),
  initiatedAt: null,
  executedAt: null,
  completedAt: null,
  type,
  params,
  state: {},
  errors: [],
  metadata: {},
});
