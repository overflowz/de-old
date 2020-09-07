import * as uuid from 'uuid';

import {
  CreateDomainEventArgs, CreateDomainEventReturnType, IDomainEvent, IDomainEventHooks,
  IDomainHandler,
} from './interface';

export class DomainEvents {
  constructor(private readonly hooks?: IDomainEventHooks) { }

  private readonly eventMap: Map<IDomainEvent['type'], IDomainHandler<any>[]> = new Map();

  private async initiateEvent<T extends IDomainEvent>(event: T, handler: IDomainHandler<T>): Promise<IDomainEvent[]> {
    return await handler.initiate?.(event) || [];
  }

  private async executeEvent<T extends IDomainEvent>(event: T, events: IDomainEvent[], handler: IDomainHandler<T>): Promise<IDomainEvent[]> {
    return await handler.execute?.(event, events) || [];
  }

  private completeEvent<T extends IDomainEvent>(event: T, events: IDomainEvent[], handler: IDomainHandler<T>): T['state'] {
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
    let completeCallbackError: Error | undefined;
    let returnEvent: T = {
      ...event,
      parent: parent ?? null,
    };

    returnEvent = await this.hooks?.beforeInvoke?.(returnEvent) || returnEvent;

    for (const [eventType, handlers] of this.eventMap.entries()) {
      if (eventType === event.type) {
        for (const handler of handlers) {
          let initiateChildEvents: IDomainEvent[] = [];
          let executeChildEvents: IDomainEvent[] = [];

          returnEvent = await this.hooks?.beforeInitiate?.(returnEvent) || returnEvent;

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

          await this.hooks?.afterInitiate?.(returnEvent);

          if (!returnEvent.errors.length) {
            returnEvent = await this.hooks?.beforeExecute?.(returnEvent) || returnEvent;

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

          await this.hooks?.afterExecute?.(returnEvent);
          returnEvent = await this.hooks?.beforeComplete?.(returnEvent) || returnEvent;

          returnEvent = {
            ...returnEvent,
            completedAt: Date.now(),
          };

          try {
            returnEvent = {
              ...returnEvent,
              state: this.completeEvent(returnEvent, executeChildEventStates, handler),
            };
          } catch (err) {
            completeCallbackError = err;

            returnEvent = {
              ...returnEvent,
              errors: [...returnEvent.errors ?? [], err],
            };
          }
        }

        await this.hooks?.afterComplete?.(returnEvent);
      }
    }

    await this.hooks?.afterInvoke?.(returnEvent);

    // if complete callback threw an error, rethrow it. we need
    // this check to make sure the adapter is called before throwing.
    if (completeCallbackError) {
      throw completeCallbackError;
    }

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
});
