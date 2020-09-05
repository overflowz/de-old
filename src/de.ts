import * as uuid from 'uuid';
import {
  IDomainEventAdapter,
  IDomainEvent,
  IDomainHandler,
  CreateDomainEventArgs,
  CreateDomainEventReturnType,
} from './interface';

export class DomainEvents {
  constructor(private readonly adapter?: IDomainEventAdapter) { }

  private readonly eventMap: Map<IDomainEvent['type'], IDomainHandler<any>[]> = new Map();

  private async initiateEvent<T extends IDomainEvent>(event: T, handler: IDomainHandler<T>): Promise<IDomainEvent[]> {
    return await handler.initiate?.(event) || [];
  }

  private async executeEvent<T extends IDomainEvent>(event: T, events: IDomainEvent[], handler: IDomainHandler<T>): Promise<IDomainEvent[]> {
    return await handler.execute?.(event, events) || [];
  }

  private completeEvent<T extends IDomainEvent>(event: T, events: IDomainEvent[], handler: IDomainHandler<T>): T {
    if (typeof handler.complete === 'function') {
      return handler.complete(event, events) ?? event;
    }

    return event;
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

    for (const [eventType, handlers] of this.eventMap.entries()) {
      if (eventType === event.type) {
        await this.adapter?.beforeInvoke?.(returnEvent);

        returnEvent = {
          ...returnEvent,
          executedAt: Date.now(),
        };

        for (const handler of handlers) {
          let beforeExecuteEvents: IDomainEvent[] = [];
          let beforeCompleteEvents: IDomainEvent[] = [];

          try {
            beforeExecuteEvents = await this.initiateEvent(returnEvent, handler);
          } catch (err) {
            returnEvent = {
              ...returnEvent,
              errors: [...returnEvent.errors ?? [], err],
            };
          }

          const initiateChildEventStates = returnEvent.errors.length ? [] : await Promise.all(
            beforeExecuteEvents.map((event) => this.invoke(event, returnEvent.id)),
          );

          if (!returnEvent.errors.length) {
            try {
              beforeCompleteEvents = await this.executeEvent(returnEvent, initiateChildEventStates, handler);
            } catch (err) {
              returnEvent = {
                ...returnEvent,
                errors: [...returnEvent.errors ?? [], err],
              };
            }
          }

          const executeChildEventStates = returnEvent.errors.length ? [] : await Promise.all(
            beforeCompleteEvents.map((event) => this.invoke(event, returnEvent.id)),
          );

          try {
            returnEvent = {
              ...returnEvent,
              ...this.completeEvent(returnEvent, executeChildEventStates, handler),
            };
          } catch (err) {
            completeCallbackError = err;

            returnEvent = {
              ...returnEvent,
              errors: [...returnEvent.errors ?? [], err],
            };
          }
        }

        returnEvent = {
          ...returnEvent,
          completedAt: Date.now(),
        };

        await this.adapter?.afterInvoke?.(returnEvent);

        // if complete callback threw an error, rethrow it. we need
        // this check to make sure the adapter is called before throwing.
        if (completeCallbackError) {
          throw completeCallbackError;
        }
      }
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
  executedAt: null,
  completedAt: null,
  type,
  params,
  state: {},
  errors: [],
});
