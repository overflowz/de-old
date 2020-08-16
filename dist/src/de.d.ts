import { IDomainEventAdapter, IDomainEvent, IDomainHandler, CreateDomainEventArgs, CreateDomainEventReturnType } from './interface';
export declare class DomainEvents {
    private readonly adapter?;
    constructor(adapter?: IDomainEventAdapter | undefined);
    private readonly eventMap;
    private initiateEvent;
    private executeEvent;
    private completeEvent;
    on<T extends IDomainEvent>(eventName: T['name'], handler: IDomainHandler<T>): void;
    off<T extends IDomainEvent>(eventName: T['name'], handler: IDomainHandler<T>): void;
    invoke<T extends IDomainEvent>(event: T, parent?: T['id']): Promise<T>;
}
export declare const createDomainEvent: <T extends IDomainEvent<object, object>>({ name, params, state, }: Pick<T, "name" | "params" | "state">) => Pick<T, "id" | "parent" | "name" | "params" | "errors" | "createdAt" | "executedAt" | "completedAt" | "state">;
