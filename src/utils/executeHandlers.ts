import tryCatch from './tryCatch';
import lazyPromiseEach from './lazyPromiseEach';
import type { EventPhase, IDomainEvent, IDomainEventHandler } from '../interface';

// executes handler[phase] ordered and returns the merged events that were returned.
const executeHandlers = async <T extends IDomainEvent>(
  handlers: IDomainEventHandler<T>[], phase: EventPhase, event: T, children: IDomainEvent[]
): Promise<IDomainEvent[] | Error> => {
  return tryCatch(
    async () => (await lazyPromiseEach(handlers.map((handler) => () => handler[phase]?.(event, children))))
      .filter((x): x is IDomainEvent[] => Array.isArray(x))
      .reduce((acc, x) => [...acc, ...x], []),
  );
};

export default executeHandlers;
