declare type Primitive = string | number | boolean | undefined | null;
declare type DeepReadonlyObject<T> = {
    readonly [P in keyof T]: DeepReadonly<T[P]>;
};
export declare type DeepReadonly<T> = T extends Primitive ? T : DeepReadonlyObject<T>;
export interface IDomainEvent<P extends object = object, S extends object = object> {
    /**
     * id of the event
     */
    readonly id: string;
    /**
     * parent of the event
     */
    readonly parent: this['id'] | null;
    /**
     * type of the event
     */
    readonly type: string;
    /**
     * when the event was created
     */
    readonly createdAt: number;
    /**
     * when the event was initiated
     */
    readonly initiatedAt: number | null;
    /**
     * when the event was executed
     */
    readonly executedAt: number | null;
    /**
     * when the event was completed
     */
    readonly completedAt: number | null;
    /**
     * parameters required for the event
     */
    readonly params: DeepReadonly<P>;
    /**
     * state management for the event
     */
    state: DeepReadonly<S>;
    /**
     * if there were any errors in the event
     */
    readonly errors: DeepReadonly<Error[]>;
    /**
     * custom metadata (can be modified from the hooks)
     */
    readonly metadata: DeepReadonly<Record<string, any>>;
}
export declare type CreateDomainEventReturnType<T extends IDomainEvent> = Pick<T, keyof IDomainEvent>;
export declare type CreateDomainEventArgs<T extends IDomainEvent> = Pick<T, 'type' | 'params'>;
declare type ActionReturnType = void | readonly IDomainEvent[] | Promise<void | readonly IDomainEvent[]>;
declare type CompleteReturnType<T extends IDomainEvent> = T['state'] | void | Promise<void | T['state']>;
export interface IDomainEventHandler<T extends IDomainEvent> {
    initiate?: (event: T) => ActionReturnType;
    execute?: (event: T, children: readonly IDomainEvent[]) => ActionReturnType;
    complete?: (event: T, children: readonly IDomainEvent[]) => CompleteReturnType<T>;
}
export interface IDomainEventHooks {
    beforeInvoke?: <T extends IDomainEvent>(event: DeepReadonly<T>) => void | Promise<void> | DeepReadonly<T> | Promise<DeepReadonly<T>>;
    beforeInitiate?: <T extends IDomainEvent>(event: DeepReadonly<T>) => void | Promise<void> | DeepReadonly<T> | Promise<DeepReadonly<T>>;
    afterInitiate?: <T extends IDomainEvent>(event: DeepReadonly<T>) => void | Promise<void>;
    beforeExecute?: <T extends IDomainEvent>(event: DeepReadonly<T>) => void | Promise<void> | DeepReadonly<T> | Promise<DeepReadonly<T>>;
    afterExecute?: <T extends IDomainEvent>(event: DeepReadonly<T>) => void | Promise<void>;
    beforeComplete?: <T extends IDomainEvent>(event: DeepReadonly<T>) => void | Promise<void> | DeepReadonly<T> | Promise<DeepReadonly<T>>;
    afterComplete?: <T extends IDomainEvent>(event: DeepReadonly<T>) => void | Promise<void>;
    afterInvoke?: <T extends IDomainEvent>(event: DeepReadonly<T>) => void | Promise<void>;
}
export {};
