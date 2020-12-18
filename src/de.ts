import { v4 as uuidv4 } from 'uuid';

import tryCatch from './utils/tryCatch';
import executeHandlers from './utils/executeHandlers';
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
  private readonly handlerMap: Map<IDomainEvent['action'], IDomainEventHandler<any>[]> = new Map();
  private readonly eventMap: Map<IDomainEvent['action'], EventCallback<any>[]> = new Map();
  private readonly hooks?: IDomainEventHooks;

  constructor(hooks?: IDomainEventHooks) {
    this.generateDomainEvent = this.generateDomainEvent.bind(this);
    this.handleEvent = this.handleEvent.bind(this);
    this.register = this.register.bind(this);
    this.on = this.on.bind(this);
    this.off = this.off.bind(this);

    this.hooks = hooks;
  }

  public generateDomainEvent<T extends IDomainEvent>({ id, action, params, metadata, state }: GenerateDomainEventArgs<T>): GenerateDomainEventReturnType<T> {
    return {
      id: id ?? uuidv4(),
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
        // return already completed event immediately without handling it.
        // we dont execute event listeners in this case, because it could've already
        // fired when the event was completed.
        return returnEvent;
      }

      returnEvent = await this.hooks?.beforeInvoke?.(event as DeepReadonly<T>) as T || event;

      if (returnEvent.status !== EventStatus.PENDING || returnEvent.phase !== EventPhase.INITIATE) {
        // event must be in an INITIATE phase with status of PENDING, otherwise
        // unexpected results might occur (i.e., duplicate processing, data integrity issues, etc.).
        throw new Error(`event ${returnEvent.id} must be in ${EventStatus['PENDING']} state and ${EventPhase.INITIATE} phase to proceed.`);
      }

      const handlers: IDomainEventHandler<any>[] | undefined = this.handlerMap.get(returnEvent.action);
      bp: if (typeof handlers !== 'undefined') {
        returnEvent = await this.hooks?.beforeInitiate?.(returnEvent as DeepReadonly<T>) as T || returnEvent;

        // handler found, set status to IN_PROGRESS
        returnEvent = {
          ...returnEvent,
          status: EventStatus.IN_PROGRESS,
        };

        // initiation phase

        const initiateEvents = await executeHandlers(handlers, EventPhase.INITIATE, returnEvent);

        if (initiateEvents instanceof Error) {
          returnEvent = {
            ...returnEvent,
            status: EventStatus.FAILED,
            error: initiateEvents.message,
          };

          await this.hooks?.afterInitiate?.(returnEvent as DeepReadonly<T>);
          break bp;
        }

        returnEvent = {
          ...returnEvent,
          ...initiateEvents.find((ce: IDomainEvent) => ce.id === returnEvent.id),
          // keep original phase/status.
          phase: returnEvent.phase,
          status: returnEvent.status,
        };

        const initiateEventStates: IDomainEvent[] = await Promise.all(
          initiateEvents
            .filter((ce: IDomainEvent) => ce.id !== returnEvent.id)
            .map((ce: IDomainEvent) => this.handleEvent({ ...ce, parent: returnEvent.id })),
        );

        await this.hooks?.afterInitiate?.(returnEvent as DeepReadonly<T>);

        // execution phase

        returnEvent = {
          ...returnEvent,
          phase: EventPhase.EXECUTE,
        };

        returnEvent = await this.hooks?.beforeExecute?.(returnEvent as DeepReadonly<T>, initiateEventStates) as T || returnEvent;

        const executeEvents = await executeHandlers(handlers, EventPhase.EXECUTE, returnEvent, initiateEventStates);

        if (executeEvents instanceof Error) {
          returnEvent = {
            ...returnEvent,
            status: EventStatus.FAILED,
            error: executeEvents.message,
          };

          await this.hooks?.afterExecute?.(returnEvent as DeepReadonly<T>, initiateEventStates);
          break bp;
        }

        returnEvent = {
          ...returnEvent,
          ...executeEvents.find((ce: IDomainEvent) => ce.id === returnEvent.id),
          // keep original phase/status.
          phase: returnEvent.phase,
          status: returnEvent.status,
        };

        const executeEventStates: IDomainEvent[] = await Promise.all(
          executeEvents
            .filter((ce: IDomainEvent) => ce.id !== returnEvent.id)
            .map((ce: IDomainEvent) => this.handleEvent({ ...ce, parent: returnEvent.id })),
        );

        await this.hooks?.afterExecute?.(returnEvent as DeepReadonly<T>, initiateEventStates);

        // completion phase

        returnEvent = {
          ...returnEvent,
          phase: EventPhase.COMPLETE,
        };

        returnEvent = await this.hooks?.beforeComplete?.(returnEvent as DeepReadonly<T>, executeEventStates) as T || returnEvent;

        const completeEvents = await executeHandlers(handlers, EventPhase.COMPLETE, returnEvent, executeEventStates);

        if (completeEvents instanceof Error) {
          returnEvent = {
            ...returnEvent,
            status: EventStatus.FAILED,
            error: completeEvents.message,
          };

          await this.hooks?.afterComplete?.(returnEvent as DeepReadonly<T>, executeEventStates);
          break bp;
        }

        returnEvent = {
          ...returnEvent,
          ...completeEvents.find((ce: IDomainEvent) => ce.id === returnEvent.id),
          // keep original phase/status.
          phase: returnEvent.phase,
          status: returnEvent.status,
        };

        // "fire and forget" events returned from the complete phase
        Promise.all(
          completeEvents
            .filter((ce: IDomainEvent) => ce.id !== returnEvent.id)
            .map((ce: IDomainEvent) => this.handleEvent({ ...ce, parent: returnEvent.id })),
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

    await tryCatch(() => this.hooks?.afterInvoke?.(returnEvent as DeepReadonly<T>));

    return returnEvent;
  }
}
