import * as uuid from 'uuid';

import {
  CreateDomainEventArgs, CreateDomainEventReturnType, IDomainEvent, IDomainEventHooks,
  IDomainEventHandler, DeepReadonly, InvokeOptions
} from './interface';

export class DomainEvents {
  constructor(private readonly hooks?: IDomainEventHooks) { }

  private readonly eventMap: Map<IDomainEvent['type'], IDomainEventHandler<any>[]> = new Map();

  private async initiateEvent<T extends IDomainEvent>(event: T, handler: IDomainEventHandler<T>): Promise<IDomainEvent[]> {
    return (await handler.initiate?.(event) || []) as T[];
  }

  private async executeEvent<T extends IDomainEvent>(event: T, events: IDomainEvent[], handler: IDomainEventHandler<T>): Promise<IDomainEvent[]> {
    return (await handler.execute?.(event, events) || []) as T[];
  }

  private async completeEvent<T extends IDomainEvent>(event: T, events: IDomainEvent[], handler: IDomainEventHandler<T>): Promise<T['state'] | void> {
    if (typeof handler.complete === 'function') {
      return (await handler.complete(event, events)) ?? event.state;
    }

    return event.state;
  }

  public on<T extends IDomainEvent>(eventType: T['type'], handler: IDomainEventHandler<T>): void {
    const handlers = this.eventMap.get(eventType) ?? [];
    const hasNonMiddlewareHandler = handlers.some(s => !s.isMiddleare);

    if (hasNonMiddlewareHandler && !handler.isMiddleare) {
      throw new Error('cannot have more than one non-middleware handler');
    }

    if (!handlers.includes(handler)) {
      handlers.push(handler);
    }

    this.eventMap.set(eventType, handlers);
  }

  public off<T extends IDomainEvent>(eventType: T['type'], handler: IDomainEventHandler<T>): void {
    const handlers = this.eventMap.get(eventType) ?? [];

    if (handlers.includes(handler)) {
      this.eventMap.set(eventType, handlers.filter(f => f !== handler));
    }
  }

  public async invoke<T extends IDomainEvent>(event: T, options?: InvokeOptions<T>): Promise<T> {
    if (event.completedAt && !options?.retryCompleted) {
      return event;
    }

    let returnEvent: T = {
      ...event,
      parent: options?.parent ?? null,
    };

    returnEvent = await this.hooks?.beforeInvoke?.(returnEvent as DeepReadonly<T>) as T || returnEvent;

    for (const [eventType, handlers] of this.eventMap.entries()) {
      if (eventType === event.type) {
        for (const handler of handlers) {
          let initiateChildEvents: IDomainEvent[] = [];
          let executeChildEvents: IDomainEvent[] = [];

          returnEvent = handler.isMiddleare
            ? returnEvent
            : await this.hooks?.beforeInitiate?.(returnEvent as DeepReadonly<T>) as T || returnEvent;

          returnEvent = {
            ...returnEvent,
            ...(handler.isMiddleare ? null : { initiatedAt: Date.now() }),
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
            initiateChildEvents.map((event) => this.invoke(event, { parent: returnEvent.parent })),
          );

          if (!handler.isMiddleare) {
            await this.hooks?.afterInitiate?.(returnEvent as DeepReadonly<T>);
          }

          if (!returnEvent.errors.length) {
            returnEvent = handler.isMiddleare
              ? returnEvent
              : await this.hooks?.beforeExecute?.(returnEvent as DeepReadonly<T>) as T || returnEvent;

            returnEvent = {
              ...returnEvent,
              ...(handler.isMiddleare ? null : { executedAt: Date.now() }),
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
            executeChildEvents.map((event) => this.invoke(event, { parent: returnEvent.id })),
          );

          if (!handler.isMiddleare) {
            await this.hooks?.afterExecute?.(returnEvent as DeepReadonly<T>);
            returnEvent = await this.hooks?.beforeComplete?.(returnEvent as DeepReadonly<T>) as T || returnEvent;
          }

          returnEvent = {
            ...returnEvent,
            ...(handler.isMiddleare ? null : { completedAt: Date.now() }),
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

            if (handler.isMiddleare) {
              await this.hooks?.afterComplete?.(returnEvent as DeepReadonly<T>);
              await this.hooks?.afterInvoke?.(returnEvent as DeepReadonly<T>);
            }

            throw err;
          }

          if (handler.isMiddleare) {
            await this.hooks?.afterComplete?.(returnEvent as DeepReadonly<T>);
          }
        }
      }
    }

    await this.hooks?.afterInvoke?.(returnEvent as DeepReadonly<T>);
    return returnEvent;
  }
};

export const createDomainEvent = <T extends IDomainEvent>({
  type,
  params,
  metadata,
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
  metadata: metadata ?? {},
} as any);
