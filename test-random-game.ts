import { randomGameFactory } from './src/index.js';
import { CardRepository } from './src/repository/card-repository.js';

// Create a game with random handlers for both players
const cardRepository = new CardRepository();
const factory = randomGameFactory(cardRepository);

// Start a game between two random players
const players = [
    factory.getHumanHandler(), // Player 1 (will use random handler via intermediary)
    factory.getBotHandler()    // Player 2 (random handler)
];

const params = factory.getGameSetup().getDefaultParams();
const playerNames = ['Random Player 1', 'Random Player 2'];

console.log('Starting random game...');
const driver = factory.getGameDriver(players, params, playerNames);

// Let the game run automatically
let stepCount = 0;
const maxSteps = 100;

while (!driver.isGameOver() && stepCount < maxSteps) {
    try {
        driver.resume();
        stepCount++;
        
        if (stepCount % 10 === 0) {
            console.log(`Step ${stepCount}: Game still running...`);
        }
    } catch (error) {
        console.error('Game error:', error);
        break;
    }
}

if (driver.isGameOver()) {
    console.log('Game completed!');
    console.log('Final state:', driver.getState());
} else {
    console.log(`Game stopped after ${maxSteps} steps`);
    console.log('Current state:', driver.getState());
}
