import { v4 as uuidv4 } from 'uuid';

import tryCatch from './utils/tryCatch';
import {
  DeepReadonly,
  EventCallback,
  EventPhase,
  EventStatus,
  GenerateDomainEventArgs,
  GenerateDomainEventReturnType,
  HandlerMapRecord,
  IDomainEvent,
  IDomainEventHandler,
  Middleware,
} from './interface';

const normalizeError = (err: any): Error => err instanceof Error ? err : new Error(err);

export const generateDomainEvent = <T extends IDomainEvent>({
  id,
  action,
  params,
  metadata,
  state,
}: GenerateDomainEventArgs<T>): GenerateDomainEventReturnType<T> => ({
  id: id ?? uuidv4(),
  parent: null,
  action,
  status: EventStatus.PENDING,
  error: null,
  params: params ?? {},
  state: state as DeepReadonly<T['state']> ?? {},
  metadata: metadata ?? {},
});

export class DomainEvents {
  private readonly handlerMap: Map<IDomainEvent['action'], HandlerMapRecord<any>> = new Map();
  private readonly eventMap: Map<IDomainEvent['action'], EventCallback<any>[]> = new Map();

  constructor() {
    this.handleEvent = this.handleEvent.bind(this);
    this.register = this.register.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
  }

  public on<T extends IDomainEvent>(action: T['action'], callback: EventCallback<T>): void {
    const callbacks = this.eventMap.get(action) ?? [];

    if (!callbacks.includes(callback)) {
      callbacks.push(callback);
      this.eventMap.set(action, callbacks);
    }
  }

  public off<T extends IDomainEvent>(action: T['action'], callback?: EventCallback<T>) {
    if (!callback) {
      this.eventMap.delete(action);
    } else {
      const callbacks = this.eventMap.get(action) ?? [];

      if (callbacks.some((s: EventCallback<T>) => s === callback)) {
        this.eventMap.set(action, callbacks.filter((f: EventCallback<T>) => f !== callback));
      }
    }
  }

  public register<T extends IDomainEvent>(action: T['action'], handler: IDomainEventHandler<T>, middlewares?: Middleware<T>[]): void {
    if (this.handlerMap.has(action)) {
      throw new Error(`handler is already registered for the ${action} action type.`);
    }

    this.handlerMap.set(action, {
      handler,
      middlewares: middlewares ?? [],
    });
  }

  public async handleEvent<T extends IDomainEvent>(event: T): Promise<GenerateDomainEventReturnType<T>> {
    let handlerMiddlewares: Middleware<T>[] = [];
    let returnEvent: T = event;
    let isExitEarly: boolean = false;

    const exitEarlyCallback = (): void => void (isExitEarly = true);

    try {
      if (returnEvent.status === EventStatus.COMPLETED) {
        return returnEvent;
      }

      if (returnEvent.status !== EventStatus.PENDING) {
        throw new Error(`event ${returnEvent.id} must be in ${EventStatus['PENDING']} state to proceed.`);
      }

      const handlerRecord: HandlerMapRecord<T> | undefined = this.handlerMap.get(returnEvent.action);
      if (!handlerRecord) {
        return event;
      }

      const { handler, middlewares } = handlerRecord;
      handlerMiddlewares = middlewares;

      for (const middleware of handlerMiddlewares) {
        returnEvent = await middleware.before?.(returnEvent, exitEarlyCallback) || returnEvent;

        if (isExitEarly) {
          return returnEvent;
        }
      }

      returnEvent = {
        ...returnEvent,
        status: EventStatus.IN_PROGRESS,
      };

      // initiation phase

      for (const middleware of handlerMiddlewares) {
        returnEvent = await middleware.beforeEach?.(returnEvent, [], EventPhase.INITIATE, exitEarlyCallback) || returnEvent;

        if (isExitEarly) {
          return returnEvent;
        }
      }

      let children: readonly IDomainEvent[] = await Promise.resolve(handler.initiate?.(returnEvent))
        .then((res) => Array.isArray(res) ? res : res ? [res] : []);

      returnEvent = {
        ...returnEvent,
        ...children.find((ce: IDomainEvent) => ce.id === returnEvent.id),
        status: returnEvent.status,
      };

      children = await Promise.all(
        children
          .filter((ce: IDomainEvent) => ce.id !== returnEvent.id)
          .map((ce: IDomainEvent) => this.handleEvent({ ...ce, parent: returnEvent.id })),
      );

      for (const middleware of handlerMiddlewares.reverse()) {
        returnEvent = await middleware.afterEach?.(returnEvent, children, EventPhase.INITIATE, exitEarlyCallback) || returnEvent;

        if (isExitEarly) {
          return returnEvent;
        }
      }

      // execution phase

      for (const middleware of handlerMiddlewares) {
        returnEvent = await middleware.beforeEach?.(returnEvent, children, EventPhase.EXECUTE, exitEarlyCallback) || returnEvent;

        if (isExitEarly) {
          return returnEvent;
        }
      }

      children = await Promise.resolve(handler.execute?.(returnEvent, children))
        .then((res) => Array.isArray(res) ? res : res ? [res] : []);

      returnEvent = {
        ...returnEvent,
        ...children.find((ce: IDomainEvent) => ce.id === returnEvent.id),
        status: returnEvent.status,
      };

      children = await Promise.all(
        children
          .filter((ce: IDomainEvent) => ce.id !== returnEvent.id)
          .map((ce: IDomainEvent) => this.handleEvent({ ...ce, parent: returnEvent.id })),
      );

      for (const middleware of handlerMiddlewares.reverse()) {
        returnEvent = await middleware.afterEach?.(returnEvent, children, EventPhase.EXECUTE, exitEarlyCallback) || returnEvent;

        if (isExitEarly) {
          return returnEvent;
        }
      }

      // completion phase

      for (const middleware of handlerMiddlewares) {
        returnEvent = await middleware.beforeEach?.(returnEvent, children, EventPhase.COMPLETE, exitEarlyCallback) || returnEvent;

        if (isExitEarly) {
          return returnEvent;
        }
      }

      children = await Promise.resolve(handler.complete?.(returnEvent, children))
        .then((res) => Array.isArray(res) ? res : res ? [res] : []);

      returnEvent = {
        ...returnEvent,
        ...children.find((ce: IDomainEvent) => ce.id === returnEvent.id),
        status: returnEvent.status,
      };

      // "fire and forget" events returned from the complete phase
      Promise.all(
        children
          .filter((ce: IDomainEvent) => ce.id !== returnEvent.id)
          .map((ce: IDomainEvent) => this.handleEvent({ ...ce, parent: returnEvent.id })),
      );

      for (const middleware of handlerMiddlewares.reverse()) {
        returnEvent = await middleware.afterEach?.(returnEvent, children, EventPhase.COMPLETE, exitEarlyCallback) || returnEvent;

        if (isExitEarly) {
          return returnEvent;
        }
      }

      // call event listeners
      this.eventMap.get(returnEvent.action)?.map(
        (callback: EventCallback<T>) => tryCatch(() => callback(returnEvent)),
      );

      // mark event as completed
      returnEvent = {
        ...returnEvent,
        status: EventStatus.COMPLETED,
      };
    } catch (err) {
      returnEvent = {
        ...returnEvent,
        status: EventStatus.FAILED,
        error: normalizeError(err),
      };
    }

    try {
      for (const middleware of handlerMiddlewares.reverse()) {
        returnEvent = await middleware.after?.(returnEvent, exitEarlyCallback) || returnEvent;

        if (isExitEarly) {
          return returnEvent;
        }
      }
    } catch (err) {
      returnEvent = {
        ...returnEvent,
        status: EventStatus.FAILED,
        error: normalizeError(err),
      };
    }

    return returnEvent;
  }
}
