import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import * as T from '$lib/ReWings/lib/types'
import _ from 'lodash';

export class Game extends Scene {
	camera: Phaser.Cameras.Scene2D.Camera;
	background: Phaser.GameObjects.Image;
	planes: Record<number, Phaser.GameObjects.Sprite>;

	planes_state?: Record<number, T.Plane>;

	isChanged_state: boolean = false;

	constructor() {
		super('Game');
		this.planes = {};
	}

	update() {
		if(this.planes_state) {
			this.updateScene()
		}
	}

	create() {
		this.camera = this.cameras.main;
		this.camera.setBackgroundColor(0x222244);
		this.camera.setPosition(0,0);
		this.camera.setZoom(0.2, 0.2);

		// this.background = this.add.image(512, 384, 'background');
		// this.background.setAlpha(0.5);

		// this.gameText = this.add
		// 	.text(512, 384, 'Make something fun!\nand share it with us:\nsupport@phaser.io', {
		// 		fontFamily: 'Arial Black',
		// 		fontSize: 38,
		// 		color: '#ffffff',
		// 		stroke: '#000000',
		// 		strokeThickness: 8,
		// 		align: 'center'
		// 	})
		// 	.setOrigin(0.5)
		// 	.setDepth(100);

		EventBus.emit('current-scene-ready', this);
	}

	updateScene() {
		if(this.planes_state) {

			const planesKeys: number[] = Object.keys(this.planes).map(i => parseInt(i));
			
			Object.keys(this.planes_state).forEach((id: number) => {
				if(!this.planes_state![id].state!.is_active) {
					delete this.planes_state![id];
				}
			})
		
			const updatedPlanesKeys: number[] = Object.keys(this.planes_state).map(i => parseInt(i));
			const createdPlanes = _.difference(updatedPlanesKeys, planesKeys);
			const modifiedPlanes = _.intersection(planesKeys, updatedPlanesKeys);
			const deletedPlanes = _.difference(planesKeys, updatedPlanesKeys);
			
			deletedPlanes.forEach(id => {
				this.planes[id].destroy();
				delete this.planes[id];
			})

			createdPlanes.forEach(id => {
				this.planes[id] = this.add.sprite(this.planes_state![id].x_gu!*10, this.planes_state![id].y_gu!*10, 'plane')
				this.planes[id].setAngle((this.planes_state![id].angle! - Math.PI/2) * 180 / Math.PI);
			})
			
			modifiedPlanes.forEach(id => {
				this.planes[id].setPosition(this.planes_state![id].x_gu!*10, this.planes_state![id].y_gu!*10);
				this.planes[id].setAngle((this.planes_state![id].angle! - Math.PI/2) * 180 / Math.PI);
			})
			
			this.planes_state = undefined;
		}
	}
	
	// 	this.scene.start('GameOver');
	// }
}
