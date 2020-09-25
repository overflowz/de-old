import { CreateDomainEventArgs, CreateDomainEventReturnType, IDomainEvent, IDomainEventHooks, IDomainEventHandler } from './interface';
export declare class DomainEvents {
    private readonly hooks?;
    constructor(hooks?: IDomainEventHooks | undefined);
    private readonly eventMap;
    private initiateEvent;
    private executeEvent;
    private completeEvent;
    on<T extends IDomainEvent>(eventType: T['type'], handler: IDomainEventHandler<T>): void;
    off<T extends IDomainEvent>(eventType: T['type'], handler: IDomainEventHandler<T>): void;
    invoke<T extends IDomainEvent>(event: T, parent?: T['id']): Promise<T>;
}
export declare const createDomainEvent: <T extends IDomainEvent<object, object>>({ type, params, metadata, }: CreateDomainEventArgs<T>) => CreateDomainEventReturnType<T>;
