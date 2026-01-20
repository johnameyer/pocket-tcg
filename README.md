<h1 align="center">@cards-ts/pocket-tcg</h1>

<div align="center">

![GitHub Latest Commit](https://img.shields.io/github/last-commit/johnameyer/pocket-tcg?label=Latest%20Commit)
[![Documentation](https://img.shields.io/static/v1?label=docs&message=hosted&color=informational&logo=typescript)](https://johnameyer.github.io/pocket-tcg)
</div>

This is an implementation of a trading card game battle system in Typescript written on the [@cards-ts framework](https://github.com/johnameyer/cards-ts). It contains no actual game data and is intended for research purposes around gameplay strategization.

Developed mainly though generative AI so even with test coverage there is a chance of bugs.

## Features

### Core Battle System
- ✅ Card battles with HP and damage tracking
- ✅ Active card and bench management (max 3 benched cards)
- ✅ Card evolution system (Basic → Stage 1 → Stage 2)
- ✅ Attack system with damage calculation
- ✅ Knockout detection and handling
- ✅ Points-based winning system (3 points to win)
- ✅ Turn-based gameplay with state machine architecture

### Card Management
- ✅ Evolution chains (multiple evolution stages)
- ✅ Card promotion from bench to active
- ✅ Evolution restrictions (once per turn, not on first turn)
- ✅ Individual card instance tracking for evolution logic

### Game Flow
- ✅ Game setup with active card selection
- ✅ Turn structure with Draw, Main, Attack, and Checkup phases
- ✅ Hand and deck management
- ✅ Bot opponents for single-player games
- ✅ Turn counter and state tracking
- ✅ Customizable game parameters (hand size, turn limits)

### Energy System
- ✅ Energy Zone with automatic generation
- ✅ Energy attachment mechanics
- ✅ Energy-based attack requirements
- ✅ Multi-type Energy generation
- ✅ Energy accelerator effects

### Special Conditions
- ✅ Asleep, Burned, Confused, Paralyzed, Poisoned
- ✅ Special condition interactions and removal
- ✅ Status effect damage between turns

### Advanced Mechanics
- ✅ Tool attachment system
- ✅ Card abilities (passive effects)
- ✅ Retreating with Energy costs
- ✅ Weakness (+20 damage) system
- ✅ First turn restrictions
- ✅ Turn limits (default 30 turns, customizable)
- ✅ Hand size limits (default 10 cards, customizable)

### Battle Features
- ✅ Special cards (2 points when knocked out)
- ✅ Coin flip mechanics for attacks/effects
- ✅ Special condition checkup phase

## Running

After building, start the game:

```bash
node dist/start.js
```

The game supports customizable parameters via command line arguments. Use `--help` to see all available options:

```bash
node dist/start.js --help
```

## Development

### Building

```bash
pnpm run build
```

### Testing

```bash
# Run all tests
pnpm test

# Run specific tests
pnpm test -- --grep 'Target'
```

## 📚 Documentation Links

**Architecture & Framework:**

- [Cards-TS Framework](https://github.com/johnameyer/cards-ts) - The core framework this implementation is built on
- [Framework Documentation](https://johnameyer.github.io/cards-ts) - Hosted documentation for the Cards-TS framework

**Related Packages:**

- [@cards-ts/core](https://github.com/johnameyer/cards-ts/tree/master/libs/core) - Core game mechanics and state management
- [@cards-ts/state-machine](https://github.com/johnameyer/cards-ts/tree/master/libs/state-machine) - Turn-based state machine implementation

## 📝 Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/johnameyer/cards-ts/tags).

## Authors

* **John Meyer** - *Initial work* - [johnameyer](https://github.com/johnameyer)

See also the list of [contributors](https://github.com/johnameyer/cards-ts/contributors) who participated in this project.
