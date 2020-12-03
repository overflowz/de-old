import { CreateDomainEventArgs, CreateDomainEventReturnType, IDomainEvent, IDomainEventHooks, IDomainEventHandler, InvokeOptions, EventCallback } from './interface';
export declare class DomainEvents {
    constructor();
    private hooks?;
    private readonly handlerMap;
    private readonly actionMap;
    private initiateEvent;
    private executeEvent;
    private completeEvent;
    registerHandler<T extends IDomainEvent>(action: T['action'], handler: IDomainEventHandler<T>): void;
    on<T extends IDomainEvent>(action: T['action'], callback: EventCallback<T>): void;
    off<T extends IDomainEvent>(action: T['action'], callback?: EventCallback<T>): void;
    invoke<T extends IDomainEvent>(event: T, options?: InvokeOptions<T>): Promise<T>;
    setupHooks(hooks: IDomainEventHooks): void;
}
export declare const createDomainEvent: <T extends IDomainEvent<object, object>>({ action, params, metadata, }: CreateDomainEventArgs<T>) => CreateDomainEventReturnType<T>;
