import { CreateDomainEventArgs, CreateDomainEventReturnType, IDomainEvent, IDomainEventHooks, IDomainEventHandler, InvokeOptions, EventCallback } from './interface';
export declare class DomainEvents {
    private readonly hooks?;
    constructor(hooks?: IDomainEventHooks | undefined);
    private readonly handlerMap;
    private readonly eventMap;
    private initiateEvent;
    private executeEvent;
    private completeEvent;
    registerHandler<T extends IDomainEvent>(type: T['type'], handler: IDomainEventHandler<T>): void;
    on<T extends IDomainEvent>(type: T['type'], callback: EventCallback<T>): void;
    off<T extends IDomainEvent>(type: T['type'], callback?: EventCallback<T>): void;
    invoke<T extends IDomainEvent>(event: T, options?: InvokeOptions<T>): Promise<T>;
}
export declare const createDomainEvent: <T extends IDomainEvent<object, object>>({ type, params, metadata, }: CreateDomainEventArgs<T>) => CreateDomainEventReturnType<T>;
