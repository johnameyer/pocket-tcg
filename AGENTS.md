## Project

This is an implementation of a trading card game battle system in Typescript written on the [@cards-ts framework](https://github.com/johnameyer/cards-ts). It contains no actual game data (i.e. no specific creature names) and is intended for research purposes around gameplay strategization.

## Commands

```bash
pnpm install
pnpm run build
# Run eslint
pnpm run lint
# Run all tests
pnpm test
# Run specific tests
pnpm test -- --grep 'Target'
# Get all failing tests
pnpm test 2>&1 | sed -n '/failing/,$p' | grep -E "^\s*[0-9]+\)" -A 8
```

## Structure

```
pocket-tcg/
├── src/
│   ├── controllers
│   │   ├── *-controller.ts              # Implementation of pocket-tcg-specific controllers
│   │   └── controllers.ts               # Defines available controllers and structure
│   ├── effects                          # Defines effect handlers, validators, etc.
│   ├── handlers
│   │   ├── default-bot-handler.ts       # Bot handler
│   │   └── intermediary-handler.ts      # Human player handler
│   ├── messages
│   │   ├── response/
│   │   │   ├── *-response-message.ts    # Player response structs
│   │   │   └── index.ts                 # Barrel export
│   │   ├── status/                      # Game-emitted status messages structs
│   │   ├── response-message.ts          # Union type for response messages
│   │   └── status-message.ts            # Union type for status messages
│   ├── repository
│   │   ├── card-repository.ts           # Container for card definitions
│   │   └── *-types.ts                   # Card type interfaces
│   ├── utils                            # Project-wide utilities
│   ├── event-handler.ts                 # Specifies handling of response messages
│   ├── game-factory.ts                  # Encapsulates framework elements 
│   ├── game-handler-params.ts           # Custom params for handler methods
│   ├── game-handler.ts                  # Interface describing handler contract
│   ├── game-setup.ts                    # Game params yargs / interactive setup
│   ├── index.ts                         # Public exports
│   ├── start.ts                         # Entry point for users via CLI
│   └── state-machine.ts                 # Game states and transitions
└── spec/                                # Unit tests
    ├── effects/
    │   ├── handlers/                    # Tests for specific effect 'handler' types
    │   └── *.spec.ts                    # Tests for generic effect utils
    ├── helpers/
    │   ├── state-builder.ts             # Declarative fake game state constructor
    │   └── test-helpers.ts              # Helpers for simulating a game
    ├── mock-repository.ts               # Very-generic cards for sharing between tests
    └── *.spec.ts                        # Tests of game-level features
```

## Conventions

Update the README.md with *major* (not minor) features as you implement them.

Controllers are the single entrypoint to modifying the state. Handlers receive a slice of state (pure object without methods) determined by the controllers and can only modify it indirectly through response messages and the event handler. The state machine cannot define its own state or pass values around except through methods on the controller. If dynamic calculations are needed, they should be resolved at the event handler level before calling controller methods.

Both handlers should be updated when changes to the handler contract are made. Handlers are instantiated as an array and only handle moves for a single position at the table.

Controllers should use the injected CardRepository through the controllers object. Handlers should use CardRepository passed as constructor parameter directly to look up metadata about cards from the id.

Prefer to structure the controllers in a composite way to have singular controllers manage as little state on their own. Build out more complex logic by orchestrating across dependency children controllers' methods.

New message types need adding to the union types of response-message or status-message. They also should extend from the Message interface.

Add new enum types where proper instead of using simple `string` typing. Use discriminated unions to avoid needing optional structure keys.

When refactoring, migrate all logic / use sites. Do not retain any logic for legacy / deprecated cases. Clean up at the end of your work.

Don't ever handle cases one off by checking for a specific effect type or ability name. Use the effect wrapper classes effect-applier, effect-validator, target-resolver appropriately.

Avoid use of any and `x?:` / undefined variables as they make debugging difficult.

Use the pattern `${cardData.name}'s ${ability.name}` for ability effects, `${cardData.name}'s ${attack.name}` for attack effects, and `${supporterData.name}` for supporter effects.

When adding new effect types that require target selection, always update the `PendingTargetEffect` union type in `card-types.ts` to include the new effect type. The type must include `effectName: string` for proper messaging.

Always pass `undefined` for `targetPlayerId` and `targetCardIndex` when not specified in `PlayCardResponseMessage` handler. Using default values (0, 0) prevents the EffectApplier from setting `pendingTargetEffect` correctly.

Use generic terms instead of Pokemon-specific terms:
- 'field' instead of 'pokemon field'
- 'card' instead of 'pokemon card'
- 'active card' instead of 'active pokemon'
- 'benched cards' instead of 'benched pokemon'
- 'creature' instead of 'pokemon' when referring to card types
- 'field position' instead of 'card position' (avoids confusion with hand position)
- Prefer `EvolveResponseMessage` over `EvolveCreatureResponseMessage` when context is clear

Avoid use of `any` types completely - do not bypass type checking! Remove usages of any when you find them.

Prefer using static maps to allow for type-based assertion that things are registered correctly. I.e. Record<Effect.type, xyz> = { hp: ... } over registries.

Avoid fallbacks like the plague. If a card id is invalid, use a non-null assertion so that the code will fail and let us know about the issue.

Never do things for the sake of compatibility. Always do the right thing and worry about clean up later.

All types needing serialized (controller state, effects, etc.) MUST be defined as `type` instead of `interface` to avoid serialization errors with the framework. Convert any `export interface XxxEffect` to `export type XxxEffect = {` to fix "Index signature for type 'string' is missing" errors.

Errors like "Cannot read properties of undefined (reading 'order')" from the cards-ts framework serialization are not fatal and can be ignored during testing. These occur due to test card structures not matching standard playing cards (which is expected) but don't affect the core game logic being tested.

Search within specific folders (`src/`, `spec/`, etc.) rather than entire package. Exclude node_modules when searching the entire package root with commands like `find . -name "*.ts" -not -path "*/node_modules/*"` or `grep -r "pattern" --exclude-dir=node_modules .`. When searching specific folders like `src/` or `spec/`, node_modules exclusion is unnecessary.

## Testing

When writing functional tests:
* Focus on user-observable side effects or game changes like HP, hand size, deck size, and active Pokemon
* Test the actual game outcome, not implementation like internal state flags
* Don't only test that messages were processed, but also that the effects were applied
* Multiple assertions on different state properties provide better test coverage and clearer failure messages
* Use state builder and test utils (follow existing patterns) - avoid manual state setup or manual orchestration
* Use `resumeFrom` for multi-step scenarios (i.e. needing to assert between steps or needing to respond for other player)
* Ensure that response messages are provided to progress the game state when the state machine is waiting
* When tests need specific card behaviors (specific hp, retreat cost, effects, energy requirements) not found in the base mock repository, append cards following `weakness.spec.ts`. Give the cards meaningful names describing their purpose 'fire-attacker', 'fire-weakness'.

When solving an issue:
1. Understand the issue
  * What assertion is the test failing?
  * What change caused the test to fail? Is it pre-existing 
  * Does the test assertion make sense?
2. Form a hypothesis first
  * Analyze error patterns across tests
  * Review the previous logic with `git show HEAD:path/to/file`
  * Identify the root cause, not symptoms
3. Add logging to prove hypothesis and illustrate issue
  * Use a tagged log message `[Handler]` to allow you to filter for specific messages using grep
  * Log parameters, values, final results as needed to help you improve your hypothesis
  * Use trace as needed to debug execution flow
4. Re-run test to validate hypothesis: revise hypothesis and add logging as needed
5. Fix root cause
  * Make minimal changes to address the issue
  * Do not hardcode values, change tests to bypass assertions, or add other workarounds
6. Verify fix
  * Verify fix is valid
  * Run the test(s) in question
  * Ensure no regression in other tests
6. (Once all tests are passing) Clean up debug logging

Some common root causes:
* Look for the `Error:` messages in stdout to see if a message was rejected by the event handler instead of being processed - these can be correlated to event-handler.ts
* Controller methods being called at inappropriate times (shouldEndTurn)
* Effects being called from inappropriate places (i.e. from within controllers)
* Creature damage is maxing out due to KO - use high hp creature
* Creature damage is affected by type weakness
* Test misconfiguration - wrong attack / card being used, definition not found
* Wrong state in state machine being used (setup)

## Commits

Should answer "What does this commit change at a high level?"

Should continue the sentence "Apply this commit to..."

Capitalize the subject line and do not end it with a period.

Rely on the Github Issue / PR to contain other details.

## References

Uses the cards-ts framework
- [@cards-ts High-Level Documentation](https://github.com/johnameyer/cards-ts/tree/master/wiki)
- [@cards-ts/core](https://github.com/johnameyer/cards-ts/tree/master/libs/core) - Core game mechanics and state management
- [@cards-ts/state-machine](https://github.com/johnameyer/cards-ts/tree/master/libs/state-machine) - Turn-based state machine implementation