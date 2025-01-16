import { Boot } from './scenes/Boot';
import { GameOver } from './scenes/GameOver';
import { Game as MainGame } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { Debug } from './scenes/Debug';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Phaser.Types.Core.GameConfig = {
	type: AUTO,
	width: 1600,
	height: 900,
	parent: 'game-container',
	backgroundColor: '#028af8',
	scene: [Boot, Preloader, Debug, MainMenu, MainGame, GameOver]
};

const StartGame = (parent: string) => {
	return new Game({ ...config, parent });
};

export default StartGame;
