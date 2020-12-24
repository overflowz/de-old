import { EventCallback, GenerateDomainEventArgs, GenerateDomainEventReturnType, IDomainEvent, IDomainEventHandler } from './interface';
export declare const generateDomainEvent: <T extends IDomainEvent<object, object>>({ id, action, params, metadata, state, }: GenerateDomainEventArgs<T>) => GenerateDomainEventReturnType<T>;
export declare class DomainEvents {
    private readonly handlerMap;
    private readonly eventMap;
    constructor();
    on<T extends IDomainEvent>(action: T['action'], callback: EventCallback<T>): void;
    off<T extends IDomainEvent>(action: T['action'], callback?: EventCallback<T>): void;
    register<T extends IDomainEvent>(action: T['action'], handlers: IDomainEventHandler<T>[]): void;
    handleEvent<T extends IDomainEvent>(event: T): Promise<GenerateDomainEventReturnType<T>>;
}
