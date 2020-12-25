# TODO:

DomainEvents:
- ~~registerHandler -> register~~
- ~~merge actions into one when they have the same action type~~
- support execution of specific phase
- support event chain completion (i.e., when executing a child action from phase Execute, check if it has parent(s) awaiting and complete the whole flow)
- support delays (i.e., can wait as long as the user wants to, should not be blocking either).
- ~~add status (to figure out if it was completed or not).~~
- ~~more control over the event changing (instead of mutating the event.state).~~
- event can change the phase/status of the event. the library should respect this.
