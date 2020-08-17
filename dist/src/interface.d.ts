declare type primitive = string | number | boolean | undefined | null;
declare type DeepReadonly<T> = T extends primitive ? T : DeepReadonlyObject<T>;
declare type DeepReadonlyObject<T> = {
    readonly [P in keyof T]: DeepReadonly<T[P]>;
};
export interface IDomainEvent<P extends object = object, S extends object = object> {
    readonly id: string;
    readonly parent: string | null;
    readonly type: string;
    readonly params: DeepReadonly<P>;
    readonly errors: DeepReadonly<Error[]>;
    readonly createdAt: number;
    readonly executedAt: number | null;
    readonly completedAt: number | null;
    state: DeepReadonly<S>;
}
export declare type CreateDomainEventReturnType<T extends IDomainEvent> = Pick<T, keyof IDomainEvent>;
export declare type CreateDomainEventArgs<T extends IDomainEvent> = Pick<T, 'type' | 'params' | 'state'>;
declare type PureActionReturnType = void | IDomainEvent[];
declare type ImpureActionReturnType = PureActionReturnType | Promise<PureActionReturnType>;
export interface IDomainHandler<T extends IDomainEvent> {
    initiate?: (event: T) => T | Promise<T>;
    execute?: (event: T) => ImpureActionReturnType;
    complete?: (event: T, childEvents: IDomainEvent[]) => T | undefined;
}
export interface IDomainEventAdapter {
    beforeInvoke?: (event: IDomainEvent) => void | Promise<void>;
    afterInvoke?: (event: IDomainEvent) => void | Promise<void>;
}
export {};
