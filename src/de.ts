import { v4 as uuidv4 } from 'uuid';

import tryCatch from './utils/tryCatch';
import {
  DeepReadonly,
  EventCallback,
  EventPhase,
  EventStatus,
  GenerateDomainEventArgs,
  GenerateDomainEventReturnType,
  IDomainEvent,
  IDomainEventHandler,
  IDomainEventHooks,
} from './interface';

export class DomainEvents {
  private readonly handlerMap: Map<IDomainEvent['action'], IDomainEventHandler<any>> = new Map();
  private readonly eventMap: Map<IDomainEvent['action'], EventCallback<any>[]> = new Map();
  private readonly hooks?: IDomainEventHooks;

  constructor(hooks?: IDomainEventHooks) {
    this.generateDomainEvent = this.generateDomainEvent.bind(this);
    this.handleEvent = this.handleEvent.bind(this);
    // this.retryEvent = this.retryEvent.bind(this);
    this.register = this.register.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);

    this.hooks = hooks;
  }

  public generateDomainEvent<T extends IDomainEvent>({ action, params, metadata, state }: GenerateDomainEventArgs<T>): GenerateDomainEventReturnType<T> {
    return {
      id: uuidv4(),
      parent: null,
      action,
      phase: EventPhase.INITIATE,
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

  public register<T extends IDomainEvent>(action: T['action'], handler: IDomainEventHandler<T>) {
    if (this.handlerMap.has(action)) {
      throw new Error(`handler is already registered for the ${action} action.`);
    }

    this.handlerMap.set(action, handler);
  }

  public async handleEvent<T extends IDomainEvent>(event: T): Promise<GenerateDomainEventReturnType<T>> {
    let returnEvent: T = await this.hooks?.beforeInvoke?.(event as DeepReadonly<T>) as T || event;

    if (returnEvent.status === EventStatus.COMPLETED) {
      // return already completed event immediately without handling it.
      // we dont execute event listeners in this case, because it could've already
      // fired when the event was completed.
      return returnEvent;
    }

    if (returnEvent.status !== EventStatus.PENDING || returnEvent.phase !== EventPhase.INITIATE) {
      // event must be in an INITIATE phase with status of PENDING, otherwise
      // unexpected results might occur (i.e., duplicate processing, data integrity issues, etc.).
      throw new Error(`event ${returnEvent.id} must be in ${EventStatus['PENDING']} state and ${EventPhase.INITIATE} phase to proceed.`);
    }

    const handler = this.handlerMap.get(returnEvent.action);

    bp: if (typeof handler !== 'undefined') {
      returnEvent = await this.hooks?.beforeInitiate?.(returnEvent as DeepReadonly<T>) as T || returnEvent;

      // handler found, set status to IN_PROGRESS
      returnEvent = {
        ...returnEvent,
        status: EventStatus.IN_PROGRESS,
      };

      // initiation phase

      const initiateEvents = await tryCatch(() => handler.initiate?.(returnEvent)) || [];

      if (initiateEvents instanceof Error) {
        returnEvent = {
          ...returnEvent,
          status: EventStatus.FAILED,
          error: initiateEvents.message,
        };

        await this.hooks?.afterInitiate?.(returnEvent as DeepReadonly<T>);
        break bp;
      }

      await this.hooks?.afterInitiate?.(returnEvent as DeepReadonly<T>);

      // execution phase

      returnEvent = {
        ...returnEvent,
        phase: EventPhase.EXECUTE,
      };

      returnEvent = await this.hooks?.beforeExecute?.(returnEvent as DeepReadonly<T>, initiateEvents) as T || returnEvent;

      const initiateEventStates = await Promise.all(
        initiateEvents.map((ce: IDomainEvent) => this.handleEvent({ ...ce, parent: returnEvent.id })),
      );

      const executeEvents = await tryCatch(
        () => handler.execute?.(returnEvent, initiateEventStates),
      ) || [];

      if (executeEvents instanceof Error) {
        returnEvent = {
          ...returnEvent,
          status: EventStatus.FAILED,
          error: executeEvents.message,
        };

        await this.hooks?.afterExecute?.(returnEvent as DeepReadonly<T>, initiateEventStates);
        break bp;
      }

      await this.hooks?.afterExecute?.(returnEvent as DeepReadonly<T>, initiateEventStates);

      // completion phase

      returnEvent = {
        ...returnEvent,
        phase: EventPhase.COMPLETE,
      };

      returnEvent = await this.hooks?.beforeComplete?.(returnEvent as DeepReadonly<T>, executeEvents) as T || returnEvent;

      const executeEventStates = await Promise.all(
        executeEvents.map((ce: IDomainEvent) => this.handleEvent({ ...ce, parent: returnEvent.id })),
      );

      const completeEvents = await tryCatch(
        () => handler.complete?.(returnEvent, executeEventStates)
      ) || [];

      if (completeEvents instanceof Error) {
        returnEvent = {
          ...returnEvent,
          status: EventStatus.FAILED,
          error: completeEvents.message,
        };

        await this.hooks?.afterComplete?.(returnEvent as DeepReadonly<T>, executeEventStates);
        break bp;
      }

      // "fire and forget" events returned from the complete phase
      Promise.all(
        completeEvents.map((ce: IDomainEvent) => this.handleEvent({ ...ce, parent: returnEvent.id })),
      );

      // call event listeners
      this.eventMap.get(returnEvent.action)?.map(
        (callback: EventCallback<T>) => tryCatch(() => callback(returnEvent)),
      );

      // mark event as completed
      returnEvent = {
        ...returnEvent,
        status: EventStatus.COMPLETED,
      };

      await this.hooks?.afterComplete?.(returnEvent as DeepReadonly<T>, executeEventStates);
    }

    await this.hooks?.afterInvoke?.(returnEvent as DeepReadonly<T>);
    return returnEvent;
  }
}
