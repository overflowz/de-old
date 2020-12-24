import { v4 as uuidv4 } from 'uuid';

import tryCatch from './utils/tryCatch';
import {
  EventCallback,
  EventStatus,
  GenerateDomainEventArgs,
  GenerateDomainEventReturnType,
  IDomainEvent,
  IDomainEventHandler,
} from './interface';

export class DomainEvents {
  private readonly handlerMap: Map<IDomainEvent['action'], IDomainEventHandler<any>[]> = new Map();
  private readonly eventMap: Map<IDomainEvent['action'], EventCallback<any>[]> = new Map();

  constructor() {
    this.generateDomainEvent = this.generateDomainEvent.bind(this);
    this.handleEvent = this.handleEvent.bind(this);
    this.register = this.register.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);
  }

  public generateDomainEvent<T extends IDomainEvent>({ id, action, params, metadata, state }: GenerateDomainEventArgs<T>): GenerateDomainEventReturnType<T> {
    return {
      id: id ?? uuidv4(),
      parent: null,
      action,
      status: EventStatus.PENDING,
      error: null,
      params: params ?? {},
      state: state ?? {},
      metadata: metadata ?? {},
    };
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

  public register<T extends IDomainEvent>(action: T['action'], handlers: IDomainEventHandler<T>[]): void {
    if (this.handlerMap.has(action)) {
      throw new Error(`handlers are already registered for the ${action} action.`);
    }

    this.handlerMap.set(action, handlers);
  }

  public async handleEvent<T extends IDomainEvent>(event: T): Promise<GenerateDomainEventReturnType<T>> {
    let returnEvent: T = event;

    try {
      if (returnEvent.status === EventStatus.COMPLETED) {
        return returnEvent;
      }

      if (returnEvent.status !== EventStatus.PENDING) {
        throw new Error(`event ${returnEvent.id} must be in ${EventStatus['PENDING']} state to proceed.`);
      }

      const handlers: IDomainEventHandler<any>[] = this.handlerMap.get(returnEvent.action) ?? [];
      if (!handlers.length) {
        return returnEvent;
      }

      returnEvent = {
        ...returnEvent,
        status: EventStatus.IN_PROGRESS,
      };

      for (const handler of handlers) {
        // initiation phase

        let children: readonly IDomainEvent[] = await handler.initiate?.(returnEvent) || [];

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

        // execution phase

        children = await handler.execute?.(returnEvent, children) || [];

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

        // completion phase

        children = await handler.complete?.(returnEvent, children) || [];

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
      const normalizedError = err instanceof Error
        ? err
        : new Error(err);

      returnEvent = {
        ...returnEvent,
        status: EventStatus.FAILED,
        message: normalizedError.message,
      };
    }

    return returnEvent;
  }
}
