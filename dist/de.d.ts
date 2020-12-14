import { EventCallback, GenerateDomainEventArgs, GenerateDomainEventReturnType, IDomainEvent, IDomainEventHandler, IDomainEventHooks } from './interface';
export declare class DomainEvents {
    private readonly handlerMap;
    private readonly eventMap;
    private readonly hooks?;
    constructor(hooks?: IDomainEventHooks);
    generateDomainEvent<T extends IDomainEvent>({ action, params, metadata, state }: GenerateDomainEventArgs<T>): GenerateDomainEventReturnType<T>;
    on<T extends IDomainEvent>(action: T['action'], callback: EventCallback<T>): void;
    off<T extends IDomainEvent>(action: T['action'], callback?: EventCallback<T>): void;
    register<T extends IDomainEvent>(action: T['action'], handler: IDomainEventHandler<T>): void;
    handleEvent<T extends IDomainEvent>(event: T): Promise<GenerateDomainEventReturnType<T>>;
    /**
     * @deprecated will be implemented later
     */
    retryEvent<T extends IDomainEvent>(event: T): Promise<GenerateDomainEventReturnType<T>>;
}
