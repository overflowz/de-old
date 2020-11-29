import { v4 as uuidv4 } from 'uuid';

import {
  CreateDomainEventArgs, CreateDomainEventReturnType, IDomainEvent, IDomainEventHooks,
  IDomainEventHandler, DeepReadonly, InvokeOptions, EventCallback,
} from './interface';

export class DomainEvents {
  constructor(private readonly hooks?: IDomainEventHooks) { }

  private readonly handlerMap: Map<IDomainEvent['action'], IDomainEventHandler<any>[]> = new Map();
  private readonly actionMap: Map<IDomainEvent['action'], EventCallback<any>[]> = new Map();

  private async initiateEvent<T extends IDomainEvent>(event: T, handler: IDomainEventHandler<T>): Promise<IDomainEvent[]> {
    return (await handler.initiate?.(event) || []) as T[];
  }

  private async executeEvent<T extends IDomainEvent>(event: T, events: IDomainEvent[], handler: IDomainEventHandler<T>): Promise<IDomainEvent[]> {
    return (await handler.execute?.(event, events) || []) as T[];
  }

  private async completeEvent<T extends IDomainEvent>(event: T, events: IDomainEvent[], handler: IDomainEventHandler<T>): Promise<IDomainEvent[]> {
    return (await handler.complete?.(event, events) || []) as T[];
  }

  public registerHandler<T extends IDomainEvent>(action: T['action'], handler: IDomainEventHandler<T>): void {
    const handlers = this.handlerMap.get(action) ?? [];
    const hasNonMiddlewareHandler = handlers.some(s => !s.isMiddleware);

    if (hasNonMiddlewareHandler && !handler.isMiddleware) {
      throw new Error('cannot have more than one non-middleware handler');
    }

    if (!handlers.includes(handler)) {
      handlers.push(handler);
    }

    this.handlerMap.set(action, handlers);
  }

  public on<T extends IDomainEvent>(action: T['action'], callback: EventCallback<T>): void {
    const callbacks = this.actionMap.get(action) || [];

    if (callbacks.includes(callback)) {
      return;
    }

    callbacks.push(callback);
    this.actionMap.set(action, callbacks);
  }

  public off<T extends IDomainEvent>(action: T['action'], callback?: EventCallback<T>): void {
    if (!callback) {
      this.actionMap.delete(action);
      return;
    }

    const callbacks = this.actionMap.get(action) ?? [];
    if (callbacks.some(s => s === callback)) {
      this.actionMap.set(action, callbacks.filter(f => f !== callback));
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

    for (const [action, handlers] of this.handlerMap.entries()) {
      if (action === event.action) {
        for (const handler of handlers) {
          let initiateChildEvents: IDomainEvent[] = [];
          let executeChildEvents: IDomainEvent[] = [];

          returnEvent = handler.isMiddleware
            ? returnEvent
            : await this.hooks?.beforeInitiate?.(returnEvent as DeepReadonly<T>) as T || returnEvent;

          returnEvent = {
            ...returnEvent,
            ...(handler.isMiddleware ? null : { initiatedAt: Date.now() }),
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

          if (!handler.isMiddleware) {
            await this.hooks?.afterInitiate?.(returnEvent as DeepReadonly<T>);
          }

          if (!returnEvent.errors.length) {
            returnEvent = handler.isMiddleware
              ? returnEvent
              : await this.hooks?.beforeExecute?.(returnEvent as DeepReadonly<T>) as T || returnEvent;

            returnEvent = {
              ...returnEvent,
              ...(handler.isMiddleware ? null : { executedAt: Date.now() }),
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

          if (!handler.isMiddleware) {
            await this.hooks?.afterExecute?.(returnEvent as DeepReadonly<T>);
            returnEvent = await this.hooks?.beforeComplete?.(returnEvent as DeepReadonly<T>) as T || returnEvent;
          }

          returnEvent = {
            ...returnEvent,
            ...(handler.isMiddleware ? null : { completedAt: Date.now() }),
          };

          try {
            const completeChildEvents = await this.completeEvent<T>(returnEvent, executeChildEventStates, handler);

            await Promise.all(
              completeChildEvents.map((event) => this.invoke(event, { parent: returnEvent.id }))
            );
          } catch (err) {
            returnEvent = {
              ...returnEvent,
              errors: [...returnEvent.errors ?? [], err],
            };

            if (!returnEvent.parent) {
              if (!handler.isMiddleware) {
                await this.hooks?.afterComplete?.(returnEvent as DeepReadonly<T>);
              }

              await this.hooks?.afterInvoke?.(returnEvent as DeepReadonly<T>);
              throw err;
            }
          }

          if (!handler.isMiddleware) {
            await this.hooks?.afterComplete?.(returnEvent as DeepReadonly<T>);

            // call event listeners
            this.actionMap
              .get(event.action)
              ?.map((callback) => {
                try {
                  callback(returnEvent);
                } finally { }
              });
          }
        }
      }
    }

    await this.hooks?.afterInvoke?.(returnEvent as DeepReadonly<T>);
    return returnEvent;
  }
};

export const createDomainEvent = <T extends IDomainEvent>({
  action,
  params,
  metadata,
}: CreateDomainEventArgs<T>): CreateDomainEventReturnType<T> => ({
  id: uuidv4(),
  parent: null,
  createdAt: Date.now(),
  initiatedAt: null,
  executedAt: null,
  completedAt: null,
  action,
  params,
  state: {},
  errors: [],
  metadata: metadata ?? {},
} as any);
